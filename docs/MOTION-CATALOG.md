# Window, loading and interaction motion

Every project includes a detailed `effects.json` and README with implementation references. This cross-project index helps select an effect; it distinguishes native windows from renderer overlays.

| Project / effect | Original behavior | Reuse entry |
| --- | --- | --- |
| AngeronaSuite window opening | Widening native window mask, **360 ms OutCubic**. | `source/src/angerona/gui/header_controls.py`; project showcase. |
| AngeronaSuite window closing | Reverse mask, **max(90, 320 × progress) ms InCubic**. Completion determines actual close/hide handling. | Same controller and its application wiring. |
| Angerona orb collapse/restore | Animated trail connecting full window and holographic orb, **440 ms InOutCubic**. Main minimize/close controls use the orb lifecycle. | `gui/holographic_orb.py`, original main-window wiring. |
| Angerona radial menu | Orb menu expands/collapses over **260 ms OutCubic**. | `gui/holographic_orb.py`. |
| Angerona indicators | Paint/timer-based progress, ambient telemetry, global loading and character/evidence art; detailed classes in its catalog. | `gui/animations.py`, `system_pulse.py`, `orbital_dashboard.py`, and related presentation modules. |
| Optimus window opening | Native mask reveal, **240 ms OutCubic**. | `source/src/optimus/widgets/header_controls.py`. |
| Optimus window closing | Reverse mask, **max(80, 180 × progress) ms InCubic**; coordinates child dialogs. | Same controller. |
| Optimus loading | Progress ring animation; section-local custom-GIF player; starfield ambience. The original 54-frame third-party art is omitted from the open-source release. | `widgets/loading.py`, `widgets/local_loading.py`, extracted starfield. Keep asset notice. |
| Palamedes power on | Renderer starts `opening`, enters `on` at **1050 ms**. Overlay's **950 ms** boot fade/scale, **900 ms** loading strip. | `original/src/App.jsx`, `styles.css`; namespaced reusable effects. |
| Palamedes power off | **350 ms** overlay fade-in, **400 ms** shell dim, then standby at **500 ms**. Native window stays open. | `powerOff()` and `.power-closing`. |
| Palamedes lazy workspace loader | Circular orbit rotation, **1800 ms linear infinite**. | `Loading`, `.loading-orbit`; reusable loading orbit. |
| Palamedes screen / popup | Screen entrance **300 ms**, mode picker **160 ms**, backdrop and toast **200 ms**. Settings/toast exit removes the node immediately. | Named original CSS keyframes; reusable screen/modal examples. |
| Palamedes busy / mobile | Busy spinner **1000 ms**; mobile slide **250 ms**; common control transitions **180 ms**. | Original component and responsive CSS. |

The simple `source://angerona-legacy` legacy copy has no authored opening animation; close hides to tray. Palamedes' Electron shell shows at `ready-to-show` and uses native close/minimize without a custom native tween. These absences are recorded so future integrations do not mistake a browser power effect for a native window effect.

The source snapshot establishes implementation intent. New recordings show the isolated components exercised with synthetic content, where available. Existing upstream demonstration GIFs retain their original captions. A screenshot alone establishes appearance, not timing.
