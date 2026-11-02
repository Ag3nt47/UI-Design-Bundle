# Validation and capture methods

## Source integrity

The final `validation-report.json` is produced by `python tools/validate_bundle.py`. It verifies every extraction-manifest file against its published SHA-256 and byte count, parses Python source without importing application services, checks collection documentation links, and checks text for credential-shaped content. The privacy pass records pre-redaction digests separately when a copied file changes.

Before publication redaction, the project-specific checks verified 116 Angerona original files, 327 Optimus files, and 49 Palamedes files. Optimus' history includes 47 source distributions and 1,386 UI/asset references stored as 149 unique revisions. The manifest is the authority for final counts and any later additions. Non-open media exclusions reduced the published Optimus file list.

## Angerona

- Original public demonstration screenshots use explicitly synthetic data. The credits screenshot and original full walkthrough GIF were omitted from this public collection because they contained unnecessary author names/handles.
- `media/screenshots/effects-playground.png` is a new isolated Qt showcase of original presentation components, with synthetic content and no security services or desktop capture.
- `media/demo/effects-playground.gif` records 51 frames of that showcase, including a real reveal/close controller, loading widgets and orb collapse/restore. It composites only the showcase's own Qt content, masks and trail geometry; it does not claim to record the operating-system compositor.
- The showcase explicitly registers installed Segoe UI/Consolas fonts so offscreen rendering has readable glyphs. Font files are not bundled. A documented ASCII marker replaces the threat-overlay emoji only in the harness to avoid a headless color-emoji discovery stall; its original animation implementation remains preserved.
- Static checks parsed 83 Python sources and verified the 12 documented original effect references before the publication privacy pass. Screenshot and GIF generation exited successfully and were visually inspected.

## Optimus

- Selected existing fixture screenshots carry the provenance in `reference/media/manifest.json`: version 0.12.24, mock backend, synthetic metrics and no maintenance actions. The extracted current source is 0.12.31; those older captures are visual references rather than claimed recordings of the newer build.
- `reference/showcase.png` is a new synthetic rendering of the actual Qt widgets, starfield and loaders. `legacy-holographic-orb.png` exercises the historical original orb class without service callbacks.
- `reference/showcase-effects.gif` is an 82-frame offscreen composite of actual Qt window masks and widget content. Its companion JSON records mask state. Opening and closing include partial mask widths, demonstrating both directions of the real controller. Starfield and original Qt ring animations run in the recording. Third-party character artwork and the older captures containing it are omitted. The local custom-GIF player source remains available for an asset with a suitable license.
- All three showcase scripts ran successfully. Static validation parsed 294 Python files before the final publication pass. Native compositor, monitor-DPI and full maintenance-application behavior are outside this isolated visual check.

## Palamedes

The browser captures use a separate copy of the original renderer, fresh storage and blocked external requests. A six-effect React compatibility fix discards the Boolean returned by storage writes; otherwise React 19 StrictMode reports an invalid cleanup function and can unmount the application. The archived source is preserved apart from publication privacy substitutions. The [fix and preparation script](../projects/palamedes/reusable/STORAGE-EFFECT-FIX.md) are supplied for reuse.

Screenshots cover actual rendered application states rather than substitute mock screens. Boot/loading/shutdown motion uses the original CSS definitions with deterministic browser animation sampling. The lazy workspace loader is held by delaying its real module request. AI, OCR downloads, desktop updating and external network integrations are not invoked. All ten captured states passed nonblank pixel checks, the browser reported zero page errors, and a fresh preview production build passed (2,719 modules transformed).

## Gallery and publication

The static gallery embeds a generated catalog, so its filters and references work without a backend. Its small motion study is explicitly a CSS adaptation of selected timings; the original Qt implementations remain the authority for native window behavior. Reduced-motion CSS is provided.

Publication checks include a privacy redaction pass, visual review of selected captures, verification that required asset notices remain, and a final remote tree/readme check. No secrets, live runtime data, private source-location map or installed dependencies are included. Required legal attribution and the public hosting account remain visible as explained in [PRIVACY.md](PRIVACY.md).

Final collection check: **481 preserved files**, **385 Python files parsed**, no hash, source-syntax, collection-link or credential-scan failures. The offline gallery filter and window replay ran with zero browser page errors. See [the machine-readable result](validation-report.json).
