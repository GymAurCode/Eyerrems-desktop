export function formatNumber(value, format) {
  if (value === undefined || value === null || value === "") return "";
  const num = parseFloat(value);
  if (isNaN(num)) return String(value);

  switch (format) {
    case "number":
      return num.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    case "currency":
      return num.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
      });
    case "percentage":
      return (
        (num * 100).toLocaleString("en-US", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }) + "%"
      );
    case "date": {
      const d = new Date((num - 25569) * 86400 * 1000);
      return d.toLocaleDateString("en-US");
    }
    case "time": {
      const t = new Date((num - 25569) * 86400 * 1000);
      return t.toLocaleTimeString("en-US");
    }
    case "scientific":
      return num.toExponential(2);
    default:
      return String(value);
  }
}

export const NUMBER_FORMATS = [
  { value: "general", label: "General" },
  { value: "number", label: "Number" },
  { value: "currency", label: "Currency" },
  { value: "percentage", label: "Percentage" },
  { value: "date", label: "Date" },
  { value: "time", label: "Time" },
  { value: "scientific", label: "Scientific" },
];
