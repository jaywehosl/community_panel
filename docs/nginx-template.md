# nginx reverse-proxy template — mode A (deliverable #2)

Status: DESIGN. The installer renders this (envsubst-style) into
`/etc/x-ui/nginx/xui.conf` and reloads nginx.

## How it sits in the stack

```
:443  Xray VLESS Reality (serverNames=[SELFSTEAL_DOMAIN], xver=1)
        ├─ authenticated VLESS  → proxied (real traffic)
        └─ everything else      → realitySettings.dest = unix:/dev/shm/xui.sock
                                   (raw TLS relayed here, with PROXY protocol header)
                                          │
                                   nginx (this config) terminates TLS, vhosts by SNI:
                                     PANEL_DOMAIN     → 127.0.0.1:WEB_PORT  (panel, HTTP)
                                     SUB_DOMAIN       → 127.0.0.1:SUB_PORT  (sub, HTTP)
                                     SELFSTEAL_DOMAIN → /var/www/SELFSTEAL  (static decoy)
                                     anything else    → 444 (drop)
```

- nginx listens ONLY on a unix socket (`/dev/shm/xui.sock`) — nothing on a TCP
  port to scan. `ssl` + `proxy_protocol` because Xray relays the original TLS
  ClientHello with a PROXY header (Reality `xver=1`).
- panel + sub run plain HTTP on 127.0.0.1 (TLS terminated here). So at install we
  set `webCertFile`/`subCertFile` EMPTY and `listenIP=subListen=127.0.0.1`.
- Real client IP is recovered from the PROXY protocol header.

## Render variables (filled by the installer)

| var | meaning |
|-----|---------|
| `PANEL_DOMAIN` `SUB_DOMAIN` `SELFSTEAL_DOMAIN` | the three hostnames |
| `WEB_PORT` `SUB_PORT` | localhost ports the panel/sub bind to |
| `WEB_BASE_PATH` | panel base path (`/` when cookie-gate, else `/<random>/`) |
| `*_CERT` `*_KEY` | cert/key paths — one wildcard set (CF DNS-01) or 3 per-domain sets |
| `COOKIE_KEY` `COOKIE_VAL` | cookie-gate secret (only when style 2 chosen) |
| `SELFSTEAL_ROOT` | `/var/www/<SELFSTEAL_DOMAIN>` (decoy template dir) |

Blocks wrapped in `# >>> COOKIE-GATE` … `# <<<` are emitted ONLY for access
style 2 (cookie-gate). For style 1 (webBasePath) they are omitted entirely.

---

