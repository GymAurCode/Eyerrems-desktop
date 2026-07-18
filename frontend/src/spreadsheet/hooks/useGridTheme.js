import { useEffect, useRef, useState } from "react";
import { getGridTheme } from "../render/GridTheme";

export function useGridTheme() {
  const [theme, setTheme] = useState(getGridTheme);
  const observerRef = useRef(null);

  useEffect(() => {
    const update = () => setTheme(getGridTheme());

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "attributes" && m.attributeName === "class") {
          update();
          break;
        }
      }
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    observerRef.current = observer;

    window.addEventListener("themechange", update);

    return () => {
      observer.disconnect();
      window.removeEventListener("themechange", update);
    };
  }, []);

  return theme;
}
