/**
 * Theme override core — the spine of the customization system.
 *
 * A "theme" is a small object of overrides on top of the canonical design
 * tokens (frontend/src/styles/tokens.css). applyTheme() writes them into a
 * single <style id="uup-theme-overrides"> as `:root { --token: value }`, so the
 * whole DS repaints instantly (live preview is free). The light/dark base lives
 * in tokens.css and is selected by the mode class on <html>; this layer only
 * carries user overrides on top of the chosen base.
 *
 * Pure where possible: themeToCss() is a pure function (unit-tested); applyTheme()
 * is the thin DOM side-effect around it.
 */

export type ThemeMode = 'light' | 'dark' | 'ultra-dark';

export interface ThemeBackground {
  type?: 'aura' | 'color' | 'image';
  color?: string;
  assetId?: string;
  dim?: number;   // 0..1 darken overlay over a background image
  blur?: string;  // e.g. "0px" | "8px"
}

export interface ThemeFonts {
  sans?: string;
  display?: string;
  mono?: string;
}

export interface PanelTheme {
  mode?: ThemeMode;
  /** Raw token overrides, e.g. { "--color-primary": "#3279f9" }. Written
   *  verbatim, EXCEPT --radius-scale which is expanded across the radius ramp.
   *  (--shadow-intensity is written raw — tokens.css multiplies the elevation
   *  alphas by it directly via calc(), in both light and dark.) */
  tokens?: Record<string, string | number>;
  background?: ThemeBackground;
  fonts?: ThemeFonts;
}

export const THEME_STYLE_ID = 'uup-theme-overrides';

/** Base px values of the radius ramp in tokens.css, scaled by --radius-scale. */
const RADIUS_RAMP: Record<string, number> = {
  '--radius-xs': 8,
  '--radius-sm': 12,
  '--radius-md': 16,
  '--radius-lg': 20,
  '--radius-xl': 24,
  '--radius-2xl': 28,
};

const SYNTHETIC_KEYS = new Set(['--radius-scale']);

function normalizeKey(k: string): string {
  return k.startsWith('--') ? k : `--${k}`;
}

/** A font value is either a CSS font-family list ("'Inter', sans-serif") or
 *  "asset:<id>" pointing at an uploaded font. The latter emits an @font-face. */
function resolveFont(raw: string | undefined, fallback: string, faces: string[]): string | undefined {
  if (!raw) return undefined;
  if (!raw.startsWith('asset:')) return raw;
  const id = raw.slice('asset:'.length);
  const family = `uup-font-${id.replace(/[^a-zA-Z0-9]/g, '')}`;
  faces.push(`@font-face{font-family:"${family}";font-display:swap;src:url("/theme/asset/${id}")}`);
  return `"${family}", ${fallback}`;
}

/** Build the CSS (optional @font-face rules + `:root { … }`) for a theme. Pure. */
export function themeToCss(theme: PanelTheme): string {
  const decls: string[] = [];
  const fontFaces: string[] = [];
  const push = (k: string, v: string | number) => decls.push(`${k}: ${v};`);

  if (theme.tokens) {
    for (const [rawKey, value] of Object.entries(theme.tokens)) {
      const key = normalizeKey(rawKey);
      if (SYNTHETIC_KEYS.has(key)) continue;
      if (value === null || value === undefined || value === '') continue;
      push(key, value);
    }

    const scale = Number(theme.tokens['--radius-scale']);
    if (Number.isFinite(scale) && scale > 0) {
      for (const [key, base] of Object.entries(RADIUS_RAMP)) {
        push(key, `${Math.round(base * scale)}px`);
      }
    }
  }

  const sans = resolveFont(theme.fonts?.sans, 'sans-serif', fontFaces);
  if (sans) push('--font-sans', sans);
  const display = resolveFont(theme.fonts?.display, 'var(--font-sans)', fontFaces);
  if (display) push('--font-display', display);
  const mono = resolveFont(theme.fonts?.mono, 'monospace', fontFaces);
  if (mono) push('--font-mono', mono);

  const bg = theme.background;
  if (bg) {
    if (bg.type === 'color' && bg.color) {
      push('--bg-page', bg.color);
      push('--bg-page-2', bg.color);
    }
    if (bg.type === 'image' && bg.assetId) {
      push('--bg-image', `url("/theme/asset/${bg.assetId}")`);
    }
    if (typeof bg.dim === 'number') push('--bg-image-dim', String(bg.dim));
    if (bg.blur) push('--bg-image-blur', bg.blur);
  }

  const root = decls.length ? `:root{${decls.join('')}}` : '';
  return fontFaces.join('') + root;
}

/** Select the light/dark/ultra-dark base by toggling the <html> mode classes
 *  (the same convention tokens.css and useTheme already use). */
export function applyThemeMode(mode: ThemeMode | undefined): void {
  if (typeof document === 'undefined' || !mode) return;
  const html = document.documentElement;
  html.classList.toggle('is-dark', mode === 'dark' || mode === 'ultra-dark');
  html.classList.toggle('is-ultra', mode === 'ultra-dark');
}

/** Apply token/font/background overrides into the single managed <style>. The
 *  mode class is handled separately (applyThemeMode) so it can stay coordinated
 *  with the existing theme toggle. */
export function applyTheme(theme: PanelTheme): void {
  if (typeof document === 'undefined') return;
  let el = document.getElementById(THEME_STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = THEME_STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = themeToCss(theme);

  // Make the wrapper gradient transparent so a custom background image shows.
  const hasBgImage = theme.background?.type === 'image' && Boolean(theme.background.assetId);
  document.body?.classList.toggle('has-theme-bg', hasBgImage);
}

export const EMPTY_THEME: PanelTheme = {};
