// src/components/ThemeProvider.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

interface ThemeProviderState {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

const initialState: ThemeProviderState = {
  theme: 'system',
  resolvedTheme: 'light', // Default, will be updated by useEffect
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'metric-daily-theme',
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') {
      return defaultTheme;
    }
    try {
      const storedTheme = window.localStorage.getItem(storageKey);
      return (storedTheme as Theme) || defaultTheme;
    } catch (e) {
      // console.error('Error reading theme from localStorage', e);
      return defaultTheme;
    }
  });

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') {
        // Fallback for SSR: can't know system preference.
        // This will be corrected on client mount.
        return defaultTheme === 'dark' ? 'dark' : 'light';
    }
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    let currentResolvedTheme: 'light' | 'dark';
    if (theme === 'system') {
      currentResolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } else {
      currentResolvedTheme = theme;
    }

    root.classList.add(currentResolvedTheme);
    setResolvedTheme(currentResolvedTheme); // Update state for consumers

    try {
      window.localStorage.setItem(storageKey, theme);
    } catch (e) {
      // console.error('Error saving theme to localStorage', e);
    }
  }, [theme, storageKey]);

  // Listener for system theme changes
  useEffect(() => {
    if (theme !== 'system' || typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const newResolvedTheme = mediaQuery.matches ? 'dark' : 'light';
      setResolvedTheme(newResolvedTheme); // Update state for consumers
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(newResolvedTheme);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]); // Rerun if the user explicitly changes theme to/from 'system'


  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeProviderContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
