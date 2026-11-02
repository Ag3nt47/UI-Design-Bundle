# Source provenance and collection policy

Captured November 2, 2026 from local projects owned or supplied by the user.

| Collection | Located source |
| --- | --- |
| Angerona main | `source://angerona-primary`, resolved from the user's desktop shortcut. |
| Angerona legacy | `source://angerona-legacy`, a smaller PySide6 implementation with distinct layout. |
| Optimus current | Desktop shortcut points to `source://optimus\Releases\0.12.31\Optimus.exe`; authored source comes from its adjacent source distribution. |
| Optimus historical | Release/source distributions under `source://optimus`, plus earlier desktop backups under `source://optimus-history`. The project inventory records selected paths and differences. |
| Palamedes | `source://palamedes`, version 1.0.0, repository declared in its original package file. |

Each project's extraction manifest records the actual copied paths and SHA-256 hashes. Where a source directory is a filesystem distribution rather than a Git checkout, no source commit is asserted. Collection commits identify the bundle's snapshots, not the upstream project's release identity.

The collection preserves authored UI and supporting source needed to trace appearance and interaction. Imports that connect UI to application models remain visible in original source, while standalone showcases use synthetic state. It excludes private runtime databases, local credentials and environments, installed dependencies, security/maintenance engine distributions, installers, caches and large build artifacts. Original projects were read without modifying their code.

`source/` / `original/` and historical content-addressed objects are preserved source. `reusable/`, `showcase.py`, tools and gallery studies are adaptations or harnesses and are labeled accordingly. Existing public demo media is copied as visual reference, with its synthetic/demo labels retained. New captures document their method in `VALIDATION.md`.

The source catalog and licenses are the authority for individual files. Source roots use non-identifying aliases. Relative source paths and published hashes make copies verifiable; pre-redaction hashes preserve traceability when publication privacy edits change a file. No private local source map is included.
