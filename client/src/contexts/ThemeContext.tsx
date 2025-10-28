import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Theme, themes, applyTheme, getStoredTheme } from '@/lib/themes';

interface ThemeContextType {
  currentTheme: Theme;
  setTheme: (theme: Theme) => void;
  availableThemes: Theme[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<Theme>('standard');

  useEffect(() => {
    // Initialize theme on mount
    const storedTheme = getStoredTheme();
    setCurrentTheme(storedTheme);
    applyTheme(storedTheme);
  }, []);

  const setTheme = (theme: Theme) => {
    setCurrentTheme(theme);
    applyTheme(theme);
  };

  const availableThemes: Theme[] = ['standard', 'ocean', 'forest', 'graphite'];

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme, availableThemes }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
