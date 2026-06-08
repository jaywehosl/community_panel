# Redesign — open TODOs

## Dialog / modal canon (DONE — reference pattern for ALL modals)

The DS `Dialog` (`src/components/ds/Dialog.tsx` + `.ds-dialog__*` in `ds.css`) is the
canonical modal. Every modal in the app should use it (or copy this exact recipe) — do
NOT hand-roll a positioned/translated modal. Verified live, no jump.

Recipe (why each part matters):
- **Centring via a flex viewport**, NOT `translate(-50%,-50%)`:
  `RDialog.Content` is wrapped in `<div class="ds-dialog__viewport">` (fixed inset:0,
  `display:flex; align-items/justify center`, `pointer-events:none`). Content is
  `position:relative; pointer-events:auto`. → integer position, no permanent transform
  layer that "settles" and nudges text up ~2px on open.
- **Pop animation is scale-only** (`@keyframes ds-pop-in/out` = opacity + `scale`), at
  rest `scale(1)` (identity) → nothing to re-rasterise after the animation.
- **Symmetric in/out** via Radix `data-state` (`[data-state='open']` / `[data-state='closed']`
  + `forwards`), opacity/transform only (GPU, real refresh rate).
- **Overlay** = strong plain page blur (`blur(22px)` + neutral 0.18 scrim), no milky veil.
- **`html { scrollbar-gutter: stable }`** (page-shell) so locking body scroll never shifts
  content width.

Fixed bugs (all verified): modal-open ~2px jump ✅, switch track drift ✅, horizontal
page shift ✅, switch thumb first-paint position (animate `left`, not transform) ✅,
asymmetric/flickering open-close ✅.

## Polish pass (after migration) — deferred
- Client modals have layering/z-index glitches (e.g. a Tooltip rendering under the
  QR Popover panel). Audit DS overlay z-indexes (dialog 1001 / popover 1100 /
  tooltip 1200) + nested portals inside Dialog; fix stacking order. Reported by user.
- General "more organic" spacing/composition pass across migrated pages.

## NEXT: continue page migration
- ✅ nodes (full), ✅ groups (pilot), ✅ Panel Settings (full).
- **clients** next, then **inbounds** / **xray** (the monsters).
- `SubJsonFinalMaskForm` (settings) still rides the shared xray transport `Form`
  lib (`@/lib/xray/forms`) — migrate it together with the inbounds/xray forms.
- DS library now: Button, Card, Input/Field, Tag, Stat, Dialog, DropdownMenu,
  Tooltip, Switch, Select, Alert, Divider, Tabs, DataTable(sort/select/expand).
- Canon locked & reuse everywhere: modal (flex-viewport + scale anim), fields=
  login, buttons=header Log Out pill, Select menu=header language dropdown,
  tabs=header-nav pills (no underline, instant content swap — NEVER animate a
  container holding glass children), switch=standard toggle, overlay=plain blur.

## Notes / gotchas (learned this session)
- `backdrop-filter` dies if ANY ancestor has transform / opacity<1 / filter / animation /
  will-change / contain / isolation. The `.feed-section` entrance animation silently broke
  panel glass for two sessions. Never wrap glass surfaces in such elements.
- **CANON — never animate a CONTAINER that holds glass/backdrop-filter children.**
  Animating `opacity` (or transform) on a wrapper (tab content, accordion body, list, any
  group of frosted inputs/cards/selects) makes it a compositing group → the children's
  blur is disabled for the duration → they "flicker / catch up" the frost. Swap such
  content INSTANTLY (no enter animation). Only animate leaf elements that have NO
  backdrop-filter, or the glass element's OWN opacity (e.g. the dialog overlay fading
  itself is fine). Applied to `.ds-tabs__content` (instant swap).
- The automated browser tab runs backgrounded (`document.hidden`), which pauses the
  particle rAF — screenshots taken via automation show a blank canvas. Visual verification
  of glass/particles must be done by the user on the active tab.
- `vite.config.js` holds the live server target + base path (secret) — never commit it.
