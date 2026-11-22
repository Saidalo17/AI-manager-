"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    let t = document.documentElement.dataset.theme;
    try {
      t = localStorage.getItem("theme") ?? t;
    } catch {}
    t = t === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = t;
    setDark(t === "dark");
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Включить светлую тему" : "Включить тёмную тему"}
      title={dark ? "Светлая тема" : "Тёмная тема"}
      className="fixed right-4 top-4 z-[60] grid h-10 w-10 place-items-center rounded-full border border-line bg-panel text-lg shadow-[0_6px_20px_-8px_rgb(91_91_240/.5)]"
    >
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
