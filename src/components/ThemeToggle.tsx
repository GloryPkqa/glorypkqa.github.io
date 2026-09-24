"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

export default function ThemeToggle() {
  const theme: Theme = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("pkqa-theme-change", onChange);
      return () => window.removeEventListener("pkqa-theme-change", onChange);
    },
    (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light"),
    () => "dark",
  );

  function toggleTheme() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("pkqa-theme", next);
    window.dispatchEvent(new Event("pkqa-theme-change"));
  }

  return (
    <button className="theme-toggle" onClick={toggleTheme} aria-label={`切换到${theme === "dark" ? "浅色" : "深色"}主题`} title="切换主题">
      {theme === "dark" ? (
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 15.7A8.7 8.7 0 0 1 8.3 3.8 8.7 8.7 0 1 0 20.2 15.7Z" /></svg>
      )}
    </button>
  );
}
