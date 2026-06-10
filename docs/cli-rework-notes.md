# Installer / CLI rework — study notes

Source material studied 2026-06-10:
- eGames `remnawave-reverse-proxy` installer (`install_remnawave.sh` v3.0.6, 2461 lines + `src/` modules ≈ 5000 lines)
- our untouched upstream 3x-ui CLI (`x-ui.sh`, 3154 lines) + `install.sh` / `update.sh`

---

## 1. eGames script — architecture

**Modular orchestrator.** The main script is a thin(ish) shell: menus, helpers,
cert management, self-update. Heavy work lives in lazily-downloaded modules:

```
src/lang/{en,ru}.sh                  # i18n: LANG[KEY] assoc arrays, picked once, cached on disk
src/nginx/install_panel_node.sh     # full stack: panel+node on one host (609 lines)
src/nginx/install_panel.sh          # panel-only host
src/nginx/install_node.sh           # node-only host
src/caddy/...                        # same three, Caddy flavour (user picks webserver)
src/api/remnawave_api.sh             # panel preconfiguration via REST API
src/modules/{add_node,manage_panel,warp,ipv6,selfsteal_templates}.sh
```

- `load_module()` downloads a module on demand and sources it.
- `download_with_mirrors()`: every fetch tries raw.githubusercontent → jsdelivr →
  raw.githack → ghproxy, with content validation (`bash -n`-style sanity checks)
  before sourcing. Resilient to GitHub being blocked.
- Self-update: compares `SCRIPT_VERSION` against the repo copy at startup, shows
  a red "update available" banner in the menu header; script installs itself to
  `/usr/local/remnawave_reverse/` + a `remnawave_reverse` launcher in PATH.
- All output is `tee`-d to a logfile; `log_clear()` strips ANSI codes from it.

## 2. eGames — UX patterns worth adopting

- **Helpers discipline:** `question()` (green `[?]` + yellow text), `reading()`
  (prompt+read in one), `error()` (red + exit). Every interaction looks identical.
- **Braille spinner** (`⠋⠙⠹⠸…`) wrapping every long operation; the underlying
  command runs `> /dev/null 2>&1 &` and the spinner watches the PID. The user
  sees ONE animated line per step instead of scrolling package-manager vomit.
  Prints to `/dev/tty` so it survives the `tee` logging.
- **Menu style:** short numbered list, *grouped by blank lines*, no box-drawing
  walls; header = title + gray version line (+ update banner) + wiki link.
  Submenus are tiny (3–5 items). `0. Exit` everywhere, consistent.
- **Final summary card** at the end of install: credentials, URLs, secret
  cookie link — everything you must save, in one block (we already do this).
- Language selection menu on first run, cached choice on disk.

## 3. eGames — the "reverse proxy" magic (what actually happens)

Asks for **3 domains** up front (validated against server IP via DNS lookup +
uniqueness): `panel.x`, `sub.x`, `selfsteal.x`. Then:

1. **Certificates** (`certbot`, ECDSA secp384r1):
   - method 1: Cloudflare DNS-01 (asks CF API token/email) → **wildcard** cert
     for the base domain — one cert covers panel+sub+selfsteal;
   - method 2: HTTP-01 standalone per-domain (opens port 80 via ufw);
   - cron renewals + `--reloadcmd`; cert expiry checks in a manage-certs menu.
2. **Secrets generated, never asked:** superadmin user/pass, JWT secrets,
   metrics creds, **cookie-gate pair** (`cookies_random1=cookies_random2`).
3. **docker-compose** stack: panel, postgres, valkey, subscription-page, and
   nginx that listens ONLY on a **unix socket** (`/dev/shm/nginx.sock`,
   `ssl proxy_protocol`). **Nothing but Xray owns :443.**
4. **Single-port-443 routing:** the node's Xray serves VLESS Reality on 443;
   its `dest`/fallback points at the nginx unix socket. nginx then virtual-hosts
   by SNI/Host: panel domain → panel app, sub domain → subscription page,
   selfsteal domain → static decoy site. Result: panel/sub/decoy all reachable
   via clean :443 URLs, while the same port carries proxy traffic.
5. **Cookie gate:** nginx `map`s a secret cookie; `https://panel.x/?<k>=<v>`
   sets it (HttpOnly/Secure/SameSite, 1y). Without the cookie the panel vhost
   returns the decoy/404 — the panel is invisible to scanners even with the
   right SNI. (Their analogue of our random webBasePath, but stronger.)
