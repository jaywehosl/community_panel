# Community Panel — User Guide

This guide covers **only the features Community Panel adds on top of stock
[3X-UI](https://github.com/MHSanaei/3x-ui)**. For inbounds, clients, routing,
the subscription engine, the Telegram bot, etc., use the upstream 3X-UI docs —
that behaviour is unchanged. What's new here is the **UI**, a **theming system**,
a **notification system**, and a few **safety/quality-of-life** features.

> Localization is **temporarily English-only** — many modals aren't translated
> yet, so English is the default and the only language in every dropdown.

---

## 1. Appearance (theming) — `Settings → Appearance`

The Appearance page has two tabs: **Styles** and **Notifications**.

### Styles
Live-preview controls; changes apply instantly and are saved **to the server**
(so they appear on the login page, the subscription page, and for every admin):

- **Theme** — Light / Dark / Ultra-dark base.
- **Glass & blur** — frost blur and saturation of the glass surfaces.
- **Shape & depth** — corner-radius scale and shadow intensity.
- **Background Wallpaper** — Aura (ambient gradient), a solid colour, or an
  uploaded image (with dim & blur).
- **Palette** — Primary (drives accents, the ambient aura, toggles, selections),
  plus Success / Warning / Error. A contrast check warns on low-contrast Primary.
- **Effects** — the interactive particle field: on/off, density, speed, colour
  mode (Multicolor / Primary-only / Monochrome), and a hover-glow toggle.
- **System Fonts** — Sans / Display / Mono, or upload a custom font.

**Top-right actions:** **Save** (persist to server), **Export** / **Import**
(JSON theme file), **Reset** (back to Community Panel factory defaults).

**Presets:** *Community Panel* (the factory default) and *Nordic Frosted*.

**Tips**
- Changing **Primary** recolours the whole UI live — including the particle
  field and the ambient glow — without a reload.
- A red Save toast ("applied to this browser only") means the server didn't
  accept it (you'll still see it locally). On the login screen the theme is
  always local — it persists to the server once you're logged in.

### Notifications (tab)
See §2.

---

## 2. Notifications

Notifications appear in two places that stay in sync:
- the **status-bar strip** (toggled by the **bell** in the header), and
- the **bell badge** count.

Everything is also recorded in a **history log** (Appearance → Notifications →
History). Pop-up toasts are mirrored into history too, so nothing is lost.

### Alert sources (live conditions)
Toggle in **Appearance → Notifications → Alert sources**:
- **Security warnings** — default port / base path / HTTP-exposure, etc.
- **Xray-core health** — core crashed / stopped.
- **Restart reminders** — panel / core restart pending after a save.

Each shows in the strip with an **✕** to dismiss it. Dismissing a live alert
**silences that specific alert forever** and drops it into history, where a
**Restore** button brings it back. (We run behind a reverse proxy + cookie-gate,
so the "default port/path" warnings are usually just noise you can clear.)
**Clear** on the history keeps the entries you still need to restore a dismissed
alert.

### Threshold sensors (live, real-time)
**Appearance → Notifications → Threshold sensors.** Each = a toggle + a
threshold. They read the live server status (~2 s) and show a row **with the
current value** while over threshold; the row **updates live** and **clears
itself** when the value drops back. Dismissing one hides it **for the current
episode** — it re-arms automatically once the value drops, so the next spike
alerts again. (These are conditions, not events, so they're never spammed into
history.)

Sensors: **CPU %**, **Memory %**, **Disk %**, **Open TCP sockets**,
**Open UDP sockets**, **Uptime reminder** (days), **Client offline** (a client
that *was* online going silent for N hours).

Community Panel defaults: CPU 55 · RAM 60 · Disk 30 · TCP 1000 · UDP 1000 ·
Uptime 7 d · Client-offline 12 h — all on.

### Security log
A targeted log watcher (off by default). It does **not** dump the whole log —
it surfaces **failed panel logins** (`username` / IP / reason), collapsing a
brute-force burst into one notification. (More signals — IP-limit, SSH — to come.)

### Maintenance
**Appearance → Notifications → Maintenance.**
- **Panel update check** (on by default) — checks GitHub for a newer Community
  Panel release (at most a few times a day) and notifies once per new version.
- **Backup reminder** (on by default, every **7 days**) — reminds you to export
  the database if none has been done in N days. The clock starts on first run;
  exporting the DB (Backup dialog) resets it and clears the reminder.

---

## 3. Lock-out safety guard

Changing a setting that controls **how the panel/sub is reached** —
panel/sub **port, listen address, domain, base path, TLS cert** — opens a
hard-confirmation modal before saving, because behind a reverse proxy +
cookie-gate the wrong value here can **permanently lock you out** with no in-panel
undo. The modal:
- lists exactly which access-critical fields changed,
- enforces a **15-second** read countdown,
- requires an **acknowledgement checkbox**, then arms the confirm button, and
- offers a one-click **"Back up now"** (DB export) first.

---

## 4. Backup & restore — `dashboard → Backup`

- **Export database** / **Export migration** — downloads a snapshot.
- **Restore (import database)** — upload a `.db` (SQLite) / `.dump` (Postgres).
  Restore swaps the DB and restarts the core *inside the request*, so the panel
  briefly goes away. Community Panel handles this gracefully: it waits for the
  panel to come back, then reports **success as a notification** and reloads.
  (Previously this looked like an endless spinner ending in a network error.)

Always back up before any risky change — the safety modal (§3) gives you a button
to do it right there.

---

## 5. Client Information

The client info modal is reorganised to be compact: a status band (online /
enabled / email + last-online), copyable credential rows (subId / UUID /
password), a two-column stats grid (traffic, expiry, IP limit, IP log, created /
updated), and the attached inbounds — plus the subscription links and QR codes.

---

## Recommended deployment note

Community Panel is tuned for the **turnkey reverse-proxy + cookie-gate** install
(see the [README](../README.md)). Once deployed that way, avoid changing the
panel/sub **port, path, or domain** casually — the safety guard (§3) will warn
you, but the safest path is: back up, change during a maintenance window, and
keep the secret cookie-gate link handy.
