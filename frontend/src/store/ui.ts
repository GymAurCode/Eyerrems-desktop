import { create } from "zustand";
import { persist } from "zustand/middleware";

type UIState = {
  sidebarOpen: boolean;
  theme: "dark" | "light";
  toggleSidebar: () => void;
  toggleTheme: () => void;
};

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      sidebarOpen: true,
      theme: "dark",
      toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),
      toggleTheme: () => {
        const next = get().theme === "dark" ? "light" : "dark";
        document.documentElement.classList.toggle("dark", next === "dark");
        document.documentElement.classList.toggle("light", next === "light");
        set({ theme: next });
      },
    }),
    {
      name: "rems-ui",
      onRehydrateStorage: () => (state) => {
        if (state) {
          document.documentElement.classList.toggle("dark", state.theme === "dark");
          document.documentElement.classList.toggle("light", state.theme === "light");
        }
      },
    }
  )
);
