export default function StatusBar({ info }) {
  if (!info) return null;
  return (
    <div className="ss-status-bar">
      {info.count !== undefined && (
        <span className="ss-status-item">
          Count: <strong>{info.count}</strong>
        </span>
      )}
      {info.sum !== undefined && info.sum !== null && !isNaN(info.sum) && (
        <span className="ss-status-item">
          Sum: <strong>{Number(info.sum).toFixed(2)}</strong>
        </span>
      )}
      {info.average !== undefined && info.average !== null && !isNaN(info.average) && (
        <span className="ss-status-item">
          Avg: <strong>{Number(info.average).toFixed(2)}</strong>
        </span>
      )}
    </div>
  );
}
