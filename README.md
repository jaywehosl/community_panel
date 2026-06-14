# Community Panel

> 🇷🇺 Русская версия: [README.ru-RU.md](README.ru-RU.md)

A community fork of [3X-UI](https://github.com/MHSanaei/3x-ui) — a web management panel for [Xray-core](https://github.com/XTLS/Xray-core) — with a **completely rebuilt React frontend**. The Go backend stays close to upstream; the user interface is the part we reworked from the ground up.

---

## ⚠️ Disclaimer — read before using

- This project is provided **"as is", with no warranty of any kind**, express or implied. There is no guarantee of fitness for any purpose, stability, or security.
- It is a **purely technical, educational project**, built largely **with the help of AI coding assistants** as an exercise in rebuilding a real-world admin interface. It is **not intended for commercial use**.
- Installing this edition **on top of an existing original 3X-UI deployment can cause problems** (schema / asset / behaviour differences). Back up your data first and assume things may break.
- **All responsibility lies with the end user.** You alone are accountable for how, where, and why you deploy and run it.
- This project is **not designed to bypass, evade, or circumvent any restrictions, filtering, or blocks imposed by government regulators or any other body with legal authority in any country.** Use it only in ways that are lawful in your jurisdiction.

If you don't accept the above, don't use the project.

---

## What this is, and why it exists

3X-UI is a mature, widely used panel, but its frontend is built on Ant Design. The goal of this fork was **not** to make "a better panel" — it was to **learn** by taking a real, non-trivial codebase and rebuilding its entire UI:

- migrating the frontend **off Ant Design** onto a small, hand-rolled component library;
- exploring a single cohesive design language (a glassmorphic, glossy-style look);
- doing all of this **in close collaboration with AI assistants**, as a practical study of AI-assisted software development on a real project.

The backend (Go + Xray-core integration, REST API, subscription engine, database) is kept **intentionally close to upstream 3X-UI** so the panel keeps working; the meaningful divergence is the frontend and the surrounding build/UX glue.

### How it was built

- The original Ant Design UI was incrementally replaced by a custom set of components (dialogs, tables, forms, tabs, menus, cards) built on **Radix UI** primitives and **TanStack Table/Query**.
- Page layout was reorganized (header + status bar + notifications, a consolidated dashboard, settings / xray editors with shared save-and-restart logic).
- A WebGL particle field and CSS `backdrop-filter` glass surfaces provide the visual layer.
- The Go backend serves the Vite-built frontend embedded into the binary.

### What it's built with

- **Backend:** Go, Xray-core, the upstream 3X-UI server / API.
- **Frontend:** React 19, TypeScript, Vite, Radix UI, TanStack Query & Table, CodeMirror (JSON editor), i18next (English only for now — other locales temporarily disabled while modals are being translated), Zod.
- **Tooling:** Vitest + Testing Library, a generated OpenAPI client, a GitHub Actions release pipeline.

---

## Requirements

- **Server:** a Linux **VPS** (amd64 or arm64) with **systemd** and **root**
  access. Releases are built and tested for Debian / Ubuntu — use one of those.
- **Minimum specs:** ~**1 vCPU, 1 GB RAM, 10 GB disk**. The panel + Xray are
  light; size up for traffic and logs.
- **Domains:** for the recommended turnkey install you need **three distinct
  domains or subdomains**, each with an **A record pointing to the server's IP**
  (the machine you run the installer on):
  1. the **panel** domain,
  2. the **subscription** domain,
  3. the **selfsteal / Reality decoy** domain.
- **Open ports:** **80** (Let's Encrypt HTTP-01 validation) and **443**.

Need a VPS? Aeza works well: [aeza.net](https://aeza.net/virtual-servers) (intl) /
[aeza.ru](https://aeza.ru/virtual-servers) (RU).

> 🖥️ **Desktop only.** The interface is built for desktop — there is **no mobile
> version yet**. Opened in a phone browser the pages will look badly broken. Use a
> desktop/laptop browser.

---

## Quick Start

On a fresh Linux (amd64 / arm64) VPS, run the installer:

```bash
bash <(curl -Ls https://raw.githubusercontent.com/jaywehosl/community_panel/main/install.sh)
```

It fetches the latest binary from **GitHub Releases**, installs the `x-ui` systemd service and dependencies, and offers the deployment modes below. (Prerelease channel — newest build incl. prereleases, expect rough edges: swap `install.sh` → `install-prerelease.sh`.) Read the disclaimer before running this over an existing 3X-UI install.

### ✅ Recommended: turnkey reverse-proxy + cookie-gate

When the installer asks, pick **"Reverse-proxy / Nginx on domains"** and the **"Cookie-gate (secret cookie-auth link)"** access style. You provide three **distinct** domains — panel, subscription, and a *selfsteal / Reality decoy* — and the installer does the rest end-to-end:

- issues Let's Encrypt certificates (HTTP-01),
- configures **Nginx with 3 SNI vhosts on a single port 443** (no ports in any URL),
- puts the panel behind a **cookie-gate**, and prints a **secret cookie-gate link — save it** (it's how you unlock the panel in your browser).

**Why this is the recommended deployment:**

| Without it | With reverse-proxy + cookie-gate |
|---|---|
| Panel on a custom port/path, reachable by anyone who finds it | Single **443**, no port/path leaked; clean domain URLs |
| Default port/path are fingerprintable → scanners & brute-force find the login | Without the secret cookie the panel **doesn't answer** — a scanner sees the **decoy site**, not a login. The panel is effectively invisible |
| You manage TLS yourself | TLS terminated by Nginx, auto-issued & renewed |
| Login/cookies may travel plain HTTP | Always HTTPS |
| The proxy is a separate manual chore | One guided install sets up panel + sub + Reality decoy together |

This is exactly the setup the panel is tuned for — e.g. the in-app **"this change can lock you out"** guard exists because changing the panel port/path/domain breaks the proxy contract. See the [User Guide](docs/USER_GUIDE.md) and [nginx template](docs/nginx-template.md) for details.

> ⚠️ **Save the secret cookie-gate link** the installer prints. Without it you cannot reach the panel.

> The legacy / plain IP-access install was removed from this installer — it's
> served by a separate, untouched script. This installer only does the turnkey
> reverse-proxy + cookie-gate deployment.

### Run locally (developer mode)

Prerequisites: **Go 1.26+** and **Node.js 18+**.

```bash
git clone https://github.com/jaywehosl/community_panel.git
cd community_panel

# Build the frontend, compile the Go binary, and run it
chmod +x run.sh
./run.sh
```

For frontend-only iteration with hot reload:

```bash
cd frontend
npm install
npm run dev      # Vite dev server (proxies the API to a backend you configure)
```

### Build from source

```bash
# 1) Build the frontend (outputs to web/dist, which the Go binary embeds)
cd frontend
npm install
npm run build
cd ..

# 2) Compile the Go binary
go build -o x-ui main.go

# 3) (Linux server) build + install the systemd service
sudo chmod +x deploy.sh
sudo ./deploy.sh
```

---

## Project structure

| Path | Description |
|------|-------------|
| `/frontend` | React + TypeScript SPA (the rebuilt UI). The Vite build output is embedded into the Go binary. |
| `/web` | Go web server: REST API, controllers, middleware, translation dictionaries, embedded frontend. |
| `/xray` | Go wrapper around the Xray-core process. |
| `/sub` | Subscription engine. |
| `/database`, `/util`, `/logger` | Persistence, helpers, logging. |
| `install.sh`, `update.sh`, `run.sh`, `deploy.sh` | Installer / updater / local runner / server build-and-deploy scripts. |

---

## Documentation

- **[User Guide](docs/USER_GUIDE.md)** — every feature *we* added on top of stock 3X-UI (Appearance / theming, the notification system & sensors, the lock-out safety guard, backup & restore, the redesigned client info) and how to use them. Русская версия: [docs/USER_GUIDE.ru-RU.md](docs/USER_GUIDE.ru-RU.md).
- **[Architecture & Design](docs/ARCHITECTURE.md)** — the structural guide: how things are implemented (technical) and the ideas behind them (theory). Русская версия: [docs/ARCHITECTURE.ru-RU.md](docs/ARCHITECTURE.ru-RU.md).
- **[Inbound setup](docs/INBOUND_SETUP.md)** — creating a VLESS·TCP·Reality (selfsteal) and a Hysteria2 inbound on this install, including the required External Proxy + `Force TLS = same`. Русская версия: [docs/INBOUND_SETUP.ru-RU.md](docs/INBOUND_SETUP.ru-RU.md).
- **[nginx template](docs/nginx-template.md)** — the reverse-proxy config behind the recommended install. Русская версия: [docs/nginx-template.ru-RU.md](docs/nginx-template.ru-RU.md).
- **Russian README:** [README.ru-RU.md](README.ru-RU.md).

For the upstream panel's own usage docs, see [3X-UI](https://github.com/MHSanaei/3x-ui) — this guide only covers what differs here.

---

## License

Licensed under the **GNU General Public License v3.0** (GPL-3.0) — inherited from the upstream 3X-UI project. See [LICENSE](/LICENSE).

You are **free to use, study, modify, and redistribute** this project, including borrowing parts of it for your own work, **provided you comply with GPL-3.0** (notably: keep the source open and preserve the license and attribution). Credit to the original [3X-UI](https://github.com/MHSanaei/3x-ui) authors and contributors, and to [Xray-core](https://github.com/XTLS/Xray-core), is gratefully acknowledged.

## Credits

- **[3X-UI](https://github.com/MHSanaei/3x-ui)** — the upstream panel this fork is built on (Go backend, API, subscription engine).
- **[Xray-core](https://github.com/XTLS/Xray-core)** — the proxy core the panel manages.
- **[eGames](https://github.com/eGamesAPI/remnawave-reverse-proxy)** — we adapted his installation scripts and CLI, taken as a model of a *finished, genuinely useful tool* (no features for features' sake). We don't build on his ideas — we reused his scripts/CLI as a good reference. Source: <https://github.com/eGamesAPI/remnawave-reverse-proxy>

---

## Roadmap

These are intentions, not promises:

- **Interface polish** — continued refinement of the design system, consistency passes, and bug fixes.
- **Customization settings** — frontend-only preferences (colour palette, blur strength, particle / effect presets, hover styles) layered on top of the backend settings.
- **Telegram bot** — a partial rewrite and an expansion of the bot's functionality.
- **Upstream collaboration** — possibly reaching out to the original 3X-UI developers and contributors to share findings or align where it makes sense.

Contributions, issues, and forks are welcome.
