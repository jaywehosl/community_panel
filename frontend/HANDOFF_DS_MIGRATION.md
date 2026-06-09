# Ultra Uber Panel — Frontend DS Migration Handoff

> **Audience:** a fresh Claude session continuing this work with no prior context.
> Read this top to bottom once, then keep it open as a reference. Everything you
> need to be productive is here or pointed to from here.

---

## 0. TL;DR — what this project is

**Ultra Uber Panel** is a fork of **3x-ui** (an Xray/V2Ray VPN panel). The Go
backend is **untouched** — we only rework the React frontend. The mission:

> Migrate the entire React frontend off **Ant Design (antd)** onto a hand-rolled
> glassmorphic **Design System (DS)** built on **headless cores** (Radix UI +
> TanStack Table). End state = **ZERO antd**. Aesthetic = *Google Antigravity ×
> Apple Vision/macOS glass*, cohesive with the login screen and panel header.

Stack: React 19 · Vite 8 · TanStack Query · react-router 7 · i18next · zod.
antd 6 is being removed page-by-page.

---

## 1. Where to find information (read these, in order)

| Source | What it gives you |
|---|---|
| **`.claude/.../memory/MEMORY.md`** (auto-memory) + its linked notes | Project foundation, design reference, build notes, CustomUI migration, design quality bar. **Start here.** |
| **`frontend/DESIGN_GUIDELINES.md`** | Canonical visual spec (the design bible). |
| **`frontend/src/styles/tokens.css`** | Single source of truth for all design tokens (`--surface-*`, `--text-1/2/3`, `--radius-*`, `--color-primary*`, `--hover-glow`, `--glass-blur*`, easings/durations). **Never hardcode colors — use tokens.** |
| **`frontend/REDESIGN_TODO.md`** | The rollout plan / staged checklist + deferred items. Keep it updated. |
| **`frontend/src/components/ds/ds.css`** | The DS stylesheet. Read it to know exactly how each primitive looks and which classes exist. |
| **`frontend/src/components/ds/index.ts`** | The DS barrel — the list of available primitives and their exported types. |
| **Reference implementations** (already migrated, copy these patterns): `src/pages/nodes/NodeFormModal.{tsx,css}` (the gold-standard modal), `src/pages/inbounds/form/**` (the largest migrated subsystem). |

If something visual is ambiguous, the **login screen** and the **panel header
"Log Out" pill / language dropdown** are the canonical references for fields,
buttons, and dropdowns. The DS primitives were built to match them.

---

## 2. Architecture & canon (memorize this)

### 2.1 The DS component library — `src/components/ds/`

Import everything from the barrel: `import { Button, Field, Input, Select, Switch, Dialog, Tabs, ... } from '@/components/ds'`.

Available primitives (all glass-styled, all token-driven):
`Button` · `Card` · `Input`/`Textarea`/`Field` · `Tag` · `Stat` · `Dialog` ·
`Drawer` · `DropdownMenu` · `Popover` · `Tooltip`/`TooltipProvider` · `Switch` ·
`Select` · `Alert` · `Divider` · `Tabs` · `Segmented` · `DataTable` ·
`Pagination`. Plus a `.ds-collapse` CSS class (native `<details>`).

Radix-backed: Dialog, Drawer, DropdownMenu, Popover, Tooltip, Switch, Select,
Tabs. TanStack react-table backs DataTable.

**Key prop signatures (don't guess — these bit us before):**
- `Button`: `variant?: 'default' | 'primary' | 'text'` (**no `ghost`!**), `size?: 'sm'|'md'|'lg'`, `danger?`, `block?`, `loading?`, `icon?`, `htmlType?`. Default `type="button"`.
- `Tooltip`: prop is **`title`** (not `content`); requires a `<TooltipProvider>` ancestor or it throws. Wrap each modal's body in one `TooltipProvider`.
- `Select`: `value`/`onChange(v: string)`/`options: {value,label,disabled?}[]`. **Empty-string value is supported** — DS maps `''` ↔ an internal sentinel because Radix forbids `value=""`. Use `{ value: '', label: '(none)/(any)' }` freely.
- `Dialog`: `open`, `onOpenChange`, `title`, `width`, `okText`/`cancelText`/`onOk`/`confirmLoading`/`okDisabled`/`okDanger`, or a custom `footer`. Content is **NOT animated** (only the overlay fades) — see glass rule below.
- `Tabs`: `items: {key,label,children,disabled?}[]`, pill-style triggers.
- `Segmented`: replaces antd `Radio.Group buttonStyle="solid"`.
- `Divider`: optional `children` = centered label.
- `Field`: `label`, `error` (renders **red** — only for real errors), `children`. For muted help text, render a `<span className="...hint">` child, NOT `error`.

### 2.2 The controlled-form keystone — `src/lib/form/`

We **replaced antd's `Form` engine** (useForm / getFieldValue / setFieldValue /
useWatch / shouldUpdate / Form.List) with plain React state:

