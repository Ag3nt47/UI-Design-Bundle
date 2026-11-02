# Implement these interfaces in a new project

## Choose a starting point

| What you want | Copy and adapt |
| --- | --- |
| Angerona's complete dark dashboard look | `projects/angerona/source/src/angerona/gui/theme.py`, the desired widget, and its explicitly imported presentation helpers. Use the project design token catalog as the palette reference. |
| Angerona native window reveal and reverse close | `gui/header_controls.py` with its mask overlay/controller; study `showcase.py` for a service-free connection. Keep the animation object alive for its full lifetime. |
| Angerona orb and collapse/restore | `gui/holographic_orb.py`, the `CollapseTrail` and orb classes, and the original `main_window.py` wiring documented in the project guide. The orb effect is separate from ordinary panel opening. |
| Optimus native window reveal and reverse close | `projects/optimus/source/src/optimus/widgets/header_controls.py`. Preserve its reduced-motion handling and child-dialog coordination. Do not call `close()` before its reverse animation finishes. |
| Optimus progress rings and local loading | `widgets/loading.py` and `widgets/local_loading.py`, plus their assets/notices. Progress rings and local button/section busy states have different lifecycles. |
| Optimus starfield | Its extracted `reusable/starfield.py` and the showcase; retain the paint/timer behavior and stop timers when hidden. |
| Palamedes motion without the math application | `projects/palamedes/reusable/PalamedesEffects.jsx` and `palamedes-effects.css`. See that directory's README for imports and lifecycle examples. |
| Palamedes instrument case and backlight | The `.instrument-shell`, `.instrument-top`, `.instrument-screen`, `.instrument-bottom` markup in `original/src/App.jsx` and matching original CSS rules. Keep `--backlight` and `--screen-brightness` as theme inputs. |
| Palamedes skins and complete workspace | `original/src/styles.css`, the desired component and its imports. The original stylesheet has global rules; scope them before embedding into an established application. |
| An older Optimus visual treatment | Read the Optimus variants inventory and materialization instructions; compare content hashes before copying. |

Paths above are relative to the repository, with `gui/` shorthand scoped to the relevant project's extracted `src` tree. Exact signatures and source references are in each project guide; source code is authoritative.

## Port the design deliberately

1. Select a single reference screen and theme. Copy its token values, typography stack, corner radii, spacing, borders, gradients and shadows before combining themes.
2. Copy one presentation component and its necessary imports. Replace service callbacks, process actions and telemetry providers with explicit inputs from the new application.
3. Model motion as states: opening → open → closing → closed, and idle → busy → complete/error. Preserve the original easing and timings. Treat close as asynchronous when an exit effect is running.
4. Keep animation/timer ownership explicit. Cancel stale callbacks on unmount/destruction, prevent a delayed shutdown from overriding a new opening action, and clean up overlays when their target disappears.
5. Preserve keyboard access, focus, contrast and reduced-motion behavior. Native Qt masks and browser transforms use different rendering systems; compare the result visually at normal and high DPI.
6. Retain the original license and asset notices beside copied code. Test the new application with synthetic data before connecting its real services.

## Framework boundaries

Angerona and Optimus use **PySide6 / Qt Widgets**: custom `paintEvent` art, Qt timers, `QVariantAnimation` / property animations, window masks and native widget ownership. They are directly reusable in another Qt application. A React port must reconstruct the drawing and lifecycle in canvas, SVG or CSS; simply copying a Python class into JavaScript does not preserve behavior.

Palamedes uses **React / CSS** in a browser or Electron renderer. Its reusable effect components need React and their CSS; the entire original renderer also needs the dependencies in its package lock. The boot strip is decorative timed progress. A real task's progress value should come from the task rather than from that timer.

The gallery includes browser studies of native reveals to make their timing easy to compare. Those studies are labeled adaptations. Use the Qt implementations to obtain actual native window behavior.

## Run the visual references

Follow the project README for each showcase. They are intentionally separate from normal application entry points. The original UI source is preserved for reference; importing the complete main application can create services, timers, network clients or system operations. Use the explicit showcase entry points while evaluating visuals.

When integrating only styles, do not copy application configuration, user data or secrets. This collection includes no API keys and does not require provisioning any key to preview the effects.
