# Install flow — decision tree (deliverable #1)

Status: DESIGN (no code yet). Companion to `cli-rework-notes.md`.
Scope: the `install.sh` path + the "Install" entry of the new CLI menu.

Legend: `[?]` = prompt the user; `→` = generated/automatic; `✗` = abort.

---

## 0. Preflight (both modes)

```
[run] bash <(curl -Ls .../install.sh)
  → require root                                  (✗ if not root)
  → detect OS (/etc/os-release) + arch            (✗ amd64-only gate stays for now)
  → detect state:
       • fresh server (no x-ui)                    → INSTALL
       • our panel already present                 → offer: Reinstall / Update / Repair / Reverse-proxy-ify / Cancel
       • ORIGINAL 3x-ui present (different layout)  → warn (disclaimer), offer: Install over it / Cancel
  → install_base (deps only — no system upgrade)
```

Existing-install detection matters: never silently clobber a working panel or DB
(`/etc/x-ui/x-ui.db` is preserved across reinstall — already true today).

---

## 1. TOP FORK — access mode

```
[?] How will you reach the panel?
     1) By DOMAIN  — turnkey reverse proxy, clean :443 URLs, decoy site (recommended)
     2) By IP      — quick, self-signed TLS, no domains needed
     0) Cancel
```

Choosing **1** triggers the turnkey OS gate (see Mode A). Choosing **2** keeps the
wide OS matrix.

---

## 2. MODE A — Domain / turnkey reverse-proxy

```
OS GATE: Debian 12/13 or Ubuntu 22.04/24.04 only.
   if unsupported → [?] "Turnkey needs Debian/Ubuntu. Fall back to IP mode (2)? [y/N]"

DOMAINS — ask each one EXPLICITLY, separate prompt (strip scheme, lowercase,
validate FQDN). Exact wording (RU):
  [?] "Укажите домен, по которому будет доступна панель управления:"
  [?] "Укажите домен, по которому будет доступна страница подписок:"
  [?] "Укажите домен, по которому будет доступен selfsteal-шаблон для Reality:"
   → must be 3 UNIQUE hostnames                              (✗ if any equal)
   → DNS check: each A/AAAA resolves to THIS server's public IP
        if mismatch → [?] "<domain> does not point here yet. Continue anyway? [y/N]"
        (HTTP-01 will fail without correct DNS; DNS-01/Cloudflare tolerates it)

CERTIFICATES:
  [?] Certificate method:
       1) Cloudflare DNS-01  → wildcard *.base, one cert covers all 3 (recommended)
            [?] Cloudflare API token   (scoped: Zone.DNS edit)
            [?] (only if legacy global key) Cloudflare account email
       2) Let's Encrypt HTTP-01 (standalone, per-domain, needs :80 reachable)
            [?] Email for Let's Encrypt
   → issue via acme.sh (reuse existing ssl_cert_issue_CF / ssl_cert_issue flows)
   → install cert+key under /etc/x-ui/ssl/<...>; register acme auto-renew + cron

PANEL ACCESS STYLE — an explicit CHOICE, not a default (many users prefer the
familiar webBasePath; cookie-gate is the advanced option):
  [?] "Как защитить доступ к панели?
       1) Секретный путь (webBasePath) — привычный способ
       2) Cookie-gate — панель на чистом домене, вход по секретной ссылке"
       1 → generate a random webBasePath (classic obscurity), no cookie map
       2 → basePath stays "/"; nginx demands a secret cookie; no cookie → branded 404
           → generate cookie key/value pair; emit a one-time entry link
   (cookie-gate must be explained in the docs — see §5 docs-to-write)

AUTO-GENERATED (never asked):
   → panel username / password
   → webPort (random, 127.0.0.1 only) ; subPort (random, 127.0.0.1 only)
   → x25519 keypair + shortIds (Reality)
   → API token (read back via `x-ui setting -getApiToken`)

DEPLOY (see deliverables #2–#4):
   → render nginx.conf from template (3 vhosts on unix socket + cookie map + error_page)
   → drop a random self-steal static template to /var/www/<selfsteal>
   → API: setting/update  (webDomain, listenIP=127.0.0.1, webPort, basePath,
                           subEnable, subDomain, subListen=127.0.0.1, subPort,
                           subURI=https://sub.x/, sub cert paths, webCert paths)
   → API: inbounds/add    (VLESS Reality selfsteal, :443, fallback→unix socket)
   → restart panel + xml; reload nginx
   → cron: cert renew + update check

RESULT CARD:
   Panel:  https://panel.x/            (+ entry link if cookie-gate)
   Sub:    https://sub.x/<subPath>
   Decoy:  https://selfsteal.x/
   Creds, API token, x25519 public key, shortIds.
```

---

## 3. MODE B — IP / self-signed

```
(wide OS matrix; this is essentially today's install + a preconfigured inbound)

PANEL BASICS (existing prompts, kept):
  [?] Custom panel port? else random 1024–62000
  [?] Database: 1) SQLite (default)  2) PostgreSQL (existing PG submenu)

TLS:
  [?] TLS for the panel:
       1) Self-signed certificate (auto-generate, default)
       2) Let's Encrypt for an IP   (existing ssl_cert_issue_for_ip flow)
       3) None (HTTP only — for use behind a reverse proxy / tunnel)

PRECONFIGURED INBOUND (new, optional):
  [?] Create a ready-to-use VLESS Reality inbound now? [Y/n]
       Y →
         [?] Borrowed SNI: 1) random from the known list (nvidia/amd/microsoft…)
                           2) pick from list   3) enter your own dest:port
         [?] Inbound port? else 443
         → generate x25519 + shortIds
         → API: inbounds/add  (VLESS+TCP+Reality, borrowed SNI, no fallback)
       n → install panel only (user configures inbounds in the UI later)

AUTO-GENERATED: username/password, random webBasePath, keys.

RESULT CARD:
   Panel:  https://<IP>:<port>/<basePath>   (self-signed → browser warning expected)
   Inbound: VLESS Reality summary + import link/QR (if created)
   Creds, API token.
```

---

## 4. Shared tail (both modes)

```
→ install systemd/OpenRC unit (from tarball, already done)
→ enable + start service
→ print the result card (single block, copy-paste friendly)
→ print CLI hint: run `x-ui` for the management menu
```

---

## 5. Notes / deferred

- **Hysteria2:** mode A only (needs TLS). After A ships: add a second inbound on
  UDP/443 reusing the issued cert; ask `[?] Also enable Hysteria2? [y/N]`.
- **"Reverse-proxy-ify" an existing install:** mode A applied to a panel that's
  already running — same domain/cert/nginx steps, skip creds generation, just
  rebind listenIP→127.0.0.1 + write domains + stand up nginx. Useful menu entry.
- **Validation helpers** (`is_domain`, `is_ip`, DNS resolve, port-in-use) already
  exist in install.sh — reuse.
- RESOLVED: panel access style is an explicit 2-way choice (webBasePath vs
  cookie-gate), not forced.
- RESOLVED: every domain is asked explicitly with its own prompt.

### Docs to write (later)
- **Cookie-gate explainer:** what it is, the entry-link, how to recover/rotate
  the secret, why a bare-domain panel + cookie beats a long webBasePath.
- **Hysteria2:** mode-A-only UDP/443 inbound (deferred until A ships).
- **OS scope:** turnkey mode A = Debian 12/13 + Ubuntu 22.04/24.04 only; basic
  install (mode B) = wide matrix. State this so "why not on Arch/FreeBSD" is
  answered up front.
