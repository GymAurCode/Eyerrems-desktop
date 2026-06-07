import { useEffect, useState } from "react";

export default function UpdateNotification() {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (window.electronAPI?.getAppVersion) {
      window.electronAPI.getAppVersion().then((v: string) => { /* noop */ });
    }

    if (window.electronAPI?.onUpdateDownloadStarted) {
      window.electronAPI.onUpdateDownloadStarted(() => {
        setDownloading(true);
        setProgress(0);
      });
    }

    if (window.electronAPI?.onUpdateProgress) {
      window.electronAPI.onUpdateProgress((data: { percent: number }) => {
        setProgress(data.percent);
      });
    }
  }, []);

  if (!downloading) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        padding: "10px 20px",
        background: "var(--bg-surface)",
        borderTop: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        zIndex: 9999,
        fontSize: "13px",
        color: "var(--text-primary)",
      }}
    >
      <span>Downloading update...</span>
      <div
        style={{
          flex: 1,
          height: "6px",
          background: "var(--border)",
          borderRadius: "3px",
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: "100%",
            background: "#3B82F6",
            borderRadius: "3px",
            transition: "width 0.3s ease",
          }}
        />
      </div>
      <span style={{ minWidth: "40px", textAlign: "right" }}>{progress}%</span>
    </div>
  );
}
