import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { theme as antdTheme } from 'antd';
import type { ThemeConfig } from 'antd';

const STORAGE_DARK = 'dark-mode';
const STORAGE_ULTRA = 'isUltraDarkThemeEnabled';

function readBool(key: string, fallback: boolean): boolean {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  return raw === 'true';
}

function applyDom(isDark: boolean, isUltra: boolean) {
  document.body.setAttribute('class', isDark ? 'dark' : 'light');
  if (isUltra) {
    document.documentElement.setAttribute('data-theme', 'ultra-dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  const msg = document.getElementById('message');
  if (msg) msg.className = isDark ? 'dark' : 'light';
}

// Reset localStorage cache to default to Google Antigravity Light Theme on first load of this session
const CACHE_RESET_KEY = 'antigravity-reset-v3';
if (localStorage.getItem(CACHE_RESET_KEY) !== 'true') {
  localStorage.setItem(STORAGE_DARK, 'false');
  localStorage.setItem(STORAGE_ULTRA, 'false');
  localStorage.setItem(CACHE_RESET_KEY, 'true');
}

// module load so the document is in the right theme before React mounts.
const initialDark = readBool(STORAGE_DARK, false);
const initialUltra = readBool(STORAGE_ULTRA, false);
applyDom(initialDark, initialUltra);

const DARK_TOKENS = {
  colorPrimary: '#3279F9', // Google Blue
  colorSuccess: '#34A853', // Google Green
  colorWarning: '#FBBC05', // Google Yellow
  colorError: '#EA4335',   // Google Red
  colorBgBase: '#0b0c10',
  colorBgLayout: '#07070a',
  colorBgContainer: '#15161d',
  colorBgElevated: '#1a1c24',
  colorBorder: '#232530',
  colorTextBase: '#f3f4f6',
  borderRadius: 24,
  fontFamily: 'Plus Jakarta Sans, Outfit, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontFamilyCode: '"Fira Code", "JetBrains Mono", Menlo, Monaco, Consolas, monospace',
};
const ULTRA_DARK_TOKENS = {
  colorPrimary: '#3279F9', // Google Blue
  colorSuccess: '#34A853',
  colorWarning: '#FBBC05',
  colorError: '#EA4335',
  colorBgBase: '#000000',
  colorBgLayout: '#000000',
  colorBgContainer: '#0c0c0e',
  colorBgElevated: '#121215',
  colorBorder: '#1c1c22',
  colorTextBase: '#e5e7eb',
  borderRadius: 24,
  fontFamily: 'Plus Jakarta Sans, Outfit, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontFamilyCode: '"Fira Code", "JetBrains Mono", Menlo, Monaco, Consolas, monospace',
};
const DARK_LAYOUT_TOKENS = {
  bodyBg: '#07070a',
  headerBg: '#0b0c10',
  headerColor: '#ffffff',
  footerBg: '#07070a',
  siderBg: '#0b0c10',
  triggerBg: '#15161d',
  triggerColor: '#ffffff',
};
const ULTRA_DARK_LAYOUT_TOKENS = {
  bodyBg: '#000000',
  headerBg: '#000000',
  headerColor: '#ffffff',
  footerBg: '#000000',
  siderBg: '#000000',
  triggerBg: '#0c0c0e',
  triggerColor: '#ffffff',
};
const DARK_MENU_TOKENS = {
  darkItemBg: '#0b0c10',
  darkSubMenuItemBg: '#15161d',
  darkPopupBg: '#15161d',
};
const ULTRA_DARK_MENU_TOKENS = {
  darkItemBg: '#000000',
  darkSubMenuItemBg: '#0c0c0e',
  darkPopupBg: '#0c0c0e',
};
const DARK_CARD_TOKENS = {
  colorBorderSecondary: 'rgba(255, 255, 255, 0.05)',
};
const ULTRA_DARK_CARD_TOKENS = {
  colorBorderSecondary: 'rgba(255, 255, 255, 0.03)',
};
const STATISTIC_TOKENS = {
  contentFontSize: 17,
  titleFontSize: 11,
};

export function buildAntdThemeConfig(isDark: boolean, isUltra: boolean): ThemeConfig {
  if (!isDark) {
    return {
      algorithm: antdTheme.defaultAlgorithm,
      token: {
        colorPrimary: '#3279F9', // Google Blue
        colorSuccess: '#34A853', // Google Green
        colorWarning: '#FBBC05', // Google Yellow
        colorError: '#EA4335',   // Google Red
        fontFamily: 'Plus Jakarta Sans, Outfit, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        fontFamilyCode: '"Fira Code", "JetBrains Mono", Menlo, Monaco, Consolas, monospace',
        borderRadius: 24,
      },
      components: {
        Button: {
          borderRadius: 9999, // Pill shaped buttons
          controlHeight: 40,
          fontWeight: 500,
        },
        Input: {
          borderRadius: 9999, // Pill shape
          controlHeight: 40,
        },
        InputNumber: {
          borderRadius: 9999,
          controlHeight: 40,
        },
        Select: {
          borderRadius: 9999,
          controlHeight: 40,
        },
        Card: {
          borderRadiusLG: 24,
        },
        Table: {
          borderRadius: 16,
        },
        Statistic: STATISTIC_TOKENS,
      },
    };
  }
  return {
    algorithm: antdTheme.darkAlgorithm,
    token: isUltra ? ULTRA_DARK_TOKENS : DARK_TOKENS,
    components: {
      Layout: isUltra ? ULTRA_DARK_LAYOUT_TOKENS : DARK_LAYOUT_TOKENS,
      Menu: isUltra ? ULTRA_DARK_MENU_TOKENS : DARK_MENU_TOKENS,
      Card: isUltra ? ULTRA_DARK_CARD_TOKENS : DARK_CARD_TOKENS,
      Button: {
        borderRadius: 9999,
        controlHeight: 40,
        fontWeight: 500,
      },
      Input: {
        borderRadius: 9999,
        controlHeight: 40,
      },
      InputNumber: {
        borderRadius: 9999,
        controlHeight: 40,
      },
      Select: {
        borderRadius: 9999,
        controlHeight: 40,
      },
      Table: {
        borderRadius: 16,
      },
      Statistic: STATISTIC_TOKENS,
    },
  };
}

export function pauseAnimationsUntilLeave(elementId: string): void {
  document.documentElement.setAttribute('data-theme-animations', 'off');
  const el = document.getElementById(elementId);
  if (!el) return;
  const restore = () => {
    document.documentElement.removeAttribute('data-theme-animations');
    el.removeEventListener('mouseleave', restore);
    el.removeEventListener('touchend', restore);
  };
  el.addEventListener('mouseleave', restore);
  el.addEventListener('touchend', restore);
}

interface ThemeContextValue {
  isDark: boolean;
  isUltra: boolean;
  toggleTheme: () => void;
  toggleUltra: () => void;
  antdThemeConfig: ThemeConfig;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState<boolean>(initialDark);
  const [isUltra, setIsUltra] = useState<boolean>(initialUltra);

  useEffect(() => {
    applyDom(isDark, isUltra);
    localStorage.setItem(STORAGE_DARK, String(isDark));
    localStorage.setItem(STORAGE_ULTRA, String(isUltra));
  }, [isDark, isUltra]);

  const toggleTheme = useCallback(() => setIsDark((v) => !v), []);
  const toggleUltra = useCallback(() => setIsUltra((v) => !v), []);

  const antdThemeConfig = useMemo(() => buildAntdThemeConfig(isDark, isUltra), [isDark, isUltra]);

  const value = useMemo<ThemeContextValue>(
    () => ({ isDark, isUltra, toggleTheme, toggleUltra, antdThemeConfig }),
    [isDark, isUltra, toggleTheme, toggleUltra, antdThemeConfig],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
