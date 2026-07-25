import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "../store/auth";
import { buildWsUrl } from "../lib/config";
import { remindersApi } from "../lib/remindersApi";
import type { Reminder } from "../lib/remindersApi";

const SOUND_ENABLED = true;

const SoundContext = (() => {
  let ctx: AudioContext | null = null;
  return () => {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  };
})();

function playNotificationSound() {
  if (!SOUND_ENABLED) return;
  try {
    const audio = new Audio("/sounds/tune.wav");
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
        /* audio not available */
      }
    });
  } catch {
    /* audio not available */
  }
}

function playTaskSound() {
  if (!SOUND_ENABLED) return;
  try {
    const audio = new Audio("/sounds/task.wav");
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
        /* audio not available */
      }
    });
  } catch {
    /* audio not available */
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

// Backoff schedule: 5s, 10s, 20s — then give up (max 3 retries)
const BACKOFF_MS = [5_000, 10_000, 20_000];

export function useReminderWebSocket() {
  const token = useAuthStore((s) => s.token);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gaveUpRef = useRef(false);
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

    // Reset gave-up flag on fresh effect run (e.g. user re-logs in with new token)
    gaveUpRef.current = false;

    let destroyed = false;

    function connect() {
      if (destroyed || gaveUpRef.current) return;

      // Construct proper URL for /reminders/ws
      const baseUrl = buildWsUrl(token!);
      const wsUrl = baseUrl.replace("/ws?", "/reminders/ws?");
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        retryRef.current = 0;
        setConnected(true);
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
            /* keep alive */
          }
        } catch (err) {
          /* malformed message */
        }
      };

      ws.onerror = () => {};

      ws.onclose = (evt) => {
        setConnected(false);
        if (pingRef.current) clearInterval(pingRef.current);
        if (destroyed) return;

        // Code 4001 / 1008 = auth failure — do NOT retry
        if (evt.code === 4001 || evt.code === 1008) {
          console.warn("[reminder-ws] Auth rejected (%s) — not retrying", evt.code);
          gaveUpRef.current = true;
          return;
        }

        // Exponential backoff with cap (max 3 retries)
        const delay = BACKOFF_MS[retryRef.current];
        if (delay === undefined) {
          console.warn("[reminder-ws] Max retries reached — giving up");
          gaveUpRef.current = true;
          return;
        }
        retryRef.current += 1;
        timerRef.current = setTimeout(connect, delay);
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

  // Recovery fetch for missed reminders when disconnected
  useEffect(() => {
    if (!token) return;
    const t = setTimeout(async () => {
      try {
        const recovery = await remindersApi.getRecovery();
        if (recovery.missed_count > 0) {
          setMissedCount(recovery.missed_count);
        }
      } catch {
        /* backend not ready */
      }
    }, 3000);
    return () => clearTimeout(t);
  }, [token]);

  return { notifications, missedCount, setMissedCount, dismiss, dismissAll, connected };
}

export { playTaskSound };
