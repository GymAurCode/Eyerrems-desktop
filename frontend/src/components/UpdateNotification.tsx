import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, RotateCw, AlertTriangle, CheckCircle, X } from "lucide-react";

type UpdateState =
  | { type: "idle" }
  | { type: "available"; version: string; currentVersion: string }
  | { type: "downloading"; progress: number }
  | { type: "downloaded"; version: string }
  | { type: "error"; message: string; isNetworkError: boolean };

export default function UpdateNotification() {
  const [state, setState] = useState<UpdateState>({ type: "idle" });

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    api.onUpdateAvailable((data) => {
      setState({ type: "available", version: data.version, currentVersion: data.currentVersion });
    });

    api.onUpdateDownloadStarted(() => {
      setState({ type: "downloading", progress: 0 });
    });

    api.onUpdateProgress((data) => {
      setState((prev) =>
        prev.type === "downloading"
          ? { type: "downloading", progress: data.percent }
          : prev
      );
    });

    api.onUpdateDownloaded((data) => {
      setState({ type: "downloaded", version: data.version });
    });

    api.onUpdateError((data) => {
      setState({ type: "error", message: data.message, isNetworkError: data.isNetworkError });
    });
  }, []);

  const handleDownload = () => {
    window.electronAPI?.startUpdateDownload();
  };

  const handleRestart = () => {
    window.electronAPI?.restartApp();
  };

  const handleDismiss = () => {
    setState({ type: "idle" });
  };

  const handleRetry = () => {
    setState({ type: "idle" });
    window.electronAPI?.checkForUpdates();
  };

  if (state.type === "idle") return null;

  const dialogContent = () => {
    switch (state.type) {
      case "available":
        return (
          <>
            <div className="update-icon-circle" style={{ background: "rgba(59,130,246,0.15)", color: "#60A5FA" }}>
              <Download size={22} />
            </div>
            <h3 className="update-title">Update Available</h3>
            <p className="update-subtitle">
              Version <strong>{state.version}</strong> is ready to install.
            </p>
            <p className="update-detail">
              You are currently on version {state.currentVersion}.
            </p>
            <div className="update-actions">
              <button className="update-btn update-btn-secondary" onClick={handleDismiss}>
                Later
              </button>
              <button className="update-btn update-btn-primary" onClick={handleDownload}>
                <Download size={16} />
                Download Update
              </button>
            </div>
          </>
        );

      case "downloading":
        return (
          <>
            <div className="update-icon-circle" style={{ background: "rgba(59,130,246,0.15)", color: "#60A5FA" }}>
              <Download size={22} />
            </div>
            <h3 className="update-title">Downloading Update...</h3>
            <div className="update-progress-bar">
              <div className="update-progress-fill" style={{ width: `${state.progress}%` }} />
            </div>
            <span className="update-percent">{state.progress}%</span>
          </>
        );

      case "downloaded":
        return (
          <>
            <div className="update-icon-circle" style={{ background: "rgba(34,197,94,0.15)", color: "#4ADE80" }}>
              <CheckCircle size={22} />
            </div>
            <h3 className="update-title">Update Ready</h3>
            <p className="update-subtitle">
              Version <strong>{state.version}</strong> has been downloaded.
            </p>
            <p className="update-detail">
              Restart the application to apply the update.
            </p>
            <div className="update-actions">
              <button className="update-btn update-btn-secondary" onClick={handleDismiss}>
                Later
              </button>
              <button className="update-btn update-btn-primary" onClick={handleRestart}>
                <RotateCw size={16} />
                Restart Now
              </button>
            </div>
          </>
        );

      case "error":
        return (
          <>
            <div className="update-icon-circle" style={{ background: "rgba(239,68,68,0.15)", color: "#F87171" }}>
              <AlertTriangle size={22} />
            </div>
            <h3 className="update-title">Update Failed</h3>
            {state.isNetworkError ? (
              <p className="update-subtitle">
                Could not download the update. Check your connection and try again.
              </p>
            ) : (
              <p className="update-subtitle" style={{ fontSize: "12px", wordBreak: "break-word" }}>
                {state.message}
              </p>
            )}
            <div className="update-actions">
              <button className="update-btn update-btn-secondary" onClick={handleDismiss}>
                <X size={16} />
                Close
              </button>
              <button className="update-btn update-btn-primary" onClick={handleRetry}>
                <RotateCw size={16} />
                Try Again
              </button>
            </div>
          </>
        );
    }
  };

  return createPortal(
    <div className="update-backdrop">
      <div className="update-dialog">
        <button className="update-close" onClick={handleDismiss} aria-label="Close">
          <X size={16} />
        </button>
        {dialogContent()}
      </div>
    </div>,
    document.body
  );
}
