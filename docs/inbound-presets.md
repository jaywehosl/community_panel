# Inbound presets for install-time preconfig (deliverable #3)

Status: DESIGN. The installer POSTs one of these to
`POST /panel/api/inbounds/add` (Bearer apiToken). Shape is authoritative —
mirrors the golden fixture `frontend/src/test/golden/fixtures/inbound-full/vless-tcp-reality.json`.

`settings` / `streamSettings` / `sniffing` may be sent as nested JSON (preferred)
or JSON-encoded strings (legacy). We send nested.

## Values generated at install (both presets)

| placeholder | how |
|-------------|-----|
| `${UUID}` | `cat /proc/sys/kernel/random/uuid` (or `xray uuid`) |
| `${PRIV_KEY}` / `${PUB_KEY}` | `/usr/local/x-ui/bin/xray-linux-amd64 x25519` → parse "Private key:" / "Public key:" |
| `${SHORT_ID}` | `openssl rand -hex 8` (8 bytes → 16 hex chars; 1–2 ids) |
| `${SUB_ID}` | `gen_random_string 16` (links the client to a subscription) |
| `${EMAIL}` | `admin` or `gen_random_string 8` |

> NOTE the field is **`target`** (3x-ui naming), not `dest`. `xver=1` makes Xray
> prepend the PROXY-protocol header (mode A → nginx needs `proxy_protocol`).

---

## Preset A — mode A (domain / turnkey selfsteal)

Reality steals the **selfsteal domain's own cert** (served by nginx on the unix
socket). All non-VLESS traffic is relayed to that socket with PROXY protocol;
nginx then SNI-routes panel/sub/decoy. `${SELFSTEAL_DOMAIN}` is the impersonated
SNI; `${SELFSTEAL_SOCKET_TARGET}` is `/dev/shm/xui.sock` (or `127.0.0.1:8443`).

```json
{
  "enable": true,
  "remark": "VLESS Reality 443 (turnkey)",
  "listen": "",
  "port": 443,
  "protocol": "vless",
  "expiryTime": 0,
  "total": 0,
  "settings": {
    "clients": [
      { "id": "${UUID}", "email": "${EMAIL}", "flow": "xtls-rprx-vision",
        "limitIp": 0, "totalGB": 0, "expiryTime": 0, "enable": true,
        "tgId": 0, "subId": "${SUB_ID}", "comment": "", "reset": 0 }
    ],
    "decryption": "none",
    "encryption": "none",
    "fallbacks": []
  },
  "streamSettings": {
    "network": "tcp",
    "tcpSettings": { "header": { "type": "none" } },
    "security": "reality",
    "realitySettings": {
      "show": false,
      "xver": 1,
      "target": "${SELFSTEAL_SOCKET_TARGET}",
      "serverNames": ["${SELFSTEAL_DOMAIN}"],
      "privateKey": "${PRIV_KEY}",
      "minClientVer": "", "maxClientVer": "", "maxTimediff": 0,
      "shortIds": ["${SHORT_ID}"],
      "mldsa65Seed": "",
      "settings": {
        "publicKey": "${PUB_KEY}",
        "fingerprint": "chrome",
        "serverName": "",
        "spiderX": "/",
        "mldsa65Verify": ""
      }
    }
  },
  "sniffing": {
    "enabled": true,
    "destOverride": ["http", "tls", "quic"],
    "metadataOnly": false, "routeOnly": false,
    "ipsExcluded": [], "domainsExcluded": []
  }
}
```

Client share-link (built from these values for the summary card / sub):
`vless://${UUID}@${SELFSTEAL_DOMAIN}:443?type=tcp&security=reality&pbk=${PUB_KEY}&fp=chrome&sni=${SELFSTEAL_DOMAIN}&sid=${SHORT_ID}&spx=%2F&flow=xtls-rprx-vision#turnkey`

---

## Preset B — mode B (IP / self-signed, borrowed foreign SNI)

Standard VLESS+TCP+Reality stealing a big neutral site's TLS (random from
`frontend/src/models/reality-targets.ts`: amazon/oracle/nvidia/amd/intel/sony).
No nginx, no PROXY protocol (`xver=0`). `${BORROW_TARGET}` = e.g. `www.amazon.com:443`,
`${BORROW_SNI}` = `www.amazon.com`. `${INBOUND_PORT}` defaults 443.