- **`useFormState.ts`** → `useFormState<T>(initial)` returns a `FormController<T>`:
  `{ values, get(path), set(path,value), unset(path), reset(next), setValues }`.
  `FieldPath = (string|number)[]`. Helpers `getIn/setIn/unsetIn` are immutable and
  support numeric indices (arrays). Reactivity is just React state: any `set`
  re-renders consumers, so reading `get(path)` in render is always current — **no
  `useWatch` needed.**
- **`FormContext.tsx`** → `FormProvider({ctl, children})` + `useFormCtl<T>()`
  (throws outside a provider). This shares the controller down the tree so deeply
  nested field components read/write without prop-drilling — the replacement for
  antd's Form context.

**The recipe:** orchestrator modal calls `useFormState`, wraps the body in
`<FormProvider ctl={ctl}>`, and every field component calls `const ctl = useFormCtl()`
then `ctl.get([...path])` / `ctl.set([...path], v)`.

For arrays (peers, certificates, accounts, fallbacks, finalmask lists): read the
array with `ctl.get<T[]>(path) ?? []`, then `ctl.set(path, nextArray)` with an
immutable map/filter. **No `Form.List`.**

### 2.3 Multi-select / tags

- antd `Select mode="tags"` / free-text tags → **`TagListEditor`** (`src/components/form/TagListEditor.tsx`): chips + add-input, `presets?`, `separators?`.
- antd `Select mode="multiple"` over a fixed option set → clickable `Tag` chips (toggle, order-preserving) **or** `Button variant={selected?'primary':'default'}` toggles.
- antd checkbox group → `Tag` chips toggling an array (see `SniffingTab.tsx` `destOverride`).

### 2.4 The GLASS RULE (critical — this caused multi-session bugs)

`backdrop-filter` (the frosted glass) **silently dies** if **any ancestor** has
`transform`, `opacity < 1`, `filter`, `animation`, `will-change`, `contain`, or
`isolation`. Consequences we enforce:
- **Never animate a container that holds glass children.** Modal *content* is not
  animated — only the overlay fades. Tab *content* is not faded (instant swap).
- Modals are centered via a flex viewport (`.ds-dialog__viewport`), not `translate()`.
- `html { scrollbar-gutter: stable }` to avoid layout jump on modal open.
- The DS `Switch` thumb animates via `left` (a layout prop), **not `transform`**,
  because transform inside a backdrop-filtered modal renders stale until repaint
  (the infamous "fixes itself on hover" bug).

If glass "disappears", walk the DOM ancestor chain looking for one of the killer
properties. That's always the cause.

### 2.5 Toasts & confirms

