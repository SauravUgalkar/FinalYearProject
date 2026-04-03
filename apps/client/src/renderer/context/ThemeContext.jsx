import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext({ theme: 'dark', toggleTheme: () => {} });

/**
 * ThemeProvider wraps the app and manages dark/light theme state.
 * - Persists the selected theme in localStorage under the key 'cc-theme'.
 * - Applies 'dark' or 'light' class to <html> so CSS selectors can target
 *   html.dark / html.light throughout the stylesheet.
 * - Renders a full-screen ripple overlay that starts from the button position
 *   and expands like a circle (clip-path animation) to reveal the new theme.
 */
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('cc-theme') || 'dark');

  // { x, y, bg } — position of the click and overlay background colour.
  const [ripple, setRipple] = useState(null);

  // Keep <html> class in sync with theme state.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    root.classList.add(theme);
    localStorage.setItem('cc-theme', theme);
  }, [theme]);

  /**
   * Toggles the theme with a ripple-from-cursor animation.
   * The overlay colour matches the incoming theme's background so the
   * expanding circle "reveals" the new look as it spreads.
   *
   * @param {React.MouseEvent} [event] - the click event (used for ripple origin)
   */
  const toggleTheme = (event) => {
    const x = event?.clientX ?? window.innerWidth / 2;
    const y = event?.clientY ?? window.innerHeight / 2;

    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    // Choose overlay colour that matches the destination theme.
    const overlayBg = nextTheme === 'light' ? '#f8fafc' : '#020617';

    setRipple({ x, y, bg: overlayBg });

    // Switch the real theme early so elements beneath the overlay already
    // have the new styles before the overlay fades out.
    setTimeout(() => setTheme(nextTheme), 80);

    // Remove the overlay once the CSS animation finishes (~650 ms).
    setTimeout(() => setRipple(null), 700);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}

      {/* Full-screen ripple overlay — animated via .theme-ripple-overlay in index.css */}
      {ripple && (
        <div
          aria-hidden="true"
          className="theme-ripple-overlay"
          style={{
            '--ripple-x': `${ripple.x}px`,
            '--ripple-y': `${ripple.y}px`,
            backgroundColor: ripple.bg,
          }}
        />
      )}
    </ThemeContext.Provider>
  );
}

/** Convenience hook — use this in any component to read theme or call toggleTheme. */
export const useTheme = () => useContext(ThemeContext);
