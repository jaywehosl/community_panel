# Notifications & Safety subsystem — consolidated plan

Single source of truth for the notification system, the configurable sensors, and
the access-safety guards. Supersedes the scattered Tier/Block notes.

Context: this panel runs behind **nginx + a cookie-gate + reverse proxy**, so
"default port / default base path" warnings are noise, and changing
port/path/domain can lock the operator out entirely.

---

## Phase 1 — Notification foundation — ✅ SHIPPED (v3.4.17)

- `frontend/src/stores/notificationStore.ts`: history (persisted, cap 200),
  dismissed live-alert keys (persisted), per-category enable prefs.
- Live alerts (port/path/xray/restart) are dismissible (X in the header strip),
  with **stable per-check ids**; dismissed → kept forever in history.
- Toast bridge: every string toast is mirrored into history.
- Appearance is a tab shim: **Styles** (theme tiles) + **Notifications**
  (source toggles + history with Clear / Restore).

**Known limitation carried into Phase 2:** dismiss is permanent-per-key
(correct for persistent *conditions*). Recurring *events* need an
**edge-triggered** model (fire on false→true transition, dismiss clears the
instance, condition reset re-arms it) so a re-occurrence produces a NEW
notification with a NEW instance id.

---

## Phase 2 — Sensors (notification sources)

Each sensor = a toggle + a configurable threshold in the Notifications tab.
Recurring ones are **edge-triggered** per the model above.

### Tier A — `status` poll (no backend change; fields verified in models/status.ts)
- CPU % over threshold (`cpu.current`)
- RAM % over threshold (`mem`)
- **Disk % over threshold** (`disk`) — added; disk-full is critical
- Load average over threshold (`loads`)
- Socket-count anomaly (`tcpCount` / `udpCount`)
- Uptime reminder (`uptime` / `appUptime`) — e.g. "up N days, check OS updates"

### Tier B — client APIs (no backend change)
- Client offline > N hours (`lastOnline` per client; `/clients/lastOnline`)
- Client hitting its IP limit (`limitIp` + check_client_ip_job) — verify the
  per-client online-IP count source before promising.

### Tier B+ — System log watcher (no backend change)
- Poll `/panel/api/server/logs/:count` at a chosen level (≥ warning / err) and
  surface each NEW line as a notification (edge: only lines since last poll).
  Robust (level-based, not text-parsing) and subsumes IP-limit / fail2ban / SSH
  events **if** they reach journald/syslog. Level is configurable.

### Tier D — external
- New panel build on GitHub (GitHub releases API; CORS ok for public repos,
  60 req/h unauthenticated — poll rarely). Reminder only.

### Tier C — needs backend work (do LAST)
- Dedicated fail2ban status/log endpoint (controllers expose none today, only
  config). Only needed if the log watcher proves insufficient.
- SSH attempts as a first-class source (system auth.log; not exposed at all).

---

## Phase 3 — Backup category (notifications)
- **Backup-overdue reminder**: separate toggle + interval threshold ("no backup
  in N days"). Frontend tracks last-backup timestamp in localStorage (set on a
  successful DB export).
- **Pre-risky-action backup nudge**: surfaced inside the danger modal (below).

---

## Phase 4 — Access-safety guards (highest user-value; do EARLY)

### 4a — Backup restore reliability + success notification — (in progress)
`ImportDB` closes the DB + restarts Xray mid-request, so behind the proxy the
`importDB` HTTP response usually never returns → infinite spinner → Network
Error, with no idea whether it worked (it usually did). Fix in BackupModal:
fire importDB, then **poll `/server/status` until the panel is back** (don't
trust the response), then **emit a success notification** (into the system) and
reload. Explicit fast failures (invalid file) are reported as errors.

### 4b — DangerConfirmModal for access-breaking settings
Intercept Save when any of these change and require deliberate confirmation:
- Panel: `webPort`, `webListen`, `webDomain`, `webBasePath`,
  `webCertFile`/`webKeyFile`
- Sub: `subPort`, `subListen`, `subDomain`, `subPath`, `subURI`, `subJsonPath`

Modal contents:
- Clear warning that changing this may permanently lock panel/sub access
  (reverse-proxy + cookie-gate setup).
- **15-second countdown** before the confirm control arms.
- A **checkbox**: "I have read this and accept responsibility."
- Only then the **Yes/confirm** button enables.
- A **"Back up now" button reusing the existing DB-export action** (no new code
  — same `getDb` used by BackupModal), so the user can snapshot before risking it.

Always shown for these fields (changing port/path/domain is dangerous in any
setup; no need to detect the turnkey install).

---

## Build order (simple frontend → complex backend)
1. **4a** restore reliability + success notification (frontend).  ← current
2. **4b** DangerConfirmModal + reused backup button (frontend).
3. **Phase 2 Tier A** + **client-offline (B)** + **log watcher (B+)**: the
   edge-triggered sensor layer (frontend).
4. **Phase 3** backup reminders (frontend).
5. **Tier D** GitHub build check (frontend, external API).
6. **Tier C** fail2ban / SSH backend endpoints (Go) — only if needed.