```nginx
# ── /etc/x-ui/nginx/xui.conf ──────────────────────────────────────────────
# Recover the real client IP from the PROXY protocol header Xray prepends.
set_real_ip_from 127.0.0.1;
set_real_ip_from unix:;
real_ip_header proxy_protocol;

# Modern TLS only (matches eGames hardening).
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ecdh_curve X25519:prime256v1:secp384r1;
ssl_prefer_server_ciphers on;
ssl_session_timeout 1d;
ssl_session_cache shared:XUISSL:10m;
ssl_session_tickets off;

upstream xui_panel { server 127.0.0.1:${WEB_PORT}; keepalive 16; }
upstream xui_sub   { server 127.0.0.1:${SUB_PORT};  keepalive 16; }

# >>> COOKIE-GATE (access style 2 only)
# A request is "authorized" if it carries the secret cookie OR the secret query
# arg (the one-time entry link). The entry link also sets the cookie for a year.
map $http_cookie $has_auth_cookie {
    default 0;
    "~*${COOKIE_KEY}=${COOKIE_VAL}" 1;
}
map $arg_${COOKIE_KEY} $has_auth_query {
    default 0;
    "${COOKIE_VAL}" 1;
}
map "$has_auth_cookie$has_auth_query" $authorized {
    "00" 0;
    default 1;
}
map $arg_${COOKIE_KEY} $set_auth_cookie {
    "${COOKIE_VAL}" "${COOKIE_KEY}=${COOKIE_VAL}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=31536000";
    default "";
}
# <<< COOKIE-GATE

# ── Panel vhost ───────────────────────────────────────────────────────────
server {
    listen unix:/dev/shm/xui.sock ssl proxy_protocol;
    http2 on;
    server_name ${PANEL_DOMAIN};

    ssl_certificate     ${PANEL_CERT};
    ssl_certificate_key ${PANEL_KEY};

    # Branded error pages (active-probe bait: looks like a real app, not nginx).
    # Full common set → two glass templates (generic 4xx / 5xx). server_tokens
    # off so no nginx version leaks.
    error_page 400 401 403 404 405 429 /__xui_4xx.html;
    error_page 500 502 503 504        /__xui_5xx.html;
    location = /__xui_4xx.html { root /etc/x-ui/errorpages; internal; }
    location = /__xui_5xx.html { root /etc/x-ui/errorpages; internal; }

    # >>> COOKIE-GATE (access style 2 only)
    add_header Set-Cookie $set_auth_cookie;
    if ($authorized = 0) { return 404; }   # no secret → indistinguishable 404
    # <<< COOKIE-GATE

    # Panel WebSocket (live status) — /ws under the base path.
    location ${WEB_BASE_PATH}ws {
        proxy_pass http://xui_panel;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 3600s;
    }

    location / {
        proxy_pass http://xui_panel;
        proxy_set_header Host $host;            # = PANEL_DOMAIN → webDomain pin passes
        # CRITICAL: the panel/sub derive the SHARE-LINK host as
        # X-Forwarded-Host > X-Real-IP > Host. Without X-Forwarded-Host it falls
        # to X-Real-IP = the requester's IP, so every fetched vless:// link
        # carries whoever's IP downloaded it. Always send X-Forwarded-Host.
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}

# ── Subscription vhost ────────────────────────────────────────────────────
server {
    listen unix:/dev/shm/xui.sock ssl proxy_protocol;
    http2 on;
    server_name ${SUB_DOMAIN};

    ssl_certificate     ${SUB_CERT};
    ssl_certificate_key ${SUB_KEY};

    error_page 400 401 403 404 /__xui_404.html;
    location = /__xui_404.html { root /etc/x-ui/errorpages; internal; }

    location / {
        proxy_pass http://xui_sub;
        proxy_set_header Host $host;            # = SUB_DOMAIN → subDomain pin passes
        proxy_set_header X-Forwarded-Host $host;   # CRITICAL — see panel vhost note
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}

# ── Self-steal decoy vhost (the SNI Reality impersonates) ─────────────────
server {
    listen unix:/dev/shm/xui.sock ssl proxy_protocol;
    http2 on;
    server_name ${SELFSTEAL_DOMAIN};

    ssl_certificate     ${SELFSTEAL_CERT};
    ssl_certificate_key ${SELFSTEAL_KEY};

    root ${SELFSTEAL_ROOT};
    index index.html;
    location / { try_files $uri $uri/ =404; }
}

# ── Catch-all: unknown SNI gets dropped (no information leak) ──────────────
server {
    listen unix:/dev/shm/xui.sock ssl proxy_protocol default_server;
    server_name _;
    ssl_certificate     ${SELFSTEAL_CERT};   # any valid cert; never really shown
    ssl_certificate_key ${SELFSTEAL_KEY};
    return 444;                               # close connection, say nothing
}
```

---

## Notes / decisions for this template

- **Cert layout:** with Cloudflare DNS-01 we issue ONE wildcard `*.base` (+base)
  cert and point all `*_CERT/*_KEY` at it. With HTTP-01 we issue 3 separate
  certs and fill each block's pair. The template is identical either way — only
  the rendered paths differ.
- **`dest` = unix socket vs `127.0.0.1:8443`:** primary is the unix socket
  (`/dev/shm/xui.sock`, eGames-proven, nothing on a TCP port). If a target Xray
  build rejects a unix-socket Reality `dest`, fall back to nginx
  `listen 127.0.0.1:8443 ssl proxy_protocol` + `realitySettings.dest=127.0.0.1:8443`.
- **http2 on** per-server (nginx ≥1.25 syntax). On older nginx use
  `listen ... http2`. Installer detects nginx version.
- **Cookie-gate `if`:** the single `if ($authorized = 0)` is the documented-safe
  use of `if` in nginx (return only). The `add_header Set-Cookie` on the entry
  link is what arms the cookie; subsequent visits pass via the cookie map.
- The panel/sub already 403 foreign Hosts themselves (DomainValidator), so the
  proxy is defence-in-depth, not the only guard.
- Branded `__xui_404.html` / `__xui_503.html` ship in the release tarball and are
  copied to `/etc/x-ui/errorpages/` at install (glass style, no server banners).

## Open for boss
- RESOLVED: **nginx-only for v1**; Caddy flavour lands on WAVE 2 together with
  Hysteria2.
- RESOLVED: serve branded custom pages for the FULL common error set on the
  panel/sub vhosts (400 401 403 404 405 429 500 502 503 504), not just 404/503.
  The catch-all (unknown SNI) stays `444` (silent drop — better than any page).
