import { useTheme } from "../hooks/useTheme";

export function ThemeToggleButton() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      className={`theme-toggle ${isDark ? "dark" : "light"}`}
      onClick={toggleTheme}
      aria-label="Toggle dark and light theme"
      title="Toggle theme"
    >
      <span className="theme-toggle-track" />
      <span className="theme-toggle-thumb">{isDark ? "🌙" : "☀️"}</span>
    </button>
  );
}