```json
{
  "enable": true,
  "remark": "VLESS Reality ${INBOUND_PORT}",
  "listen": "",
  "port": ${INBOUND_PORT},
  "protocol": "vless",
  "expiryTime": 0,
  "total": 0,
  "settings": {
    "clients": [
      { "id": "${UUID}", "email": "${EMAIL}", "flow": "xtls-rprx-vision",
        "limitIp": 0, "totalGB": 0, "expiryTime": 0, "enable": true,
        "tgId": 0, "subId": "${SUB_ID}", "comment": "", "reset": 0 }
    ],
    "decryption": "none",
    "encryption": "none",
    "fallbacks": []
  },
  "streamSettings": {
    "network": "tcp",
    "tcpSettings": { "header": { "type": "none" } },
    "security": "reality",
    "realitySettings": {
      "show": false,
      "xver": 0,
      "target": "${BORROW_TARGET}",
      "serverNames": ["${BORROW_SNI}"],
      "privateKey": "${PRIV_KEY}",
      "minClientVer": "", "maxClientVer": "", "maxTimediff": 0,
      "shortIds": ["${SHORT_ID}"],
      "mldsa65Seed": "",
      "settings": {
        "publicKey": "${PUB_KEY}",
        "fingerprint": "chrome",
        "serverName": "",
        "spiderX": "/",
        "mldsa65Verify": ""
      }
    }
  },
  "sniffing": {
    "enabled": true,
    "destOverride": ["http", "tls", "quic"],
    "metadataOnly": false, "routeOnly": false,
    "ipsExcluded": [], "domainsExcluded": []
  }
}
```

Share-link: same as A but `@${SERVER_IP}:${INBOUND_PORT}` and `sni=${BORROW_SNI}`.

---

## Notes / open
- **`target` = unix socket:** verify the running Xray build accepts
  `"target": "/dev/shm/xui.sock"` for Reality. If not, render nginx on
  `127.0.0.1:8443 ssl proxy_protocol` and set `target: "127.0.0.1:8443"`. (Same
  fallback already noted in nginx-template.md.)
- **Port 443 conflict:** in mode A Xray owns 443; ensure nothing else binds it.
  In mode B if the user's chosen panel port == inbound port → reject.
- **`flow` only valid with Reality/TLS+TCP** — both presets use
  `xtls-rprx-vision`, correct here.
- Hysteria2 (wave 2, mode A): a SECOND inbound on UDP/443 reusing the issued
  cert — its own preset, drafted when we build wave 2.
- Mode A also writes panel/sub domain settings via `setting/update` BEFORE
  adding the inbound (deliverable #4 sequences this).

---

## CRITICAL (validated 2026-06-10): pin the share-link host to the selfsteal domain

For DPI resistance the client's **connect host MUST equal the Reality SNI**
(both = selfsteal domain). Otherwise DPI sees "TCP to subpagetest, TLS SNI
selfsteal" — a flag. The sanctioned 3x-ui mechanism (resolveInboundAddress
comment: "External Proxy remains the way to advertise an arbitrary endpoint") is
an **externalProxy** entry on the inbound's streamSettings:

```json
"externalProxy": [ { "forceTls": "tls", "dest": "${SELFSTEAL_DOMAIN}", "port": 443, "remark": "" } ]
```

With it, the generated link is `vless://<uuid>@${SELFSTEAL_DOMAIN}:443?...&sni=${SELFSTEAL_DOMAIN}...`
— connect host = SNI = selfsteal, and that host genuinely serves the decoy.
Verified live: link host flipped from the request domain to selfsteal, decoy
still served, :443 still Xray. Does NOT affect the xray runtime config (3x-ui
strips externalProxy from the generated config — it's share-link metadata only).

So the turnkey preset A is created in TWO API calls: `inbounds/add` (the Reality
inbound) then `inbounds/update/:id` adding externalProxy — OR include
externalProxy in the initial add payload. Note: in the inbounds/list payload
`streamSettings` is a nested OBJECT (not a JSON string) — edit it directly.
