"""Validate copied identities and parse every archived Python UI source."""
from __future__ import annotations

import ast
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
manifest = json.loads((ROOT / "extraction-manifest.json").read_text(encoding="utf-8"))
manifest["primary_source"] = "angerona-primary"
manifest["legacy_source"] = "angerona-legacy"
manifest["files"] = [item for item in manifest["files"] if item["path"] not in {
    "media/screenshots/github-tools-credits-demo.png", "media/demo/angerona-demo.gif"
}]
manifest["omitted_public_media"] = [
    "Optional third-party credits screenshot and original full demo GIF omit author identities from public presentation. Required legal notices are retained."
]
for item in manifest["files"]:
    item["source_root"] = "angerona-legacy" if item["path"].startswith("legacy/") else "angerona-primary"
(ROOT / "extraction-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
failures = []
for item in manifest["files"]:
    target = ROOT / item["path"]
    if not target.is_file() or hashlib.sha256(target.read_bytes()).hexdigest() != item["sha256"]:
        failures.append("Hash mismatch: " + item["path"])
python_files = list((ROOT / "source").rglob("*.py")) + list((ROOT / "legacy").rglob("*.py")) + [ROOT / "showcase.py"]
for path in python_files:
    try:
        ast.parse(path.read_text(encoding="utf-8-sig"), filename=str(path))
    except (SyntaxError, UnicodeError) as error:
        failures.append(str(error))
for name in ["effects.json", "design-tokens.json"]:
    json.loads((ROOT / name).read_text(encoding="utf-8"))
catalog = json.loads((ROOT / "effects.json").read_text(encoding="utf-8"))
for item in catalog["effects"]:
    lines = (ROOT / item["source"]).read_text(encoding="utf-8").splitlines()
    leaf = item["symbol"].split(".")[-1]
    if not any(leaf in line for line in lines[max(0, item["line"] - 2): item["line"] + 2]):
        failures.append("Effect source reference mismatch: " + item["id"])
report = {
    "snapshot_date": "2026-11-02", "original_files_hash_verified": len(manifest["files"]),
    "python_files_parsed": len(python_files), "effect_references_verified": len(catalog["effects"]),
    "failures": failures,
    "scope": "Static syntax, copied source identity, machine-readable catalog links. Runtime showcase capture separately validates the selected original widgets.",
}
(ROOT / "validation.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, indent=2))
raise SystemExit(bool(failures))
