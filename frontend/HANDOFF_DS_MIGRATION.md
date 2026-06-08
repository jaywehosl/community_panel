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
  - ⚠️ **`FinalMaskForm`'s antd branch is STILL needed** — `SubJsonFinalMaskForm`
    (settings) still passes `form={form}` (showAll mode). Don't remove the antd
    branch until the Settings/SubJson phase is migrated.

---

## 5. What REMAINS (priority order)

`grep -rl "from 'antd'\|@ant-design/icons" src` shows ~100 files still on antd.
Big clusters, roughly in dependency order:

1. ~~**Outbounds**~~ ✅ **DONE** (commits `cddac16`, `b1533ba`) — see §4.
   Note: `FinalMaskForm`'s antd adapter still can't be removed yet because
   `SubJsonFinalMaskForm` (settings) still uses it.
2. **Inbound list + info + QR:** `src/pages/inbounds/list/` (`InboundList`,
   `RowActions`, `useInboundColumns`), `inbounds/info/InboundInfoModal.tsx` (~839
   lines), `inbounds/qr/` (`QrCodeModal`, `QrPanel`).
3. **Xray page tabs:** `src/pages/xray/` — `XrayPage`, `basics/BasicsTab`,
   `routing/*` (RoutingTab, RuleFormModal, RuleCardList, CriterionRow,
   RoutingBasic, useRoutingColumns), `dns/*` (DnsTab, DnsServerModal,
   DnsPresetsModal, useDnsColumns), `balancers/*`, `overrides/*` (Nord/Warp),
   `SubJsonFinalMaskForm` (settings).
4. **Clients leftovers / QR:** `ClientQrModal`, `ClientInfoModal` layering, any
   remaining antd in `clients/*`.
5. **Settings:** `src/pages/settings/*` (GeneralTab, SecurityTab, Telegram,
   Subscription*, TwoFactorModal, SettingsPage).
6. **Index/dashboard modals:** `src/pages/index/*` (many modals: Log, Backup,
   Version, PanelUpdate, SystemHistory, XrayLog/Metrics, CustomGeo...).
7. **Sub pages:** `src/pages/sub/*`, `src/entries/*`.
8. **Shared shims:** `components/ui/*` (PlanVerificationModal, SettingListItem,
   TelemetryGuideOverlay), `components/feedback/*` (PromptModal, TextModal).
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
3. Pick the next subsystem from §5 (Outbounds is now done — recommended next:
   **Inbound list/info/QR** or **Xray page tabs**), apply §6 recipe.
4. Confirm scope/approach with the user if a decision has trade-offs (they chose
   "full controlled rewrite, no antd Form abstraction" for forms; keep to that).
5. Atomic commit, locally, no push, no `vite.config.js`.

> Current branch tip: `b1533ba` (outbounds display layer) on
> `redesign/ds-foundation`. Inbound modal + **Outbounds** subsystems = done;
> §5 items 2–9 = open. Suite green at 397/25 files.
