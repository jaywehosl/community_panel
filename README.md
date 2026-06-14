# Community Panel

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

## Quick Start

### 1. One-click install (precompiled binary)

Deploy the latest release binary on a Linux (amd64 / arm64) VPS:

```bash
bash <(curl -Ls https://raw.githubusercontent.com/jaywehosl/community_panel/main/install.sh)
```

The installer fetches the latest binary from **GitHub Releases**, installs the `x-ui` systemd service, and sets up dependencies. Read the disclaimer above before running this over an existing 3X-UI install.

**Prerelease channel** — installs the newest build *including prereleases* (expect rough edges):

```bash
bash <(curl -Ls https://raw.githubusercontent.com/jaywehosl/community_panel/main/install-prerelease.sh)
```

### 2. Run locally (developer mode)

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

### 3. Build from source

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

## License

Licensed under the **GNU General Public License v3.0** (GPL-3.0) — inherited from the upstream 3X-UI project. See [LICENSE](/LICENSE).

You are **free to use, study, modify, and redistribute** this project, including borrowing parts of it for your own work, **provided you comply with GPL-3.0** (notably: keep the source open and preserve the license and attribution). Credit to the original [3X-UI](https://github.com/MHSanaei/3x-ui) authors and contributors, and to [Xray-core](https://github.com/XTLS/Xray-core), is gratefully acknowledged.

## Credits

- **[3X-UI](https://github.com/MHSanaei/3x-ui)** — the upstream panel this fork is built on (Go backend, API, subscription engine).
- **[Xray-core](https://github.com/XTLS/Xray-core)** — the proxy core the panel manages.
- **eGames** — the original idea this project draws on, and the reverse-proxy + cookie-gate installation script whose implementation we adapted. Credit where it's due.

---

## Roadmap

These are intentions, not promises:

- **Interface polish** — continued refinement of the design system, consistency passes, and bug fixes.
- **Customization settings** — frontend-only preferences (colour palette, blur strength, particle / effect presets, hover styles) layered on top of the backend settings.
- **Telegram bot** — a partial rewrite and an expansion of the bot's functionality.
- **Upstream collaboration** — possibly reaching out to the original 3X-UI developers and contributors to share findings or align where it makes sense.

Contributions, issues, and forks are welcome.
