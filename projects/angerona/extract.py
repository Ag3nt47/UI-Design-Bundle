"""Recreate the Angerona UI archive from explicitly selected local sources."""
from __future__ import annotations

import hashlib
import argparse
import json
import shutil
import sys
from pathlib import Path

DEST = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--source-root", type=Path, required=True)
parser.add_argument("--legacy-root", type=Path)
parser.add_argument("--additional-media", action="store_true")
args = parser.parse_args()
ROOT = args.source_root.resolve()
LEGACY = args.legacy_root.resolve() if args.legacy_root else None
records: list[dict] = []


def copy(source: Path, relative: str, *, source_root: Path = ROOT) -> None:
    target = DEST / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)
    raw = target.read_bytes()
    records.append({
        "path": relative,
        "source_root": "angerona-primary" if source_root == ROOT else "angerona-legacy",
        "source_path": source.relative_to(source_root).as_posix(),
        "sha256": hashlib.sha256(raw).hexdigest(),
        "bytes": len(raw),
        "modified": False,
    })


if args.additional_media:
    manifest_file = DEST / "extraction-manifest.json"
    existing = json.loads(manifest_file.read_text(encoding="utf-8"))
    records = [item for item in existing["files"] if not item["path"].startswith("media/diagrams/")]
    for source in sorted((ROOT / "assets").glob("security-flow-*.png")):
        copy(source, "media/diagrams/" + source.name)
    existing["files"] = records
    manifest_file.write_text(json.dumps(existing, indent=2) + "\n", encoding="utf-8")
    print("Added original security-flow diagram media")
    raise SystemExit(0)

for source in sorted((ROOT / "src/angerona/gui").glob("*.py")):
    copy(source, "source/src/angerona/gui/" + source.name)
for relative in [
    "src/angerona/__init__.py", "src/angerona/core/__init__.py",
    "src/angerona/core/background_pacing.py", "src/angerona/core/eventbus.py",
    "src/angerona/resilience/status_ui.py", "blackbox_recorder.py",
    "flow_canvas.html", "LICENSE", "pyproject.toml", "requirements.txt",
]:
    source = ROOT / relative
    if source.is_file():
        copy(source, "source/" + relative)
for directory, destination in [
    ("assets/icons", "source/assets/icons"),
    ("assets/screenshots", "media/screenshots"),
    ("assets/demo", "media/demo"),
]:
    for source in sorted((ROOT / directory).iterdir()):
        if source.name in {"github-tools-credits-demo.png", "angerona-demo.gif"}:
            continue  # Public bundle omits optional media with author identities.
        if source.is_file() and source.suffix.lower() in {".png", ".gif", ".jpg", ".jpeg", ".ico", ".svg", ".webp"}:
            copy(source, destination + "/" + source.name)
for source in sorted((ROOT / "assets").glob("security-flow-*.png")):
    copy(source, "media/diagrams/" + source.name)
if LEGACY:
    for source in sorted((LEGACY / "src/angerona/gui").glob("*.py")):
        copy(source, "legacy/src/angerona/gui/" + source.name, source_root=LEGACY)
    copy(LEGACY / "LICENSE", "legacy/LICENSE", source_root=LEGACY)

manifest = {
    "project": "Angerona", "snapshot_date": "2026-11-02", "source_version": "1.15.0",
    "primary_source": "angerona-primary", "legacy_source": "angerona-legacy" if LEGACY else None,
    "scope": "All primary GUI Python modules; original small dependency boundary; secondary UI source contexts; icons; pre-existing public-demo media; legacy GUI.",
    "omitted": ["host telemetry", "runtime data", "credentials", "backend modules", "virtualenv", "git internals", "caches", "build output", "private analysis"],
    "files": records,
}
(DEST / "extraction-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
print(f"Copied {len(records)} original files; {sum(x['bytes'] for x in records):,} bytes")
