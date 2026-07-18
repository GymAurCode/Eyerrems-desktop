import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "../store/auth";
import { buildWsUrl } from "../lib/config";
import { remindersApi } from "../lib/remindersApi";
import type { Reminder } from "../lib/remindersApi";

const SoundContext = (() => {
  let ctx: AudioContext | null = null;
  return () => {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  };
})();

function playNotificationSound() {
  try {
    const audio = new Audio("/sounds/reminder.mp3");
    audio.volume = 0.5;
    audio.play().catch(() => {
      try {
        const audioCtx = SoundContext();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = 880;
        osc.type = "sine";
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.5);
      } catch {
        // audio not available
      }
    });
  } catch {
    // audio not available
  }
}

function showDesktopNotification(reminder: Reminder) {
  const body = [
    reminder.description && `${reminder.description}`,
    `Time: ${new Date(reminder.remind_at).toLocaleString()}`,
    `Priority: ${reminder.priority}`,
  ]
    .filter(Boolean)
    .join("\n");

  const win = window as any;
  if (win.reminderAPI?.showNotification) {
    win.reminderAPI.showNotification({
      title: reminder.title,
      body,
      reminder,
    }).catch(() => {});
    return;
  }

  if ("Notification" in window) {
    if (Notification.permission === "granted") {
      new Notification(reminder.title, { body });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((perm) => {
        if (perm === "granted") new Notification(reminder.title, { body });
      });
    }
  }
}

export function useReminderWebSocket() {
  const token = useAuthStore((s) => s.token);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [notifications, setNotifications] = useState<Reminder[]>([]);
  const [missedCount, setMissedCount] = useState(0);
  const [connected, setConnected] = useState(false);

  const dismiss = useCallback((id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setNotifications([]);
  }, []);

  useEffect(() => {
    if (!token) return;

    let destroyed = false;

    function connect() {
      if (destroyed) return;
      const url = buildWsUrl(token!).replace("/ws", "/reminders/ws");
      console.log("[reminder-ws] Connecting...");
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[reminder-ws] Connected");
        setConnected(true);
        retryRef.current = 0;
        pingRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 25000);
      };

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === "reminder_due" && msg.reminder) {
            setNotifications((prev) => {
              const next = [msg.reminder, ...prev].slice(0, 20);
              return next;
            });
            playNotificationSound();
            showDesktopNotification(msg.reminder);
          } else if (msg.type === "pong") {
            // keep alive
          }
        } catch (err) {
          console.warn("[reminder-ws] Failed to parse message:", err);
        }
      };

      ws.onerror = () => {
        console.warn("[reminder-ws] Error");
      };

      ws.onclose = (evt) => {
        console.log("[reminder-ws] Closed code=%s", evt.code);
        setConnected(false);
        if (pingRef.current) clearInterval(pingRef.current);
        if (destroyed) return;
        if (evt.code === 4001) {
          console.warn("[reminder-ws] Auth failed, not retrying");
          return;
        }
        const delays = [5000, 10000, 20000, 30000];
        const delay = delays[retryRef.current] ?? 30000;
        retryRef.current = Math.min(retryRef.current + 1, delays.length - 1);
        timerRef.current = setTimeout(connect, delay);
        console.log("[reminder-ws] Reconnecting in %sms", delay);
      };
    }

    connect();

    return () => {
      destroyed = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (pingRef.current) clearInterval(pingRef.current);
      wsRef.current?.close();
    };
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const t = setTimeout(async () => {
      try {
        const recovery = await remindersApi.getRecovery();
        if (recovery.missed_count > 0) {
          setMissedCount(recovery.missed_count);
        }
      } catch {
        // backend not ready
      }
    }, 3000);
    return () => clearTimeout(t);
  }, [token]);

  return { notifications, missedCount, setMissedCount, dismiss, dismissAll, connected };
}
