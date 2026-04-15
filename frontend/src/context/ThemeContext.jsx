import { createContext, useEffect, useMemo, useState } from "react";

const THEME_STORAGE_KEY = "ai_mock_theme";
const DARK = "dark";
const LIGHT = "light";

function resolveInitialTheme() {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === DARK || stored === LIGHT) {
    return stored;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? DARK : LIGHT;
}

export const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(resolveInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === DARK,
      setTheme,
      toggleTheme: () => setTheme((prev) => (prev === DARK ? LIGHT : DARK))
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
