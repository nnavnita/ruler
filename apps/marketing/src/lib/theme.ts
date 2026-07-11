/**
 * Theme handling: "light" | "dark" | "system".
 *
 * The choice is persisted to localStorage. Applied by setting
 * `data-theme` + the `dark` class on <html> so both Tailwind
 * (`darkMode: "class"`) and the `DecisionGraphEditor` theme detector
 * see it.
 *
 * A tiny inline script in index.html applies the stored preference
 * before React hydrates, so users don't see a flash of the wrong
 * theme on load.
 */

export type ThemeChoice = "light" | "dark" | "system";

const KEY = "ruler.theme.v1";

export function loadThemeChoice(): ThemeChoice {
  if (typeof window === "undefined") return "system";
  const raw = window.localStorage.getItem(KEY);
  if (raw === "light" || raw === "dark" || raw === "system") return raw;
  return "system";
}

export function saveThemeChoice(choice: ThemeChoice): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, choice);
}

export function resolveEffective(choice: ThemeChoice): "light" | "dark" {
  if (choice === "light" || choice === "dark") return choice;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/** Push the effective theme onto <html>. Safe to call repeatedly. */
export function applyThemeToDocument(choice: ThemeChoice): void {
  if (typeof document === "undefined") return;
  const effective = resolveEffective(choice);
  const el = document.documentElement;
  el.dataset.theme = effective;
  el.classList.toggle("dark", effective === "dark");
  el.style.colorScheme = effective;
}
