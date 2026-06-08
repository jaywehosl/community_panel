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

## NEXT: continue page migration
- **Panel Settings** next (forms + tabs — likely add DS `Tabs` on Radix).
- Then **clients**, then **inbounds** / **xray** (the monsters).
- Modal canon (fields=login, buttons=logout, Select=header language dropdown,
  switch=standard toggle, overlay=blur) is locked — reuse it everywhere.

## Notes / gotchas (learned this session)
- `backdrop-filter` dies if ANY ancestor has transform / opacity<1 / filter / animation /
  will-change / contain / isolation. The `.feed-section` entrance animation silently broke
  panel glass for two sessions. Never wrap glass surfaces in such elements.
- The automated browser tab runs backgrounded (`document.hidden`), which pauses the
  particle rAF — screenshots taken via automation show a blank canvas. Visual verification
  of glass/particles must be done by the user on the active tab.
- `vite.config.js` holds the live server target + base path (secret) — never commit it.
