/**
 * Curoco — Theme Provider
 * Locked to light theme for unified luxury aesthetic
 */

import React, { createContext, useContext } from 'react';
import { LightTheme, type Theme } from './colors';

interface ThemeContextValue {
  theme: Theme;
  mode: 'light';
  isDark: false;
  setMode: (mode: 'light') => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: LightTheme,
  mode: 'light',
  isDark: false,
  setMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeContext.Provider value={{ theme: LightTheme, mode: 'light', isDark: false, setMode: () => {} }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
