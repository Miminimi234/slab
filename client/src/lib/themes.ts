export type Theme = 'standard' | 'ocean' | 'forest' | 'graphite';

export interface ThemeConfig {
  name: string;
  description: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    card: string;
    border: string;
    text: string;
    muted: string;
    success: string;
    warning: string;
    destructive: string;
  };
}

export const themes: Record<Theme, ThemeConfig> = {
  standard: {
    name: 'Standard',
    description: 'Warm beige theme',
    colors: {
      primary: '28 96% 44%', // warm amber
      secondary: '166 76% 34%', // teal green
      accent: '258 90% 58%', // purple
      background: '43 30% 97%', // soft warm white
      card: '0 0% 100%', // pure white
      border: '30 20% 88%', // soft beige border
      text: '20 10% 9%', // almost black, warm tone
      muted: '20 6% 45%', // medium gray
      success: '166 76% 34%', // teal green
      warning: '38 92% 50%', // amber
      destructive: '0 72% 51%', // red
    }
  },
  ocean: {
    name: 'Ocean',
    description: 'Deep blue ocean theme',
    colors: {
      primary: '188 94% 43%', // cyan-500
      secondary: '188 85% 35%', // cyan-600
      accent: '199 89% 48%', // sky-500
      background: '200 40% 92%', // softer blue-gray background
      card: '200 20% 98%', // very light blue-white cards
      border: '200 30% 85%', // light blue border
      text: '200 50% 15%', // dark blue-gray text
      muted: '200 20% 60%', // medium blue-gray
      success: '142 76% 36%', // green-500
      warning: '38 92% 50%', // amber-500
      destructive: '0 84% 60%', // red-500
    }
  },
  forest: {
    name: 'Forest',
    description: 'Natural green forest theme',
    colors: {
      primary: '142 76% 36%', // emerald-500
      secondary: '142 76% 28%', // emerald-600
      accent: '142 76% 50%', // emerald-400
      background: '120 25% 92%', // softer green-gray background
      card: '120 15% 98%', // very light green-white cards
      border: '120 20% 85%', // light green border
      text: '120 30% 15%', // dark green-gray text
      muted: '120 15% 60%', // medium green-gray
      success: '142 76% 36%', // green-500
      warning: '45 93% 47%', // yellow-500
      destructive: '0 84% 60%', // red-500
    }
  },
  graphite: {
    name: 'Graphite',
    description: 'Dark graphite theme',
    colors: {
      primary: '28 96% 44%', // warm amber (same as standard)
      secondary: '166 76% 34%', // teal green
      accent: '258 90% 58%', // purple
      background: '0 0% 6%', // very dark graphite background
      card: '0 0% 10%', // dark graphite cards
      border: '0 0% 18%', // medium graphite border
      text: '0 0% 98%', // very light gray text for better contrast
      muted: '0 0% 85%', // much lighter gray - almost white for better readability
      success: '142 76% 36%', // green-500
      warning: '38 92% 50%', // amber-500
      destructive: '0 84% 60%', // red-500
    }
  }
};

export function getThemeCSSVariables(theme: Theme): string {
  const themeConfig = themes[theme];
  return `
    --primary: ${themeConfig.colors.primary};
    --secondary: ${themeConfig.colors.secondary};
    --accent: ${themeConfig.colors.accent};
    --background: ${themeConfig.colors.background};
    --card: ${themeConfig.colors.card};
    --border: ${themeConfig.colors.border};
    --text: ${themeConfig.colors.text};
    --muted: ${themeConfig.colors.muted};
    --success: ${themeConfig.colors.success};
    --warning: ${themeConfig.colors.warning};
    --destructive: ${themeConfig.colors.destructive};
  `;
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const themeConfig = themes[theme];

  // Apply HSL values directly to CSS variables
  root.style.setProperty('--primary', themeConfig.colors.primary);
  root.style.setProperty('--secondary', themeConfig.colors.secondary);
  root.style.setProperty('--accent', themeConfig.colors.accent);
  root.style.setProperty('--background', themeConfig.colors.background);
  root.style.setProperty('--card', themeConfig.colors.card);
  root.style.setProperty('--border', themeConfig.colors.border);
  root.style.setProperty('--foreground', themeConfig.colors.text);
  root.style.setProperty('--muted', themeConfig.colors.muted);
  root.style.setProperty('--muted-foreground', themeConfig.colors.text); // Use main text color for muted text
  root.style.setProperty('--success', themeConfig.colors.success);
  root.style.setProperty('--warning', themeConfig.colors.warning);
  root.style.setProperty('--destructive', themeConfig.colors.destructive);

  // Set data attribute for theme-specific CSS overrides
  root.setAttribute('data-theme', theme);

  // For graphite theme, ensure all text is either white or orange
  if (theme === 'graphite') {
    root.style.setProperty('--card-foreground', themeConfig.colors.text);
    root.style.setProperty('--popover-foreground', themeConfig.colors.text);
    root.style.setProperty('--sidebar-foreground', themeConfig.colors.text);
    root.style.setProperty('--sidebar-accent-foreground', themeConfig.colors.text);
  }

  // Save to localStorage
  localStorage.setItem('slab-theme', theme);
}

export function getStoredTheme(): Theme {
  const stored = localStorage.getItem('slab-theme');
  return (stored as Theme) || 'standard';
}

export function initializeTheme() {
  const theme = getStoredTheme();
  applyTheme(theme);
  return theme;
}
