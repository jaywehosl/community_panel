import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';

import { HttpUtil } from '@/utils';
import { subscribe, getSnapshot, pushEvent, type Severity } from '@/stores/notificationStore';

const POLL_MS = 30000;
const FETCH_COUNT = 50;       // lines per poll
const MAX_EMIT_PER_POLL = 5;  // don't flood on a burst

/** Map a log line's level token to a notification severity. */
function severityOf(line: string): Severity {
  const head = (line || '').split(' - ')[0]?.toUpperCase() ?? '';
  if (head.includes('ERROR') || head.includes(' ERR')) return 'danger';
  if (head.includes('WARNING')) return 'warning';
  return 'info';
}

/** Strip the "DATE TIME LEVEL - " prefix for a tidier toast; fall back to raw. */
function bodyOf(line: string): string {
  const idx = (line || '').indexOf(' - ');
  const body = idx >= 0 ? line.slice(idx + 3) : line;
  return (body || '').trim() || line;
}

/**
 * Headless Phase-2 sensor: surface NEW panel log lines at/above the chosen level
 * as notifications. Seed-then-delta: the first poll after enabling just records
 * the current window without emitting; later polls emit only lines that weren't
 * in the previous window (capped per poll). The backend already filters by level
 * (POST /server/logs/:count {level}), so every returned line is in-scope. Covers
 * IP-limit / fail2ban / SSH events when they reach the panel log.
 */
export default function LogWatcher() {
  const { logWatch } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const enabled = !!logWatch?.enabled;
  const prevSeen = useRef<Set<string>>(new Set());
  const seeded = useRef(false);

  // Reset the seed whenever the watcher is turned off, so re-enabling starts
  // fresh instead of dumping the backlog.
  useEffect(() => {
    if (!enabled) { seeded.current = false; prevSeen.current = new Set(); }
  }, [enabled]);

  const { data } = useQuery<string[]>({
    queryKey: ['notif', 'logWatch', logWatch?.level],
    queryFn: async () => {
      const msg = await HttpUtil.post<string[]>(`/panel/api/server/logs/${FETCH_COUNT}`, {
        level: logWatch.level,
        syslog: false,
      }, { silent: true });
      return msg?.success && Array.isArray(msg.obj) ? msg.obj : [];
    },
    enabled,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });

  useEffect(() => {
    if (!enabled || !data) return;
    const current = data.filter((l) => l && l.trim());

    if (!seeded.current) {
      prevSeen.current = new Set(current);
      seeded.current = true;
      return; // first window = baseline, don't replay history
    }

    const fresh = current.filter((l) => !prevSeen.current.has(l));
    prevSeen.current = new Set(current);

    fresh.slice(-MAX_EMIT_PER_POLL).forEach((line) => {
      pushEvent(severityOf(line), bodyOf(line), `log:${line}`);
    });
  }, [enabled, data]);

  return null;
}