6. **Selfsteal decoy:** downloads a random static template from 2–3 community
   template repos (zip → /var/www), so every install looks different.
7. **API preconfiguration** (the killer feature): after the stack is up it
   drives the panel's REST API — register superadmin → login/token → generate
   x25519 keys → create config profile (Reality inbound, port 443, decoy dest)
   → create node → create host (sub link entry) → add node to default squad →
   mint an API token. The user lands in a FULLY working panel: node connected,
   inbound configured, sub page serving.
8. **Cron**: cert renewal, panel update checks, all appended idempotently
   (`add_cron_rule` dedupes), logged to one file.

OS support is deliberately narrow: Debian 11/12/13, Ubuntu 22.04/24.04 — they
refuse anything else (`check_os`). Massively simplifies testing.

## 4. Our x-ui.sh — feature inventory (untouched upstream)

Flat 27-item menu in a box-drawing frame + `show_status` underneath; plus rich
subcommands (`x-ui start|stop|restart|status|settings|log|banlog|update|...`).

Groups as they exist today:
- **Lifecycle:** install / update / update_menu(self) / legacy version / uninstall
- **Identity:** reset user+pass, reset webBasePath, reset settings, change port,
  view settings (reads `/usr/local/x-ui/x-ui setting -show` etc.)
- **Service:** start/stop/restart, restart-xray, status, logs (panel+xray, follow)
- **Autostart:** enable/disable (systemd / OpenRC for alpine)
- **Security/SSL:** acme.sh standalone issue (`ssl_cert_issue_main`), per-IP
  cert issue, **Cloudflare DNS cert flow** (`ssl_cert_issue_CF`), writes cert
  paths into panel settings
- **Hardening:** fail2ban "IP limit" (install/jails/banlog), ufw firewall menu
  (open/delete ports), SSH port-forwarding helper
- **System:** BBR enable/disable, geofile updates (per-region dat sources),
  Ookla speedtest
- **Database:** full PostgreSQL submenu — local install, status/start/stop,
  env-file wiring, **SQLite→Postgres migration**, `migrateDB` dump converter

Weaknesses vs eGames:
- Wall-of-text everywhere: raw apt/dnf/acme/fail2ban output floods the screen
  (the exact "бегущие строки" complaint). No spinner, no progress lines.
