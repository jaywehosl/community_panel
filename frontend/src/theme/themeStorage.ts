/**
 * Theme persistence — server-canonical with a localStorage fallback.
 *
 * Canonical store is the server (`GET /theme.json`, `POST /panel/setting/theme`).
 * localStorage is kept as a fast cache (no-flash on boot) AND as a graceful
 * fallback when the backend doesn't expose the endpoints yet (e.g. dev proxying
 * to an older panel) — so the Appearance page stays usable everywhere.
 */
import { applyTheme, applyThemeMode, type PanelTheme } from './themeApply';
import { HttpUtil } from '@/utils';

const STORAGE_KEY = 'uup.panelTheme';
const basePath = () => (typeof window !== 'undefined' && window.X_UI_BASE_PATH) || '/';

export function loadTheme(): PanelTheme {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PanelTheme) : {};
  } catch {
    return {};
  }
}

function cacheLocal(theme: PanelTheme): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
  } catch {
    /* ignore quota / disabled storage */
  }
}

export function clearTheme(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Read the server theme. Returns null when unreachable / not a theme object. */
export async function fetchServerTheme(): Promise<PanelTheme | null> {
  try {
    const res = await fetch(basePath() + 'theme.json', { cache: 'no-cache' });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    return data && typeof data === 'object' && !Array.isArray(data) ? (data as PanelTheme) : null;
  } catch {
    return null;
  }
}

/** Persist a theme: cache locally immediately, then push to the server. Returns
 *  true when the server accepted it (false → kept locally only). */
export async function saveTheme(theme: PanelTheme): Promise<boolean> {
  cacheLocal(theme);
  try {
    const msg = await HttpUtil.post('/panel/setting/theme', theme, { silent: true });
    return Boolean(msg && (msg as { success?: boolean }).success);
  } catch {
    return false;
  }
}

/** Apply the cached theme synchronously at boot (no flash), then prefer the
 *  server copy once it loads. */
export function bootstrapTheme(): void {
  const local = loadTheme();
  applyTheme(local);
  if (local.mode) applyThemeMode(local.mode);

  void fetchServerTheme().then((srv) => {
    if (srv && Object.keys(srv).length) {
      cacheLocal(srv);
      applyTheme(srv);
      if (srv.mode) applyThemeMode(srv.mode);
    }
  });
}
