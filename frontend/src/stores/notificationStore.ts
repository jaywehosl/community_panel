/**
 * Notification subsystem store (framework-agnostic module store, same pattern as
 * the DS Toast store). It is the single home for:
 *
 *   • history  — every notification ever recorded (toasts + dismissed live
 *                alerts), newest first, capped, persisted to localStorage.
 *   • dismissed — keys of LIVE alerts the user has X-ed away; a dismissed live
 *                alert never reappears in the header strip (it lives in history).
 *   • prefs    — per-category enable flags for the live alerts (the Notifications
 *                tab in Appearance toggles these).
 *
 * Live alerts (port/path/xray/restart) are derived state computed in
 * useNotifications; this store only tracks which the user has silenced + logs
 * them into history when dismissed. Transient toasts are mirrored here via
 * recordToast() so the user has a scrollback log (the header only shows ACTIVE
 * live alerts; the full log lives in Appearance → Notifications).
 */

export type Severity = 'danger' | 'warning' | 'info';
export type NotifSource = 'toast' | 'alert';

/** Live-alert categories that can be toggled on/off in the Notifications tab. */
export type AlertCategory = 'security' | 'xray' | 'restart';

export interface NotifRecord {
  id: string;
  /** the live-alert key (only for source==='alert') — ties a history row back
   *  to the dismissed set so it can be restored. */
  key?: string;
  severity: Severity;
  text: string;
  source: NotifSource;
  ts: number;
}

export interface AlertPrefs {
  security: boolean;
  xray: boolean;
  restart: boolean;
}

/** Threshold sensors evaluated against the polled server `status` (Phase 2).
 *  Edge-triggered: each fires once on the false→true crossing and re-arms when
 *  the value drops back below the threshold. */
export type SensorKey = 'cpu' | 'mem' | 'disk' | 'sockets' | 'uptimeDays';
export interface SensorConfig { enabled: boolean; threshold: number }
export type SensorPrefs = Record<SensorKey, SensorConfig>;

interface NotifState {
  history: NotifRecord[];
  dismissed: string[];
  prefs: AlertPrefs;
  sensors: SensorPrefs;
}

const HISTORY_KEY = 'uup.notifications.history';
const DISMISSED_KEY = 'uup.notifications.dismissed';
const PREFS_KEY = 'uup.notifications.prefs';
const SENSORS_KEY = 'uup.notifications.sensors';
const HISTORY_CAP = 200;

const DEFAULT_PREFS: AlertPrefs = { security: true, xray: true, restart: true };

// CPU + disk default ON (genuinely useful, low false-positive, edge-triggered so
// at most one toast per crossing); the rest opt-in via the Notifications tab.
const DEFAULT_SENSORS: SensorPrefs = {
  cpu: { enabled: true, threshold: 80 },        // % busy
  mem: { enabled: false, threshold: 90 },       // % used
  disk: { enabled: true, threshold: 90 },       // % used
  sockets: { enabled: false, threshold: 5000 }, // open TCP sockets
  uptimeDays: { enabled: false, threshold: 30 },// system uptime in days
};

function loadHistory(): NotifRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(arr) ? (arr as NotifRecord[]) : [];
  } catch {
    return [];
  }
}
function loadDismissed(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(arr) ? (arr as string[]) : [];
  } catch {
    return [];
  }
}
function loadPrefs(): AlertPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    const obj = raw ? (JSON.parse(raw) as Partial<AlertPrefs>) : null;
    return obj ? { ...DEFAULT_PREFS, ...obj } : { ...DEFAULT_PREFS };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}
function loadSensors(): SensorPrefs {
  try {
    const raw = localStorage.getItem(SENSORS_KEY);
    const obj = raw ? (JSON.parse(raw) as Partial<SensorPrefs>) : null;
    if (!obj) return structuredClone(DEFAULT_SENSORS);
    // Merge per-key so a new sensor added in a later build still gets a default.
    const merged = structuredClone(DEFAULT_SENSORS);
    (Object.keys(merged) as SensorKey[]).forEach((k) => {
      if (obj[k]) merged[k] = { ...merged[k], ...obj[k] };
    });
    return merged;
  } catch {
    return structuredClone(DEFAULT_SENSORS);
  }
}

let state: NotifState = {
  history: typeof localStorage !== 'undefined' ? loadHistory() : [],
  dismissed: typeof localStorage !== 'undefined' ? loadDismissed() : [],
  prefs: typeof localStorage !== 'undefined' ? loadPrefs() : { ...DEFAULT_PREFS },
  sensors: typeof localStorage !== 'undefined' ? loadSensors() : structuredClone(DEFAULT_SENSORS),
};

const listeners = new Set<() => void>();
let seq = 0;

function emit() {
  listeners.forEach((l) => l());
}
function persist() {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history));
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(state.dismissed));
    localStorage.setItem(PREFS_KEY, JSON.stringify(state.prefs));
    localStorage.setItem(SENSORS_KEY, JSON.stringify(state.sensors));
  } catch {
    /* ignore quota / disabled storage */
  }
}
function commit(next: NotifState) {
  state = next;
  persist();
  emit();
}

export function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
export function getSnapshot(): NotifState {
  return state;
}

function newId(): string {
  return `n${Date.now().toString(36)}-${(++seq).toString(36)}`;
}

function pushHistory(rec: Omit<NotifRecord, 'id' | 'ts'> & { ts?: number }): void {
  const full: NotifRecord = { id: newId(), ts: rec.ts ?? Date.now(), ...rec };
  const history = [full, ...state.history].slice(0, HISTORY_CAP);
  commit({ ...state, history });
}

/** Mirror a transient toast into the history log. Only string content is logged
 *  (rich ReactNode toasts are skipped — they can't be replayed in a log). */
export function recordToast(severity: Severity, text: string): void {
  if (!text) return;
  pushHistory({ severity, text, source: 'toast' });
}

/** X a live alert: silence it forever (per key) and drop it into history. */
export function dismissAlert(key: string, severity: Severity, text: string): void {
  const dismissed = state.dismissed.includes(key) ? state.dismissed : [...state.dismissed, key];
  const full: NotifRecord = { id: newId(), ts: Date.now(), key, severity, text, source: 'alert' };
  const history = [full, ...state.history].slice(0, HISTORY_CAP);
  commit({ ...state, dismissed, history });
}

/** Un-silence a previously dismissed live alert (it will reappear if still live). */
export function restoreAlert(key: string): void {
  if (!state.dismissed.includes(key)) return;
  commit({ ...state, dismissed: state.dismissed.filter((k) => k !== key) });
}

export function isDismissed(key: string): boolean {
  return state.dismissed.includes(key);
}

export function clearHistory(): void {
  commit({ ...state, history: [] });
}

export function setAlertPref(category: AlertCategory, enabled: boolean): void {
  commit({ ...state, prefs: { ...state.prefs, [category]: enabled } });
}

export function setSensorEnabled(key: SensorKey, enabled: boolean): void {
  commit({ ...state, sensors: { ...state.sensors, [key]: { ...state.sensors[key], enabled } } });
}
export function setSensorThreshold(key: SensorKey, threshold: number): void {
  if (!Number.isFinite(threshold)) return;
  commit({ ...state, sensors: { ...state.sensors, [key]: { ...state.sensors[key], threshold } } });
}