- One giant flat menu (27 items); no grouping into submenus.
- No version line / self-update banner; `update_shell` exists but silent.
- English only; no logging of CLI sessions to a file.
- Everything inline in one 3154-line file; no module separation.
- Zero post-install configuration of the panel beyond creds/port/basePath —
  no inbound, no SSL wiring into a working VLESS setup, no decoy site.
  (Our install.sh DOES already do: random creds/basePath/port, SQLite/PG
  choice, SSL prompt incl. IP certs, summary card — better than upstream's,
  but far from eGames' turnkey result.)

## 5. Gap analysis → what a rework would mean for 3x-ui

Architectural mapping (Remnawave → 3x-ui):
- panel+sub already ONE Go binary (no docker needed) — simpler than remnawave;
- "node" = 3x-ui's built-in Xray (single-host) or the new multi-node feature;
- API preconfig: 3x-ui has a full REST API + API token (`/panel/api/...`,
  openapi.json in repo) — same trick is possible: create a Reality inbound
  with fallback→nginx-socket, set sub settings, via our own API;
- cookie gate / SNI routing: nginx (or xray fallbacks alone) in front;
  3x-ui supports Xray fallbacks natively, so the unix-socket pattern ports 1:1;
- certs: we already have acme.sh flows incl. CF; eGames uses certbot — keep
  acme.sh, add wildcard DNS-01 path;
- selfsteal templates: same template repos are public zips; trivial to reuse.

Proposed phasing (to discuss):
1. **Phase A — UX shell:** rewrite x-ui.sh skeleton: helpers (question/reading/
   error/spinner/log-to-file), grouped compact menus, version banner +
   self-update, keep every existing feature behind the new skin. RU+EN lang
   files. Possibly split into modules fetched from our repo (with mirror
   fallback like eGames) — or keep single-file but generated from parts.
2. **Phase B — quiet installs:** wrap install.sh steps in spinner-style steps
   ("[1/6] Dependencies…"), silence stdout to the logfile, keep the final
   summary card.
3. **Phase C — turnkey reverse-proxy mode:** new optional install path that
   asks for domains, gets certs (wildcard via CF or per-domain HTTP-01),
   deploys nginx-on-unix-socket + decoy template, then **preconfigures the
   panel via our own API**: Reality inbound on 443 with fallbacks to
   panel/sub/decoy by SNI. End state: panel & sub on clean domain URLs, no
   ports, scanner-invisible.
4. **Phase D — extras:** cron wiring (cert renew, update check), backup/restore
   menu, WARP module if wanted.

Open questions for the boss:
- single-file CLI vs eGames-style downloadable modules (modules = smaller
  main script, but adds network dependency + supply-chain surface);
- narrow the supported OS list for the turnkey mode (eGames-style) or keep
  the wide matrix for basic install?
- cookie-gate for panel: adopt (on top of basePath) or skip?
- keep box-drawing menu frames or switch to eGames' airy grouped lists?

---

## 6. Reverse-proxy feasibility — VERIFIED against our backend (2026-06-10)

Decisions locked by boss: single-file CLI; airy eGames-style grouped menus.

Key findings (why 3x-ui is SIMPLER than remnawave here):

- **Sub page already has its own domain natively.** The sub server is a
  separate `http.Server` (`sub/sub.go`) with independent settings: `subListen`,
  `subPort` (default 2096), `subDomain`, `subCertFile`/`subKeyFile`, `subURI`,
  `subPath`. It validates Host against `subDomain` → 403 on mismatch. So
  sub-on-its-own-domain needs NO separate container / no token bridge (remnawave
  pain) — it's the SAME binary + DB, just bind it to sub.domain:port with its
  own cert. Set `subURI=https://sub.domain/`.
- **Domain pinning = "don't open by IP" is built in.** `DomainValidatorMiddleware(webDomain)`
  in web.go: if `webDomain` set, any request whose Host != webDomain → 403.
  Same for subDomain. Exactly the behaviour we want; just set the values.
- **Fallbacks are native.** `FallbackService` + `InboundFallback` model;
  Xray fallbacks honored on VLESS/Trojan-over-TCP. So the single-port-443 +
  SNI/ALPN routing pattern (Reality on 443, fallback → nginx unix socket) is
  supported. `AddInbound` (web/controller/inbound.go) lets us create the inbound
  programmatically.
- **GAP for install-time config:** `x-ui setting` CLI flags today = port,
  username, password, webBasePath, listenIP, webCert/webCertKey, tg*. MISSING:
  webDomain, subDomain, subURI, subPort, subCert/subCertKey. To write domains at
  install we either (a) add these flags to the setting CLI (small Go change in
  main.go — our fork, fair game), or (b) drive the REST API after start (needs
  the apiToken, which `x-ui setting -getApiToken` already exposes). Leaning (a):
  no auth dance, works even with panel stopped, deterministic.

### Proposed turnkey topology (single IP, port 443 only)

```
                 :443  (the only public port)
                   │
              ┌────┴─────┐  Xray VLESS Reality inbound (preconfigured at install)
              │  Xray    │  SNI = selfsteal.domain, x25519 keys generated
              └────┬─────┘  fallback (no SNI match / panel|sub SNI) ──┐
                   │ Reality handshake steals selfsteal TLS           │
        ┌──────────┴───────────┐                                      ▼
   real VLESS traffic     decoy site                         nginx @ unix socket
                                                            /dev/shm/xui.sock (ssl, proxy_protocol)
                                                                      │ vhost by SNI/Host
                                   ┌──────────────────────────────────┼───────────────────────┐
                                   ▼                                   ▼                        ▼
                          panel.domain → 127.0.0.1:webPort   sub.domain → 127.0.0.1:subPort   selfsteal.domain → static decoy
                          (webDomain pin)                    (subDomain pin)                   (random template)
```

Panel + sub bind to **127.0.0.1** only (`listenIP`/`subListen`), invisible
except through nginx. Everything reachable on clean `:443` domain URLs.

### What we require from the user (install inputs)
- 3 domains/subdomains (A-records already pointing at the server IP):
  `panel.x`, `sub.x`, `selfsteal.x` (validated: resolve to this IP + unique).
- Cert method: Cloudflare DNS-01 (wildcard, asks CF token) OR HTTP-01 standalone.
- (optional) email for Let's Encrypt.
Everything else (creds, basePath, x25519 keys, cookie secret, ports) generated.

### Auto-config sequence at install
1. acme.sh issue certs (reuse our existing CF/standalone flows from x-ui.sh).
2. Write panel settings: webDomain, listenIP=127.0.0.1, webPort(random),
   webBasePath(random); subDomain, subListen=127.0.0.1, subPort, subURI,
   subCert/subKey  → via new CLI flags (or API).
3. Render nginx.conf from a TEMPLATE (3 server blocks on the unix socket,
   SNI vhosts, optional cookie-gate map on the panel vhost), reload nginx.
4. Deploy a random selfsteal static template to /var/www.
5. Generate x25519 + shortId; create the VLESS Reality inbound via AddInbound
   with fallback→unix socket; start Xray.
6. Cron: cert renew + panel update check.
7. Print the summary card (creds, panel URL, sub URL, cookie link).

### Open design decisions to settle with boss
- **nginx vs Xray-only fallbacks:** nginx-on-unix-socket is the robust multi-SNI
  router (eGames-proven). Pure-Xray fallback can't cleanly host 3 different TLS
  SNIs → nginx recommended. (Caddy optional later.)
- **cookie-gate:** nginx maps a secret cookie/query; without it the panel vhost
  serves 404/decoy. It's ON TOP of webBasePath+webDomain. Strong but adds a
  "magic link" the user must keep. Decide: adopt, or rely on basePath+domain pin.
- **OS scope for turnkey:** narrow to Debian 12/13 + Ubuntu 22.04/24.04 (like
  eGames) for the reverse-proxy path, while basic (non-proxy) install keeps the
  wide matrix?
- **CLI flags vs API** for writing domains/inbound at install (leaning CLI flags).

---

## 7. Forks RESOLVED with boss (2026-06-10)

- **Write config at install → REST API, NOT CLI flags.** Keeps the Go backend
  byte-identical to upstream (our core compat guarantee). Flow: panel starts →
  `x-ui setting -getApiToken true` (existing) → curl localhost API:
  `/panel/setting/update` (full AllSetting) + `POST /panel/api/inbounds/add`.
- **Two top-level install modes (the real fork):**
  - **A. Domain / turnkey reverse-proxy:** VLESS Reality *selfsteal* → own decoy
    page; nginx on a unix socket SNI-routes panel/sub/decoy; panel & sub on their
    own domains, :443, no ports; panel basePath can be "/" with a cookie-gate.
  - **B. IP / self-signed:** standard VLESS+TCP+Reality with a *borrowed foreign
    SNI* (random from the known list in frontend/src/models/reality-targets.ts —
    nvidia/amd/microsoft…), no nginx, no decoy, panel on IP:port self-signed.
    ≈ current install + a preconfigured working inbound.
- **Bare-domain panel + cookie-gate (mode A):** webBasePath default is already
  "/", so the panel runs at root natively; move the secret from the long
  basePath into an nginx cookie. No cookie/secret query → 404/decoy; a one-time
  "entry link" sets the cookie then redirects to root.
- **Branded error pages:** nginx `error_page` serves panel-styled 404/503 HTML
  (glass look) instead of plain text — frustrates active probing.
- **OS scope:** turnkey (mode A) narrowed to Debian 12/13 + Ubuntu 22.04/24.04;
  basic install (mode B / no-proxy) keeps the wide matrix. MUST be documented.

### Next deliverables to draft (boss to greenlight order)
1. Install-mode decision tree (A vs B) + the exact questions each asks.
2. nginx.conf TEMPLATE for mode A: 3 server blocks on the unix socket
   (panel/sub/selfsteal vhosts), cookie-gate `map` on the panel vhost,
   `error_page` → branded 404/503, TLS params, proxy_protocol.
3. Two inbound JSON presets fed to `POST /panel/api/inbounds/add`:
   (A) Reality selfsteal w/ fallback→unix socket; (B) Reality borrowed-SNI TCP.
4. API-preconfig sequence (token → setting/update → inbound/add → restart).

- **Hysteria2 (future):** popular UDP/QUIC protocol, needs TLS → add to config
  generation ONLY in mode A (domain). Separate inbound on UDP/443 alongside the
  VLESS Reality TCP inbound; reuses the same issued cert. Deferred until A ships.

- **Caddy (wave 2):** ship a Caddy-flavoured reverse-proxy template alongside
  Hysteria2, mirroring eGames' nginx/caddy choice. nginx is v1-only.
