import { useEffect, useState } from "react";
import {
  applyThemeToDocument,
  loadThemeChoice,
  saveThemeChoice,
  type ThemeChoice,
} from "./lib/theme";

const OPTIONS: { value: ThemeChoice; label: string; icon: string }[] = [
  { value: "light", label: "Light", icon: "☀" },
  { value: "dark", label: "Dark", icon: "☾" },
  { value: "system", label: "System", icon: "⌘" },
];

export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>("system");

  useEffect(() => {
    const initial = loadThemeChoice();
    setChoice(initial);
    applyThemeToDocument(initial);

    // Re-apply if the system theme flips while "system" is picked.
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onMediaChange = () => {
      if (loadThemeChoice() === "system") applyThemeToDocument("system");
    };
    media.addEventListener("change", onMediaChange);
    return () => media.removeEventListener("change", onMediaChange);
  }, []);

  const pick = (next: ThemeChoice) => {
    setChoice(next);
    saveThemeChoice(next);
    applyThemeToDocument(next);
  };

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="flex overflow-hidden rounded-md border border-slate-300 text-xs dark:border-slate-700"
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={choice === o.value}
          onClick={() => pick(o.value)}
          title={o.label}
          className={
            "px-2.5 py-1 " +
            (choice === o.value
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800")
          }
        >
          <span aria-hidden="true">{o.icon}</span>
          <span className="sr-only">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
