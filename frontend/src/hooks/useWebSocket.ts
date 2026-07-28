import { useEffect, useRef } from "react";

import { buildWsUrl } from "../lib/config";
import { useNotifStore } from "../store/notifications";
import { useChatStore } from "../store/chat";
import type { SystemEventType } from "../services/chat/ChatService";

const BACKOFF_MS = [1_000, 2_000, 4_000];

let _rbacEventListeners: Array<(event: string, payload: Record<string, unknown>) => void> = [];

export function addRbacEventListener(fn: (event: string, payload: Record<string, unknown>) => void) {
  _rbacEventListeners.push(fn);
  return () => {
    _rbacEventListeners = _rbacEventListeners.filter((f) => f !== fn);
  };
}

export function useRealtimeSocket(token: string | null) {
  const { fetchUnreadCount, pushToast, soundEnabled } = useNotifStore();
  const receiveWsEvent = useChatStore((s) => s.receiveWsEvent);
  const retryCount = useRef(0);
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gaveUpRef  = useRef(false);

  useEffect(() => {
    if (!token) return;
    gaveUpRef.current = false;

    let ws: WebSocket | null = null;
    let destroyed = false;

    function connect() {
      if (destroyed || gaveUpRef.current) return;
      ws = new WebSocket(buildWsUrl(token!));

      ws.onopen = () => {
        retryCount.current = 0;
      };

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data) as { event: string; payload: Record<string, unknown> };

          // RBAC events
          if (msg.event?.startsWith("rbac.")) {
            _rbacEventListeners.forEach((fn) => fn(msg.event, msg.payload));
            return;
          }

          // Audit log events
          if (msg.event === "audit_log.created") {
            _rbacEventListeners.forEach((fn) => fn(msg.event, msg.payload));
            return;
          }

          if (msg.event === "reminder_fired") {
            const p = msg.payload;
            pushToast({
              title: String(p.title ?? "Reminder"),
              message: `Priority: ${String(p.priority ?? "medium")}`,
              priority: String(p.priority ?? "medium"),
              reminder_id: p.reminder_id as number | undefined,
            });
            void fetchUnreadCount();
            _playTone(880, 0.5, soundEnabled);

          } else if (msg.event === "followup_due") {
            const p = msg.payload;
            const entityLabel = String(p.entity_type ?? "lead");
            const scheduledAt = p.scheduled_at
              ? new Date(String(p.scheduled_at)).toLocaleString(undefined, {
                  month: "short", day: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })
              : "";
            pushToast({
              title: "Follow-up Due",
              message: String(p.message ?? `Follow-up for ${entityLabel} is due`) +
                (scheduledAt ? ` — ${scheduledAt}` : ""),
              priority: "high",
            });
            _playTone(660, 0.6, soundEnabled);

          } else if (msg.event === "system_event") {
            const p = msg.payload as Record<string, string>;
            const eventType = (p.event_type ?? "GENERIC") as SystemEventType;
            receiveWsEvent(eventType, p);
          }
        } catch {
          /* malformed message — ignore silently */
        }
      };

      ws.onerror = () => {};

      ws.onclose = (evt) => {
        if (destroyed) return;

        if (evt.code === 1008) {
          console.warn("[WS] Auth rejected (1008) — not retrying");
          gaveUpRef.current = true;
          return;
        }

        const delay = BACKOFF_MS[retryCount.current];
        if (delay === undefined) {
          console.warn("[WS] Max retries reached — giving up");
          gaveUpRef.current = true;
          return;
        }
        retryCount.current += 1;
        timerRef.current = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      destroyed = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      ws?.close();
    };
  }, [token, fetchUnreadCount, pushToast, soundEnabled]);
}

function _playTone(freq: number, duration: number, enabled: boolean) {
  if (!enabled) return;
  try {
    const ctx  = new AudioContext();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch { /* audio not available */ }
}