- Toasts: `getMessage()` from `@/utils/messageBus` → `.success/.error/.warning/.info`.
  (The bus currently wraps antd `message`; that's infra, leave it.)
- Confirms: DS `Dialog` + a confirm-state boolean (no antd `Modal.confirm`).

---

## 3. Workflow constraints (DO NOT violate)

1. **`frontend/vite.config.js` is SECRET** (contains the live server target +
   base path; this is a public repo). **NEVER `git add`/commit it.** Always stage
   files explicitly and verify `git diff --cached --name-only | grep vite.config`
   returns nothing before committing.
2. **Branch:** `redesign/ds-foundation`. Commit **locally only** — **do not push**
   unless the user explicitly says to.
3. **Atomic commits for atomic subsystems.** A form subsystem only works fully on
   the old antd engine OR fully on the new controller — there's no partial working
   state (field components rely on shared context). So migrate a whole subsystem,
   typecheck + test green, then **one commit** = a clean rollback point.
4. **Commit message footer:** `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
5. **Line endings:** Windows checkout. `git add` warns "LF will be replaced by
   CRLF" — that's noise. After `vitest -u`, many unrelated `.snap` files show as
   modified due to EOL only (verify with `git diff --ignore-all-space` → empty).
   **Don't stage EOL-only churn**; stage only files with real content changes.

### Verification gate (run before every commit)
```bash
cd frontend
npx tsc --noEmit          # typecheck
npx vitest run            # full suite
```
**Baseline is "pre-red":** several untouched files already have type errors
(`InboundsPage.tsx`, `IndexPage.tsx`, `XrayPage.tsx`, `AppSidebar.tsx`,
`CustomUI.tsx`, `LoginPage.tsx`, `StatusCard.tsx`, `useTheme.tsx` — mostly
`TS6133` unused + antd `message`/`Element` mismatches). **Your gate = no NEW
errors in files you touched.** Filter like:
```bash
npx tsc --noEmit 2>&1 | grep -E "^src/" | grep -v TS6133 | grep <your-dir>
```
Tests: the full suite must stay green (it was **397 passed / 25 files** at last
handoff). When you change a migrated component's DOM, regenerate snapshots with
`npx vitest run -u <file>` and review the diff.

---

## 4. What is DONE

- **Design foundation:** `tokens.css` single source; dark-theme scoping; glass
  depth/interactivity; signature ParticleField shader; login + header are canon.
- **DS library** (`src/components/ds/`) — all primitives listed in §2.1, with
  `ds.css`. Centralized fixes already landed: Select empty-string sentinel,
  Dialog flex-centering + no content animation, Tabs no content-fade, Switch
  `left`-based thumb.
- **Controlled-form keystone:** `useFormState` + `FormContext` + `TagListEditor`.
- **Nodes:** `NodeFormModal`, `NodeList`, `NodesPage` — migrated. **`NodeFormModal`
  is the reference modal** (copy its structure/CSS rhythm).
- **Clients:** migrated earlier this arc (forms/tables). (QR sub-modals deferred — see §6.)
- **Inbounds form subsystem — fully migrated & polished (commits `e16ed14`, `5f6dfc3`):**
  - Orchestrator `src/pages/inbounds/form/InboundFormModal.tsx` (useFormState +
    FormProvider + DS Dialog/Tabs/Segmented; protocol/network/security cascades
    are plain controller writes; submit = `InboundFormSchema.safeParse(ctl.values)`).
  - All field components under `src/pages/inbounds/form/{protocols,transport,security}/`,
    plus `SniffingTab`, `FallbacksCard`, `advanced-editors` (JSON), `useSecurityActions`
    (now takes `ctl`, not a form), `useInboundFallbacks`.
  - **`FinalMaskForm`** (`src/lib/xray/forms/transport/FinalMaskForm.tsx`) made
    **dual-mode**: controlled-context for inbounds; an **antd-`FormInstance`
    adapter** retained for the still-antd callers (OutboundFormModal,
    SubJsonFinalMaskForm). It branches at a stable component boundary so hook
    order is consistent. **When you migrate outbounds, drop the antd branch.**
  - CSS rhythm in `InboundFormModal.css`: `.ifm-tab` wrapper = uniform 16px field
    spacing; `.ifm-grid` helpers; `.ifm-hint`; `.ifm-inline`.
  - `JsonEditor` (CodeMirror) and `HeaderMapEditor` are already antd-free.

Net so far: the inbound add/edit modal is 100% antd-free and visually on-spec.

- **Outbounds — fully migrated (commits `cddac16`, `b1533ba`):**
  - **Form subsystem** (`cddac16`): `OutboundFormModal.tsx` rewritten to
    `useFormState` + `FormProvider` + DS `Dialog/Tabs/Segmented`; protocol/
    network/security cascades are imperative `ctl.set`; JSON tab keeps
    link-import + `JsonEditor`; submit builds the wire payload via the existing
    adapter. All `protocols/*` (Form.List → controlled arrays: freedom
    noises/finalRules, wireguard peers/allowedIPs, dns rules), `transport/*`
    (raw/ws/grpc/kcp/httpupgrade/xhttp/hysteria/mux/sockopt), `security/*`
    (flat tls/reality) on `useFormCtl` + DS. **`FinalMaskForm` now called WITHOUT
    `form=` → uses the controlled context branch.** Test rewritten to the DS
    harness (`dsFieldLabels` per protocol); snapshots regenerated.
  - **Display layer** (`b1533ba`): `OutboundsTab` (DS `DataTable`, flex toolbar,
    `Segmented` testMode, DS `Dialog` confirm replacing `Modal.confirm` +
    `Popconfirm`), `useOutboundColumns` (TanStack `ColumnDef` + DS
    `DropdownMenu`/`Tag`/`Tooltip`/`Popover`), `OutboundCardList`. Only
    `@ant-design/icons` imports remain (same convention as the DS itself).
  - **`OutboundFormModal.css`** is self-contained (its own `.ifm-tab`/`.ifm-inline`/
    `.ifm-hint` + `.ofm-json`) so it doesn't depend on the inbound CSS loading.
  - ✅ **`FinalMaskForm` is now context-only** (commit `556c396`): the antd dual-mode
    branch is gone. `SubJsonFinalMaskForm` (settings) was migrated to the controlled
    keystone, which was the last `form=` caller.

---

## 5. What REMAINS (priority order)

`grep -rl "from 'antd'\|@ant-design/icons" src` shows ~100 files still on antd.
Big clusters, roughly in dependency order:

1. ~~**Outbounds**~~ ✅ **DONE** (commits `cddac16`, `b1533ba`) — see §4.
   Note: `FinalMaskForm`'s antd adapter still can't be removed yet because
   `SubJsonFinalMaskForm` (settings) still uses it.
2. ~~**Inbound list + info + QR**~~ ✅ **DONE** (commits `6d48899`, `3fccd58`).
   List layer → DS `DataTable`/`DropdownMenu`/`ColumnDef`; `InboundInfoModal`
   Divider/Tabs → DS; `QrCodeModal` Collapse → `.ds-collapse`; `QrPanel` → DS.
   **Exceptions left on purpose:** antd `QRCode` stays in `QrPanel` (no DS QR
   renderer / no qrcode lib installed — infra exception like `messageBus`); and
   `InboundInfoModal`/`QrCodeModal` still use the CustomUI `Modal` shell + a few
   CustomUI shims (Button/Space/Tag/Tooltip) — those belong to the §8 shim layer,
   not raw antd.
3. ~~**Xray page tabs**~~ ✅ **DONE** (commits `d8f343e` routing, `6d52009` dns,
   `8db5f4f` balancers+basics). The whole `src/pages/xray/` tree is now antd-free
   (only `@ant-design/icons` remain). The routing rules table is a bespoke
   `<table>` (DataTable can't host per-row drag attrs). `XrayPage`,
   `RuleFormModal`, `DnsServerModal`, `BalancerFormModal`, `overrides/*`
   (Nord/Warp) were already DS before this phase. **Still open from this cluster:**
   `SubJsonFinalMaskForm` lives under `src/pages/settings/` and is part of the
   Settings phase (item 5) — it still uses the antd `FinalMaskForm` branch.
4. ~~**Clients leftovers / QR**~~ ✅ **DONE** (commit `34da83d`). Only
   `ClientQrModal` had raw antd (Modal→DS Dialog, Collapse→`.ds-collapse`,
   Spin→CustomUI shim); `ClientInfoModal` and the rest of `clients/*` were
   already antd-free. QR still uses QrPanel's leaf antd `QRCode`.
5. ~~**Settings**~~ ✅ **DONE** (commit `556c396`). Turned out the tab files
   (GeneralTab, SecurityTab, Telegram, Subscription*, SettingsPage) were already
   antd-free; the only raw-antd file was `SubJsonFinalMaskForm` (migrated to the
   controlled keystone, which let the `FinalMaskForm` antd branch be removed).
   `TwoFactorModal` keeps antd `QRCode` as a leaf renderer (same as QrPanel).
6. ~~**Index/dashboard modals**~~ ✅ **DONE** (commits `33c327d`, `5f3f152`).
   Backup/Log/PanelUpdate/SystemHistory/Version + CustomGeoFormModal/Section +
   XrayLog/XrayMetrics → DS (Dialog/Select/Button/Tag/Alert/Segmented,
   `.ds-collapse`, `.ds-check`, bespoke `.ds-table`, confirm-state Dialogs).
   `src/pages/index/` has **no raw antd** now (only `@ant-design/icons`).
   **Debt left for a later sweep:** several index `*.css` still reference stale
   `--ant-color-*` tokens (`LogModal.css`, `BackupModal.css`, `PanelUpdateModal.css`,
   `VersionModal.css`, `SystemHistoryModal.css`, `IndexPage.css`,
   `XrayStatusCard.css`). And `IndexPage.tsx`/`StatusCard.tsx`/`XrayStatusCard.tsx`
   keep the pre-red `getMessage()` union typing + a couple `TS6133` — that's the
   messageBus-typing baseline, not raw antd.
7. ~~**Sub pages**~~ ✅ **DONE** (commit `164c128`). `SubPage` (Layout/Card/
   Descriptions/Dropdown/Menu/Popover/Space/Tag/Tooltip/Divider/Button → DS;
   Descriptions → DS-styled `<dl>`; dropped `ConfigProvider`) + `SubUsageSummary`
   (antd `Progress` → custom token bar). **Exceptions:** `SubPage` keeps antd
   `QRCode` (leaf renderer, same as QrPanel/TwoFactorModal); `entries/{login,
   subpage}.tsx` keep antd `message` + `antd/dist/reset.css` = the toast-backend
   infra (goes away with messageBus in item 9).
8. ~~**Shared shims**~~ ✅ **DONE** (commit `6d3cf3a`). `SettingListItem`
   (Row/Col → grid), `TelemetryGuideOverlay` (Button), `PromptModal`/`TextModal`
   (Modal/Input → DS Dialog + Input/Textarea), `PlanVerificationModal`
   (Modal/Button/Alert → DS; kept terminal-diff styling, ant tokens → DS).
9. **Deferred / cross-cutting:**
   - **`DateTimePicker`** (`src/components/form/DateTimePicker.tsx`) still wraps
     antd `DatePicker` (+ persian calendar). Needs a DS date input. Used by client
     expiry + inbound expiry. Deferred intentionally.
   - **QR rendering** (ClientQrModal, TwoFactorModal QRCode, QrPanel) — needs a DS
     Accordion or `.ds-collapse` for the collapsible link list.
   - **Modal z-index / layering polish** — tooltips rendering under QR-tooltips,
     stacked-modal layering. The user flagged "баги слоями" to fix in a pass.
   - **Infra that stays antd for now:** `utils/messageBus.ts`, `main.tsx`
     (ConfigProvider/App theming). Some `ds/*` files still import antd `message`
     or icons — clean opportunistically.

**Keep `REDESIGN_TODO.md` as the live checklist** — tick items there as you go.

---

## 6. The migration recipe (follow exactly — this is what worked)

For each subsystem (a modal + its field tree):

1. **Read the orchestrator** and list every field component it renders and every
   antd API it uses (`Form.useWatch`, `getFieldValue`, `Form.List`, `onValuesChange`,
   `validateFields` + `getFieldsValue(true)`, `Modal`, `Tabs`, `Radio`, etc.).
2. **Convert leaf field components first** to `useFormCtl()` + DS:
   - `<Form.Item name={[...]}>` + control → `<Field label><DS control value={ctl.get([...])} onChange={...ctl.set([...])} /></Field>`.
   - `valuePropName="checked"` Switch → `checked={!!ctl.get(p)} onChange={(v)=>ctl.set(p,v)}`.
   - `Form.List` → controlled array (`ctl.get<T[]>(p) ?? []`, immutable map/filter, `ctl.set`).
   - `Select mode="tags"` → `TagListEditor`; fixed multi-select → Tag/Button toggles.
   - `InputNumber` → `<Input type="number" .../>` with `Number(e.target.value)||0`.
   - `Input.TextArea` → DS `Textarea`. `Space.Compact` row → `<div className="ifm-inline">` or inline flex.
   - Drop props that passed `form` down; read from context instead. If a component
     needs a derived value the parent had via `useWatch`, just compute it from
     `ctl.get` inside the child (re-renders are automatic).
3. **Hooks that took `{form}`** → take `{ctl}` and swap `form.getFieldValue/setFieldValue`
   for `ctl.get/ctl.set` (see `useSecurityActions.ts`).
4. **JSON / advanced editors** read/write whole slices via `ctl.get(['settings'])`
   / `ctl.set(['settings'], parsed)` (see `advanced-editors.tsx`).
5. **Orchestrator last:** `const ctl = useFormState<T>(buildDefaults)`; on open,
   `ctl.reset(initial)` in an effect; wrap body in `<TooltipProvider><FormProvider ctl={ctl}>...`;
   DS `Dialog` (onOk = validate-then-save), DS `Tabs` (items array), DS `Segmented`
   for radio groups; cascades (protocol/network change) = imperative `ctl.set`
   calls; submit = `Schema.safeParse(ctl.values)` then build wire payload.
6. **Layout/CSS:** copy `NodeFormModal.css` / `InboundFormModal.css` rhythm —
   wrap each tab/body section so fields get **16px** vertical spacing; grids via
   `.ifm-grid`; help text via `.ifm-hint` (muted), never `Field error` (red).
7. **Gate:** typecheck (no new errors in your files) + `vitest run`; regenerate
   any affected snapshots with `-u` and review.
8. **Tests:** the harness for DS forms uses `useFormState` + `FormProvider` and
   reads `.ds-field__label` via `dsFieldLabels()` (see `src/test/test-utils.tsx`
   and `inbound-form-blocks.test.tsx`). Antd-era helpers (`fieldLabels`,
   `listSelectOptions`) still exist for not-yet-migrated tests.
9. **Commit** the whole subsystem atomically (verify no `vite.config.js` staged).

---

## 7. Gotchas already learned (don't re-learn the hard way)

- DS `Button` has **no `ghost`** variant → use `text`.
- DS `Tooltip` prop is **`title`**, needs `TooltipProvider` (no single app-root one
  exists; each modal wraps its own).
- Radix `Select.Item` forbids `value=""` — DS handles it via a sentinel; just use `''`.
- **Don't animate glass containers** (§2.4). If you add an entrance animation to a
  panel and the glass goes flat, that's why (a `.feed-section` animation broke the
  whole panel's glass for two sessions).
- `FinalMaskForm` is shared with antd callers — it's **dual-mode**. Don't "simplify"
  it to context-only until outbounds/settings are migrated, or you'll break them.
- A field component using `useFormCtl()` **must** be rendered under a `FormProvider`,
  including in tests — otherwise it throws.
- After `vitest -u`, EOL churn marks many `.snap` files modified — stage only real
  content changes.
- `tsconfig` has `noUnusedLocals/Parameters` → unused imports/params are hard errors
  (`TS6133`). Keep imports tight.

---

## 8. First moves for the next session

1. Read `MEMORY.md` (+ linked notes), this file, `DESIGN_GUIDELINES.md`, skim
   `ds.css` and `NodeFormModal.tsx`/`InboundFormModal.tsx`.
2. `cd frontend && npx tsc --noEmit` and `npx vitest run` to confirm the green
   baseline before changing anything.
3. §5 items 1–8 done. **Item 9 (cross-cutting infra) progress:**
   - ✅ **9.1 `--ant-color-*` CSS sweep** — all 107 refs across 28 files mapped to
     DS tokens (theme-aware); `grep --ant- src` is now clean.
   - ✅ **9.2 DS toast system** — new `components/ds/Toast.tsx` (`toast` API +
     `ToastViewport`). `messageBus` + CustomUI `message` both delegate to it;
     antd `message` removed from `main.tsx`/`entries/*` (+ `<ToastViewport/>`
     mounted in all 3 entries); LoginPage stopped registering an antd message.
     **Bonus:** fixed the pre-red baseline (`Modal.useModal` `as const`, XrayPage
     implicit-any) → `tsc` now has **0 non-TS6133 errors**.
   - ✅ **9.4 DS date input** — `DateTimePicker` gregorian branch = DS-styled
     native `datetime-local`/`date`; jalali still via `persian-calendar-suite`.
     antd `DatePicker` gone.
   - ✅ **9.5 z-index/layering** — coherent DS scale: overlay 1000 → dialog/drawer
     1001 → menu/popover/select 1200 → tooltip 1400 → toast 2000.
   - ✅ **9.3 drop `antd/dist/reset.css` + remove antd entirely** — DONE.
     Migrated the last antd shell pages: `AppSidebar` (lang Menu/Popover/Space →
     DS `DropdownMenu`), `LoginPage` (antd Form/Input/Button/Layout/Popover/Spin →
     DS controlled form + `DropdownMenu` + leading-icon `.login-field`; zod
     validate-on-submit; CustomUI `Spin`), `ApiDocsPage` (ConfigProvider/Layout →
     divs), `useTheme` (dropped antd ThemeConfig + `antdThemeConfig` + all the
     antd token builders; the 3 no-op `ConfigProvider` consumers lost the `theme`
     prop). Added `qrcode.react` + DS `QrCode` wrapper; replaced antd `QRCode` in
     SubPage/QrPanel/TwoFactorModal. Deleted dead `utils/zodForm.ts` (last antd
     type import). Removed `antd/dist/reset.css` from all 3 entries and
     **uninstalled the `antd` package**. `grep "from 'antd'" src` = ZERO; antd is
     absent from node_modules; `vite build` succeeds.
   - Residual `@ant-design/icons` everywhere is the accepted convention (low pri).
     The build's `vendor-antd` chunk is just the @ant-design/icons family (the
     secret vite.config's manualChunks name is a misnomer), not antd proper.
4. Confirm scope/approach with the user if a decision has trade-offs (they chose
   "full controlled rewrite, no antd Form abstraction" for forms; keep to that).
5. Atomic commit, locally, no push, no `vite.config.js`.

> 🎉 **ZERO antd.** §5 items 1–8 AND all of item 9 (9.1 CSS sweep, 9.2 DS toast,
> 9.3 drop reset.css + uninstall antd, 9.4 DS date, 9.5 z-index) are DONE. The
> `antd` package is uninstalled; `grep "from 'antd'" src` is empty; only
> `@ant-design/icons` remains (accepted convention). `tsc` = 0 non-TS6133 errors;
> `vite build` succeeds; suite green at 397/25 files.
> What's left is pure polish: the ~25 baseline TS6133 unused-import warnings
> (mostly AppSidebar dead icon imports + CustomUI), and any visual QA on the
> newly-migrated LoginPage / AppSidebar lang menu / toasts that needs a running app.

---

## 10. Dashboard → "metrics status-bar" redesign (IN PROGRESS — read this)

> antd migration is 100% done. This section is a **post-migration product
> redesign** of the home dashboard, driven interactively by the user. It is
> **not finished** — there are open visual requirements (§10.4) the user just
> gave. A second agent should continue from here.

### 10.1 What the dashboard became (the concept the user signed off on)

The old `IndexPage` had ~12 antd-ish tiles (one stat per tile) — the user called
it bloated. We replaced it with:

- **A landing hero.** The `#dashboard` feed section is now just the login-style
  tagline ("Experience liftoff with next-gen connection management" / "A clean,
  spacious, …"), reusing the exact login typography (`.dash-hero-title/subtitle`
  copy the `.login-hero-*` rules 1:1). The page is now: hero → inbounds →
  clients → groups → nodes.
- **A pull-down metrics status-bar.** A full-width bar that drops down *below the
  header*, mirroring the header's glass + 3-zone layout. It is the *only* place
  telemetry lives now. Opens/closes; stays open until toggled (no auto-dismiss).

### 10.2 Architecture (files + how it's wired)

- **`src/layouts/MetricsPanelContext.tsx`** — tiny context: `{ open, setOpen,
  toggle }`. Provider mounted in `PanelLayout` so the header and the bar share
  one open-state.
- **`src/layouts/PanelLayout.tsx`** — wraps `<AppSidebar/>` + `<MetricsPanel/>` +
  `<Outlet/>` in `<MetricsPanelProvider>`. The bar is **global** (every route).
- **`src/layouts/AppSidebar.tsx` / `.css`** — the header.
  - The **brand logo is the bar toggle** (`onLogoClick = toggleMetrics`) — it
    NO LONGER navigates anywhere (deliberate, slightly-hidden feature).
  - The **"Overview" nav item** = `window.scrollTo({top:0})` (or navigate home
    from another route) **+ open the bar**. (Plain `scrollIntoView` left it ~80px
    short under the fixed header — that's why it's `scrollTo(0)`.)
  - Header gets `.metrics-open` class while the bar is open → its bottom divider
    is hidden so header+bar read as one glass surface (see §10.4 — NOT fully
    solved).
  - Header nav + bar controls share an **absolute-centered 8-column grid**
    (`--nav-band-w: 760px`, defined in AppSidebar.css) so each header button sits
    above its bar control. `.header-center` and `.mb-center` are both
    `position:absolute; left:50%; translateX(-50%); width:var(--nav-band-w)`.
- **`src/pages/index/MetricsPanel.tsx` / `.css`** — the bar. **Self-contained**:
  owns `useStatusQuery` (status is warm because the query is global/polled — no
  empty flash on open), `ipLimit`-free action set, the lazy action modals
  (Log/Backup/SystemHistory/XrayMetrics/Version), the busy overlay, and the
  `message.useMessage()`+`setMessageInstance` toast wiring. Three zones:
  - **LEFT (`.mb-left`, under the logo):** 4 **vertical equalizer gauges**
    (CPU/RAM/Swap/Storage) — icon on top, load-colored vertical fill, % below,
    NO labels, NO per-tile frames. Fill color from `status.*.color` mapped via
    `dialColor()`.
  - **CENTER (`.mb-center`, under the nav):** 8 controls styled as
    `.nav-menu-item`: an Xray **state indicator** (dot + Running/Stopped) +
    Stop · Restart · Backup&Restore · Logs · System History · Xray Metrics ·
    Xray Version (opens the version-switch modal).
  - **RIGHT (`.mb-right`, under theme/lang/logout):** categorized text — colored
    ↑/↓ speed, a TCP/UDP row, two colored **uptime pills** (Xray / OS, the label
    is only in `title`), and a stacked **IPv4/IPv6 column** (unlabeled, blurred,
    with the eye-toggle button where the old × used to be).
- **`src/pages/index/IndexPage.tsx` / `.css`** — now just the hero + the 5 feed
  sections. No status, no modals, no panel (all moved to MetricsPanel).
- **Deleted:** `StatusCard.{tsx,css}`, `XrayStatusCard.{tsx,css}` (the old dial
  cockpit + xray card — superseded by the bar).

### 10.3 Hard constraints already baked in

- **GLASS RULE (§2.4) for the bar:** it animates via **`max-height` only**
  (+ `overflow:hidden`), never transform/opacity — otherwise the frosted glass on
  the bar dies. Keep it that way.
- **Content pruned per the user (do NOT re-add):** Telegram link, GitHub link,
  Config viewer, 3X-UI panel version + panel-update feature, Threads, numeric
  app-RAM, total sent/received. (It's a fork → upstream version/update is moot.)
- Commits so far: `c50bd10` (first DS-tile consolidation, since superseded),
  `0ec3f72` (pull-down panel + hero), `74a6a77` (full-width header-mirrored bar),
  `9c7b6d7` (alignment + seam attempt + right-zone categories). tsc 0, suite
  397/25, `vite build` OK at each.

### 10.4 ✅ DONE (commits `89037bf`, `e9a5bf5`, + the particle commit)

All four reviewed requirements are implemented and user-confirmed:
1. **Fixed-size buttons + zones.** Header nav + bar controls share explicit CSS
   vars `--nav-btn-w: 98px` / `--nav-gap: 8px` / `--nav-btn-h: 46px` (centered
   8-col grids) so button N is pixel-aligned over bar control N; the logo zone +
   gauge band share `--side-zone-w: 212px`.
2. **Route-based active state.** `AppSidebar` tracks a `clickedKey` + route-derived
   `routeKey` (hash-section clicks use `history.pushState`, which doesn't update
   the router hash — hence the explicit click tracking). Plus **Overview now
   `navigate('/')`** (clears any `#section` hash so a reload doesn't bounce back,
   and Overview no longer toggles the metrics bar — only the logo does).
3. **6 uniform pills.** Right zone = IP column (left) + a 2×88px grid of 6 pills
   (speed×2, conn×2, uptime×2), sitting under — and no wider than — the
   logout/theme/lang button zone. Topbar is `user-select:none`; redundant
   tooltips dropped.
4. **Blur seam fixed.** Header + bar share ONE fixed `.topbar-shell` carrying the
   only `backdrop-filter` (both rows transparent); content offset by 72px. One
   glass surface, no seam.

### 10.4b Particle field — morph experiment ABANDONED (reverted)

The user wanted the particle field to morph into a hovered button's icon
(antigravity.google style). It was prototyped (a `stars` ParticleField variant +
`particleMorph.ts` channel + `iconPoints.ts` rasterizer + a Stop-button hover),
but the user dropped it: the real site's effect is proprietary/minified (can't be
copied) and a from-scratch recreation wasn't worth it. **All of that was reverted.**
The original air-hockey **puck** `ParticleField` is restored and now used
identically on **panel + login + sub** (SubPage gained a `.sub-particle-canvas`).
If revisited: the technique is just particles easing to shape-sampled target
points — the feel is all in fast/staggered easing + nearest-particle assignment.

### 10.5 Phase 2 (notifications — NOT started)

The user wants the bar to also host actionable notifications (separate phase):
- An **"unsaved changes / restart needed"** banner with **Save** + **Restart
  panel** buttons (needs a global "dirty" state + the relevant endpoints).
- **Security warnings** sourced from `…/panel/settings`.
- Xray-core crash errors (already available via `status.xray.errorMsg` — the bar
  already shows the state dot; a full error surface can live here too).

> Next agent: §10.4 is fully done (header/bar polish + seam). The particle-morph
> idea was abandoned (§10.4b) — field is back to the puck variant, unified across
> panel/login/sub. **Open: §10.5 phase-2 notifications** (unsaved/restart banner,
> security warnings, xray-error surface). Keep the glass-rule max-height
> animation on the bar. tsc/suite/build must stay green; never stage
> `vite.config.js`.
