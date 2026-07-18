import { useNotifStore } from "../store/notifications";

let _push: ReturnType<typeof useNotifStore.getState>["pushToast"] | null = null;

function getPush() {
  if (!_push) _push = useNotifStore.getState().pushToast;
  return _push;
}

export const toastService = {
  success(title: string, message?: string) {
    getPush()({ title, message: message || "", type: "success" });
  },
  error(title: string, message?: string) {
    getPush()({ title, message: message || "", type: "error" });
  },
  warning(title: string, message?: string) {
    getPush()({ title, message: message || "", type: "warning" });
  },
  info(title: string, message?: string) {
    getPush()({ title, message: message || "", type: "info" });
  },
};
