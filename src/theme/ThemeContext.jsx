import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getColorPresetById, getTextTemplateById } from './designOptions';

const ThemeContext = createContext();

export function ThemeProvider({ children, config }) {
  const configTheme = config?.theme?.mode || 'light';
  const [theme, setTheme] = useState(configTheme);

  useEffect(() => {
    setTheme(configTheme);
  }, [configTheme]);

  const typography = useMemo(() => {
    const template = getTextTemplateById(config?.theme?.textTemplateId);

    return {
      headingFamily: config?.theme?.headingFamily || template.headingFamily,
      bodyFamily: config?.theme?.bodyFamily || template.bodyFamily,
      heroTitleFamily: config?.theme?.heroTitleFamily || template.heroTitleFamily || template.headingFamily,
    };
  }, [config]);

  const colors = useMemo(() => {
    const configuredColors = config?.theme?.colors?.[theme] || {};

    if (theme === 'light') {
      const presetColors = getColorPresetById(config?.theme?.preset).colors;
      return { ...presetColors, ...configuredColors };
    }

    return configuredColors;
  }, [config, theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (!colors) return;

    const root = document.documentElement;

    Object.entries(colors).forEach(([key, value]) => {
      const cssVar = `--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      root.style.setProperty(cssVar, value);
    });

    // Explicit aliases that components rely on
    if (colors.background)   root.style.setProperty('--color-bg', colors.background);
    if (colors.background)   root.style.setProperty('--color-background', colors.background);
    if (colors.surface)      root.style.setProperty('--color-surface', colors.surface);
    if (colors.text)         root.style.setProperty('--color-text', colors.text);
    if (colors.secondary)    root.style.setProperty('--color-secondary', colors.secondary);
    if (colors.border)       root.style.setProperty('--color-border', colors.border);
    if (colors.accent)       root.style.setProperty('--color-accent', colors.accent);
    if (colors.accentDark)   root.style.setProperty('--color-accent-dark', colors.accentDark);
    if (colors.accentSecondary) root.style.setProperty('--color-accent-secondary', colors.accentSecondary);
    if (colors.textMuted)    root.style.setProperty('--color-text-muted', colors.textMuted);

    root.style.setProperty('--font-heading', typography.headingFamily);
    root.style.setProperty('--font-body', typography.bodyFamily);
    root.style.setProperty('--font-hero-title', typography.heroTitleFamily);
  }, [theme, colors, typography]);

  const toggleTheme = () => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ theme, config, toggleTheme, typography }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
