# Palamedes UI source collection

An instrument-inspired mathematics workspace: a fixed navigation rail, finely labeled control surface, a metal-like beveled screen enclosure, blue display backlighting, tactile calculator keys, graph and code workspaces, and a full-screen power sequence. This collection preserves the complete authored renderer source so that every workspace and its visual states can be reused.

## Provenance

- Local source: `source://palamedes`, captured November 2, 2026.
- Repository declared by its package: [example/Palamedes](https://github.com/example/Palamedes).
- Version `1.0.0`; React 19.2, Vite 7.2, Electron 39.8; MIT, copyright 2026 Ag3nt47. Keep [LICENSE](LICENSE) with reused portions. Third-party packages retain their own licenses.
- `original/` contains source snapshots with documented publication privacy redactions, build entry points, package lock, public assets, Electron shell, and original tests. `extraction-manifest.json` records every copied file and its SHA-256. The local folder has no `.git` checkout, so this is a filesystem snapshot, not an asserted commit identity.
- `reusable/` contains a small, namespaced React/CSS adaptation of the power, screen, loader and modal effects. It has no mathematics, AI, OCR, updater, or Electron dependency.

## What is included

| UI family | Source and reusable detail |
| --- | --- |
| Application shell | [App.jsx](original/src/App.jsx), [styles.css](original/src/styles.css): 238 px grouped navigation rail, active edge/glowing dot, breadcrumb top bar, smart input, mode picker, settings, notifications, standby and boot screens. |
| Instrument frame | `styles.css` line 3: layered enclosure gradient, inset edge highlights, 20 px enclosure corners, inset screen shadow, configurable backlight halo, tiny model labels and grip. |
| Calculator | [Calculator.jsx](original/src/components/Calculator.jsx): scientific and numeric key grids, gradient keys with 2 px press travel, expression/result display, verification status, history, examples, and help cards. |
| Graphing | [Graphing.jsx](original/src/components/Graphing.jsx): expression-color rows, parameter sliders, split controls and plot layout, Cartesian/polar/parametric/implicit/3D modes, graph toolbar and data tables. Plotly is loaded lazily. |
| Solver | [Solver.jsx](original/src/components/Solver.jsx), [Solver.css](original/src/components/Solver.css): image drop area, OCR progress, solving states, numbered timeline, answer card, and pass/fail/inconclusive verification treatments. Main stylesheet applies a dark treatment over the component's original light rules. |
| Code workspace | [Sandbox.jsx](original/src/components/Sandbox.jsx), [Sandbox.css](original/src/components/Sandbox.css): language/program tabs, code editing area, run/stop toolbar, runtime status, console, plots and reference panel. |
| Other instruments | [Advanced.jsx](original/src/components/Advanced.jsx), [MLLab.jsx](original/src/components/MLLab.jsx), [Modules.jsx](original/src/components/Modules.jsx), [Textbook.jsx](original/src/components/Textbook.jsx), [Math.jsx](original/src/components/Math.jsx): forms, matrix/table/metric/result layouts, expandable equation reference, module cards and KaTeX rendering. |
| Themes and assets | Cyber, slate and CRT skins; ice, emerald, amber and off backlights; brightness control. [favicon.svg](original/public/favicon.svg), manifest and example module included. Logos and much of the decorative art are CSS/text, not missing image files. |
| Desktop shell | [main.cjs](original/desktop/main.cjs), [preload.cjs](original/desktop/preload.cjs), [update-policy.cjs](original/desktop/update-policy.cjs): dimensions, ready-to-show behavior, limited minimize/close bridge and native update dialogs. |

## Exact motion inventory

References are to the copied original files, preserving their original line layout. `styles.css` intentionally has long authored lines; search for the named selectors/keyframes within each line.

| Effect | Trigger, duration and behavior | Source |
| --- | --- | --- |
| Power on / opening | Initial phase is `opening`; switches to `on` after **1050 ms**. The overlay remains opaque through 70% of a **950 ms** animation, then fades and scales to **1.03**. | `App.jsx` lines 36, 39, 51, 55–56; `styles.css` lines 6–7, `boot-open`. |
| Startup loading strip | Left-origin horizontal scale from 0 to 1, **900 ms ease-out**, blue glow. This is a timed boot decoration, not measured job progress. | `styles.css` lines 6–7, `.boot-loader`, `loadbar`. |
| Power off / closing | Power control sets `closing`; reaches standby after **500 ms**. Overlay fades in over **350 ms**; shell and rail dim to brightness **0.6** over **400 ms**. | `App.jsx` lines 50, 55–56; `styles.css` line 6, `.power-closing`. |
| Workspace screen enter | Screen is remounted with `key={tab+nonce}`. **300 ms ease-out**, opacity **0.2 → 1**, vertical position **4 px → 0**. | `App.jsx` line 64; `styles.css` lines 3 and 7, `screen-open`. |
| Lazy workspace loader | Suspense fallback has a 72 px circular halo and rotating 38 px LoaderCircle, **1800 ms linear infinite**. | `App.jsx` lines 28 and 64; `styles.css` lines 6–7, `.loading-orbit`, `rotate`. |
| Mode picker enter | **160 ms ease-out**, opacity 0 → 1 and translateY(6 px)/scale(0.98) → rest. | `styles.css` lines 3 and 7, `.mode-picker`, `pop-in`. |
| Settings modal enter | Blurred backdrop fades in **200 ms**. Closing removes the element immediately; no authored modal exit animation. | `App.jsx` line 76; `styles.css` lines 6–7, `.modal-backdrop`, `fade-in`. |
| Toast enter | Same `pop-in` motion, **200 ms**. Toast clears after **5000 ms** or dismiss; no exit animation. | `App.jsx` lines 42 and 80; `styles.css` line 6. |
| Solver / OCR / runtime busy | `LoaderCircle.spin`, **1000 ms linear infinite**. OCR can use a conic-gradient progress wheel, where `--progress = percentage × 3.6deg`. | `Solver.jsx` lines 70–76 and 85; `Solver.css` line 1; `Sandbox.jsx` lines 105 and 108; `styles.css` line 6. |
| Graph engine loading | Text placeholder while Plotly imports; this state has no separate animated spinner. | `Graphing.jsx` line 52. |
| Mobile navigation | Below **760 px**, translateX(-100%) → 0 over **250 ms**; the reverse transition runs when navigation is dismissed. | `styles.css` line 11. |
| Hover, focus and keys | Shared **180 ms** background/color/border/shadow/transform transitions; keypad active state translates down **2 px** and removes shadow; toggle thumb **200 ms**. | `styles.css` lines 2–3. |
| Reduced motion | Animations/transitions reduced to **0.001 ms**, one iteration; power overlay hidden. React power-state timers still run. | `styles.css` line 13. |
| Native desktop window | Created hidden at **1440 × 980**, minimum **900 × 650**, shown on Electron `ready-to-show`. Native minimize and close use IPC. No custom native-window opening/closing tween was found. The renderer power effect leads to standby and does **not** close the native window. | `desktop/main.cjs` lines 50–67 and 152–153; `desktop/preload.cjs` lines 6–10. |

The extracted source is authoritative if a table line number shifts during later edits. [effects.json](effects.json) provides a machine-readable inventory; [design-tokens.json](design-tokens.json) lists exact palette and spacing values.

## Use the original UI

```powershell
node projects/palamedes/reusable/prepare-preview.mjs ../palamedes-ui-preview
cd ../palamedes-ui-preview
npm ci
npm run dev -- --port 5175
```

The captured source has a React 19 effect-cleanup defect: six storage effects return a Boolean. Use [the separate preview preparation workflow](reusable/STORAGE-EFFECT-FIX.md) before running it. The screenshots use that temporary compatibility fix; source visuals and timings are preserved. The archived implementation keeps that defect for provenance; publication redactions are tracked separately.

Open the localhost URL printed by Vite. A clean browser context starts with the calculator and AI disabled. Open Settings to switch Cyber / Angerona Slate / CRT, choose a backlight, or vary brightness. Use the top-right power icon to see shutdown and standby; choose Power on to replay startup. Switch workspaces to replay the screen entrance. To inspect a lazy loader reliably in browser devtools, disable caching and throttle the first workspace import.

Use `npm run build` for a browser build. `npm test` executes the retained original Node tests. The original package includes Electron tooling for provenance; launching `npm run desktop` also initializes its updater machinery. A desktop build additionally expects `public/icon.ico`, which was absent from the local source and is **not** fabricated here. Browser/Vite use does not require it.

## Implement the look in a new project

For a lightweight React integration, copy `reusable/PalamedesEffects.jsx` and `reusable/palamedes-effects.css`, import the stylesheet, and use the hook/components as shown in [reusable/README.md](reusable/README.md). All class names and keyframes are prefixed `pm-`; this avoids the global `button`, `input`, `h1`, `.panel`, and `*` rules in the original stylesheet.

For the complete enclosure, begin with `.instrument-shell`, `.instrument-top`, `.instrument-screen`, `.instrument-bottom`, and their child labels from `App.jsx` / `styles.css` line 3. Keep their CSS variables for backlighting and screen brightness. Mount the content with a changing key to replay `screen-open`. Copy the chosen workspace component plus its imports in `src/lib/`; the originals depend on calculation/formatting helpers even when the goal is visual reuse.

For a new theme, map the CSS variables from `design-tokens.json` to your design system and preserve the material layers: cool near-black background → raised panel → highlighted bezel → inset display. Use one primary blue action, muted micro labels, monospaced numeric data, and the original shadow/gradient recipes. Keep the shared state shapes (`loading`, `busy`, percentage, error/result) even if new application data replaces the mathematics.

Typography references `DM Sans`, `Segoe UI`, `JetBrains Mono`, `Cascadia Code`, `Consolas`, and Georgia; no custom font binaries or external font import are present. Fallback availability changes metrics. Icons are from `lucide-react`; mathematical typography is from KaTeX. Plotly and KaTeX provide some runtime visuals and assets through their packages, recorded in the original lockfile.

The full application includes optional user-triggered network features (AI solving, OCR language/worker assets, Python runtime and links), plus a desktop update service. The source is preserved to retain behavior and appearance; the namespaced reusable effects have no such services. Local browser histories, user programs and credentials are not included.
