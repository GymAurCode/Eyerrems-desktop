/**
 * Global Currency Store
 *
 * Manages the active currency for the entire application.
 * Currency is loaded from the backend on login/bootstrap and can be
 * updated by admins via Settings → System Settings → Currency Settings.
 *
 * Supported currencies:
 *   PKR  ₨  Pakistani Rupee
 *   USD  $   US Dollar
 */
import { create } from "zustand";
import { api } from "../lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CurrencyCode = "PKR" | "USD";

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  locale: string;
  label: string;
}

export const CURRENCY_OPTIONS: CurrencyConfig[] = [
  { code: "PKR", symbol: "₨", locale: "en-PK", label: "PKR - Pakistani Rupee (₨)" },
  { code: "USD", symbol: "$",  locale: "en-US", label: "USD - US Dollar ($)" },
];

export function getCurrencyConfig(code: CurrencyCode): CurrencyConfig {
  return CURRENCY_OPTIONS.find((c) => c.code === code) ?? CURRENCY_OPTIONS[0];
}

// ── Store ─────────────────────────────────────────────────────────────────────

type CurrencyState = {
  currencyCode: CurrencyCode;
  /** Load currency from backend (called on bootstrap / login) */
  loadCurrency: () => Promise<void>;
  /** Save currency to backend and update local state */
  saveCurrency: (code: CurrencyCode) => Promise<void>;
  /** Directly set currency (used when backend returns it inline) */
  setCurrency: (code: CurrencyCode) => void;
};

export const useCurrencyStore = create<CurrencyState>((set) => ({
  // Default to PKR — will be overwritten by loadCurrency() on boot
  currencyCode: (localStorage.getItem("currency_code") as CurrencyCode) ?? "PKR",

  loadCurrency: async () => {
    try {
      const { data } = await api.get<{ currency_code: string }>("/company/currency");
      const code = (data.currency_code as CurrencyCode) ?? "PKR";
      localStorage.setItem("currency_code", code);
      set({ currencyCode: code });
    } catch {
      // Non-fatal — keep existing value
    }
  },

  saveCurrency: async (code: CurrencyCode) => {
    await api.patch("/company/currency", { currency_code: code });
    localStorage.setItem("currency_code", code);
    set({ currencyCode: code });
  },

  setCurrency: (code: CurrencyCode) => {
    localStorage.setItem("currency_code", code);
    set({ currencyCode: code });
  },
}));
