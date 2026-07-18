let _formatter: Intl.NumberFormat | null = null;
let _formatterCode: string | null = null;

function getFormatter(code: string): Intl.NumberFormat {
  if (_formatter && _formatterCode === code) return _formatter;
  _formatterCode = code;
  _formatter = new Intl.NumberFormat(code === "PKR" ? "en-PK" : "en-US", {
    style: "currency",
    currency: code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return _formatter;
}

export function formatCurrency(amount: number | string, currencyCode?: string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "-";
  const code = currencyCode || localStorage.getItem("currency_code") || "PKR";
  try {
    return getFormatter(code).format(num);
  } catch {
    return `${code} ${num.toLocaleString()}`;
  }
}
