import { useEffect, useRef, useSyncExternalStore } from 'react';

import { toast } from '@/components/ds';
import { useStatusQuery } from '@/api/queries/useStatusQuery';
import {
  subscribe,
  getSnapshot,
  type SensorKey,
} from '@/stores/notificationStore';

const pct = (cur: number, total: number) => (total > 0 ? Math.round((cur / total) * 100) : 0);

/**
 * Headless Phase-2 sensor watcher. Reads the polled server `status`, evaluates
 * each enabled threshold sensor, and fires a notification (warning toast, which
 * mirrors into the history log) on the false→true crossing only — re-arming once
 * the value drops back below the threshold. Mounted once in PanelLayout.
 */
export default function SensorWatcher() {
  const { status, fetched } = useStatusQuery();
  const { sensors } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const firing = useRef<Record<SensorKey, boolean>>({
    cpu: false, mem: false, disk: false, sockets: false, uptimeDays: false,
  });

  useEffect(() => {
    if (!fetched) return;

    const cpuV = Math.round(status.cpu.current);
    const memV = pct(status.mem.current, status.mem.total);
    const diskV = pct(status.disk.current, status.disk.total);
    const sockV = status.tcpCount;
    const upDays = Math.floor(status.uptime / 86400);

    const checks: Record<SensorKey, { value: number; msg: (th: number) => string; ready: boolean }> = {
      cpu: { value: cpuV, ready: true, msg: (th) => `CPU usage ${cpuV}% (threshold ${th}%)` },
      mem: { value: memV, ready: status.mem.total > 0, msg: (th) => `Memory usage ${memV}% (threshold ${th}%)` },
      disk: { value: diskV, ready: status.disk.total > 0, msg: (th) => `Disk usage ${diskV}% (threshold ${th}%)` },
      sockets: { value: sockV, ready: true, msg: (th) => `Open TCP sockets ${sockV} (threshold ${th})` },
      uptimeDays: { value: upDays, ready: status.uptime > 0, msg: (th) => `System up ${upDays} days — consider checking OS / panel updates (threshold ${th}d)` },
    };

    (Object.keys(checks) as SensorKey[]).forEach((key) => {
      const cfg = sensors[key];
      const chk = checks[key];
      if (!cfg?.enabled || !chk.ready) {
        firing.current[key] = false; // disabled/no-data → re-arm
        return;
      }
      const over = chk.value >= cfg.threshold;
      if (over && !firing.current[key]) {
        firing.current[key] = true;
        toast.warning(chk.msg(cfg.threshold), 8000);
      } else if (!over && firing.current[key]) {
        firing.current[key] = false; // dropped back → re-arm for the next crossing
      }
    });
  }, [status, fetched, sensors]);

  return null;
}
