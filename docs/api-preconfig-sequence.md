# API preconfig sequence (deliverable #4)

Status: DESIGN. How the installer turns a freshly-installed panel into a
fully-configured one, **without any backend changes** (REST only).

## Auth decision — ONE mechanism: session login + CSRF

Verified in code:
- `/panel/api/*` (inbounds, server, nodes) accepts a **Bearer apiToken** (CSRF
  bypassed) OR a **logged-in session**.
- **Settings live OUTSIDE the API group:** `/panel/setting/update` &
  `/panel/setting/restartPanel` are session-only (cookie + CSRF). The Bearer
  token CANNOT write settings.

→ Therefore use **session login for everything** (one cookie jar + one CSRF
header covers settings *and* inbounds *and* server/restart). No apiToken needed.

## Addressing

The installer talks to the panel **locally** on the port/basePath it just
generated (classic install step), before any domain/listen change takes effect:

```
BASE="http://127.0.0.1:${WEB_PORT}/${WEB_BASE_PATH%/}"   # e.g. .../<random>/
```

Domain/listen/port changes only apply after `restartPanel` (middleware is wired
at router init). So during preconfig the panel is still on
`0.0.0.0:${WEB_PORT}` with no DomainValidator — localhost calls just work. We set
the domains LAST, then restart.

## Sequence (curl pseudocode)

```bash
JAR=$(mktemp)

# 0) CSRF token + anon session cookie
CSRF=$(curl -s -c "$JAR" "$BASE/panel/csrf-token" | sed -E 's/.*"obj":"?([^"]+)"?.*/\1/')

# 1) Login with the creds the installer generated
curl -s -c "$JAR" -b "$JAR" -H "X-CSRF-Token: $CSRF" \
     -H 'Content-Type: application/json' \
     -d "{\"username\":\"$USER\",\"password\":\"$PASS\"}" \
     "$BASE/login"     # → authenticated session in $JAR

# small helper: authed POST
api() { curl -s -c "$JAR" -b "$JAR" -H "X-CSRF-Token: $CSRF" \
             -H 'Content-Type: application/json' "$@"; }

# 2) Generate crypto via the panel (no shelling out to xray)
X=$(api "$BASE/panel/api/server/getNewX25519Cert" -X POST)   # {privateKey,publicKey}
PRIV=...; PUB=...                                            # parse from $X
UUID=$(api "$BASE/panel/api/server/getNewUUID" | parse)       # or /proc uuid
SHORT_ID=$(openssl rand -hex 8)

# 3) Write settings — fetch the FULL object, merge our fields, post it back
#    (updateSetting binds the whole AllSetting; never post a partial blind)
ALL=$(api "$BASE/panel/setting/all" -X POST)
NEW=$(echo "$ALL" | jq \
  --arg wd "$PANEL_DOMAIN" --arg li 127.0.0.1 \
  --arg sd "$SUB_DOMAIN"  --arg su "https://$SUB_DOMAIN/" \
  --argjson sp "$SUB_PORT" \
  '.obj
   | .webDomain=$wd | .webListen=$li | .webCertFile="" | .webKeyFile=""
   | .subEnable=true | .subDomain=$sd | .subListen=$li | .subPort=$sp
   | .subURI=$su | .subCertFile="" | .subKeyFile=""
   # webBasePath: "/" for cookie-gate, else keep the random one
   ')
api "$BASE/panel/setting/update" -d "$NEW"

# 4) Create the preconfigured inbound (preset A or B — see inbound-presets.md)
api "$BASE/panel/api/inbounds/add" -d "$INBOUND_JSON"   # filled w/ UUID/PRIV/PUB/SHORT_ID

# 5) Apply: restart core then panel (panel restart re-binds to 127.0.0.1 + domain)
api "$BASE/panel/api/server/restartXrayService" -X POST
api "$BASE/panel/setting/restartPanel"          -X POST

rm -f "$JAR"
```

## Ordering rationale
1. Certs issued + nginx rendered + decoy deployed **before** the panel restart,
   so when the panel comes back on 127.0.0.1 the public `:443` path already works.
2. Settings (esp. `webDomain`, `webListen=127.0.0.1`, `webBasePath`) and the
   inbound are written **while the panel is still openly reachable on localhost**.
3. `restartPanel` LAST — it re-reads listen/domain/basePath and binds 127.0.0.1
   behind nginx. After this the panel is only reachable through the proxy.
4. `restartXrayService` applies the new inbound (also implied by panel restart,
   but explicit = deterministic).

## Robustness
- **Readiness poll** before step 0: loop `curl -fsS $BASE/panel/csrf-token` up to
  ~30×0.5s until the freshly-started panel answers (service just came up).
- **Check every response** for `"success":true`; abort with the panel's `msg` on
  false (e.g. "Port 443 is already in use").
- **jq dependency:** add `jq` to `install_base` for the turnkey path (Debian/
  Ubuntu only, already narrowed) — cleanest way to merge AllSetting.
- **Idempotency:** re-running should detect an existing turnkey inbound (match by
  remark/port) and skip re-adding; settings merge is naturally idempotent.
- **Rollback:** if a step fails after certs/nginx, leave a clear message + keep
  the panel reachable on localhost (don't half-restart into an unreachable state).

## Mode B (IP) — trimmed sequence
Same login; SKIP the domain settings (step 3 only sets nothing domain-related, or
is omitted); step 4 posts **preset B** (borrowed SNI); restart core. Panel stays
on its IP:port with the self-signed/LE-IP cert. No nginx, no sub-domain rewrite.

## Open
- Confirm `getNewX25519Cert` / `getNewUUID` exact JSON field names at code time
  (server.go) — parse accordingly.
- Confirm `/panel/csrf-token` response envelope (`obj` string) — adjust the sed/jq.
- `updateSetting` partial vs full: we go full (GET all → merge → POST) to be safe;
  confirm it doesn't choke on read-only/derived fields in the round-trip.

---

## Live end-to-end validation (2026-06-10) — RESULTS + fixes

Full mode-A turnkey was driven by hand on a fresh Ubuntu 24.04 VPS and works:
panel / sub / decoy all serve over clean :443 on their own domains, each with
its own LE cert; Xray Reality on :443 → unix socket → nginx SNI vhosts; panel
bound to 127.0.0.1. Verified: panel login page, sub link, decoy page, client
added to a real VPN app.

Fixes baked back into the design:
- **subURI MUST include the subPath.** `buildSingleURL` uses a non-empty subURI
  VERBATIM + subId and IGNORES subPath. So set
  `subURI = https://<SUB_DOMAIN>/<subPath>` e.g. `https://sub.x/sub/` — NOT
  `https://sub.x/`. (Bug found: link showed `/turnkey` instead of `/sub/turnkey`.)
- **VLESS share-link host** resolves to the server's public IP after the panel
  restart (correct & connectable). Pinning it to the selfsteal domain is optional
  polish, not required.
- **Post-restart the panel is domain-pinned** (webDomain ⇒ DomainValidator 403s
  any other Host). Our sequence writes everything BEFORE the final restart, so
  this is a non-issue for the installer — but any LATER local API call must send
  `Host: <PANEL_DOMAIN>`.
- nginx: do NOT re-declare `ssl_protocols` / `ssl_prefer_server_ciphers` /
  `ssl_session_*` in conf.d — Ubuntu's nginx.conf already sets them (duplicate
  ⇒ `nginx -t` emerg). Keep only `set_real_ip_from` + `real_ip_header` + the
  upstreams + server blocks. (http2 omitted for v1; nginx 1.24 needs the legacy
  `listen ... http2` form, add later.)
