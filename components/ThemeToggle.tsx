"use client";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.dataset.theme === "dark"), []);
  function toggle() {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch {}
    setDark(!dark);
  }
  return (
    <button type="button" onClick={toggle} aria-pressed={dark}
      className="h-10 rounded-full border border-line px-4 text-sm text-ink hover:bg-soft">
      {dark ? "Light mode" : "Dark mode"}
    </button>
  );
}
