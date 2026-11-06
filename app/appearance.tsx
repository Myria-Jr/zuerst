"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { isThemeMode, themeKey, type ThemeMode } from "../lib/appearance";

export function AppearancePicker() {
  const [mode, setMode] = useState<ThemeMode>("system");
  useEffect(() => {
    const update = () => {
      try {
        const saved = localStorage.getItem(themeKey);
        setMode(isThemeMode(saved) ? saved : "system");
      } catch {
        setMode("system");
      }
    };
    update();
    window.addEventListener("storage", update);
    window.addEventListener("zuerst-theme", update);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener("zuerst-theme", update);
    };
  }, []);
  function change(next: ThemeMode) {
    setMode(next);
    try {
      localStorage.setItem(themeKey, next);
    } catch {
      /* Die Wahl bleibt für diese Sitzung aktiv. */
    }
    document.documentElement.dataset.themeMode = next;
    applyTheme(next);
    window.dispatchEvent(new Event("zuerst-theme"));
  }
  return (
    <section className="j-panel w-tone-trend">
      <h2>Darstellung</h2>
      <p>Deine Farben. Zu jeder Tageszeit.</p>
      <div
        className="w-theme-picker"
        role="radiogroup"
        aria-label="Darstellung"
      >
        {(
          [
            { id: "system", name: "System", icon: Monitor },
            { id: "light", name: "Hell", icon: Sun },
            { id: "dark", name: "Dunkel", icon: Moon },
          ] as const
        ).map((item) => (
          <button
            type="button"
            role="radio"
            aria-checked={mode === item.id}
            key={item.id}
            onClick={() => change(item.id)}
          >
            <item.icon size={20} />
            {item.name}
            <Check
              size={17}
              aria-hidden="true"
              style={{ opacity: mode === item.id ? 1 : 0 }}
            />
          </button>
        ))}
      </div>
    </section>
  );
}
function applyTheme(mode: ThemeMode) {
  const resolved =
    mode === "system"
      ? matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : mode;
  document.documentElement.dataset.theme = resolved;
  document
    .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    .forEach((meta) => {
      meta.content = resolved === "dark" ? "#17151b" : "#faf8f3";
    });
}
export function ThemeObserver() {
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      const mode = document.documentElement.dataset.themeMode;
      applyTheme(isThemeMode(mode) ? mode : "system");
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return null;
}
export function AnimatedNumber({
  value,
  decimals = 0,
}: {
  value: number;
  decimals?: number;
}) {
  const [shown, setShown] = useState(value);
  const current = useRef(value);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      current.current = value;
      setShown(value);
      return;
    }
    const from = current.current,
      start = performance.now();
    let frame = 0;
    function tick(now: number) {
      const t = Math.min(1, (now - start) / 320);
      current.current = from + (value - from) * (1 - Math.pow(1 - t, 3));
      setShown(current.current);
      if (t < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return (
    <span
      className="w-number"
      aria-label={value.toLocaleString("de-DE", {
        maximumFractionDigits: decimals,
      })}
    >
      <span aria-hidden="true">
        {shown.toLocaleString("de-DE", { maximumFractionDigits: decimals })}
      </span>
    </span>
  );
}
