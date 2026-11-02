"""Validate preserved bytes, collection links, syntax, and publication exclusions."""
from pathlib import Path
import ast
import argparse
import hashlib
import json
import re
import sys
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
SKIP = {".git", ".local", "node_modules", "__pycache__", ".venv", "venv"}
TOKEN_PATTERNS = [
    re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}\b"),
    re.compile(r"\bgithub_pat_[A-Za-z0-9_]{40,}\b"),
    re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9_-]{40,}\b"),
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
]

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", type=Path, help="Write or refresh the JSON validation report")
    options = parser.parse_args()
    failures = []
    manifests = []
    total = 0
    for project in ("angerona", "optimus", "palamedes"):
        base = ROOT / "projects" / project
        manifest = base / "extraction-manifest.json"
        if not manifest.exists():
            failures.append(f"Missing manifest: {manifest.relative_to(ROOT)}")
            continue
        document = json.loads(manifest.read_text(encoding="utf-8-sig"))
        entries = document.get("files", document.get("entries", []))
        if not entries:
            failures.append(f"Empty extraction manifest: {project}")
        for entry in entries:
            relative = entry.get("bundleRelative", entry.get("path"))
            file = (base / relative).resolve()
            if not file.is_relative_to(base.resolve()):
                failures.append(f"Manifest path escapes project: {relative}")
                continue
            if not file.is_file():
                failures.append(f"Missing preserved file: {project}/{relative}")
                continue
            data = file.read_bytes()
            if hashlib.sha256(data).hexdigest() != entry["sha256"]:
                failures.append(f"Hash mismatch: {project}/{relative}")
            if "bytes" in entry and len(data) != entry["bytes"]:
                failures.append(f"Size mismatch: {project}/{relative}")
            total += len(data)
        manifests.append({"project": project, "preservedFiles": len(entries)})
        for required in ("README.md", "effects.json", "design-tokens.json"):
            if not (base / required).is_file():
                failures.append(f"Missing catalog: {project}/{required}")

    scanned = 0
    python_files = 0
    for file in ROOT.rglob("*"):
        if not file.is_file() or SKIP.intersection(file.relative_to(ROOT).parts):
            continue
        rel = file.relative_to(ROOT)
        if file.name == ".env" or (file.name.startswith(".env.") and file.name != ".env.example"):
            failures.append(f"Excluded environment file: {rel}")
        if file.suffix.lower() in {".py", ".js", ".jsx", ".cjs", ".mjs", ".json", ".toml", ".md", ".txt", ".html", ".css"}:
            text = file.read_text(encoding="utf-8-sig", errors="replace")
            scanned += 1
            for pattern in TOKEN_PATTERNS:
                if pattern.search(text):
                    failures.append(f"Credential-shaped content requires review: {rel}")
            if file.suffix == ".py":
                try:
                    ast.parse(text, filename=str(rel))
                    python_files += 1
                except SyntaxError as exc:
                    failures.append(f"Python syntax: {rel}:{exc.lineno}: {exc.msg}")
            # Original documents keep their upstream links, including omitted engine/build files.
            if file.suffix == ".md" and not {"source", "original", "legacy", "objects", "reference"}.intersection(rel.parts):
                for target in re.findall(r"\]\(([^)]+)\)", text):
                    target = target.strip("<>").split("#", 1)[0]
                    if not target or re.match(r"[a-zA-Z][a-zA-Z0-9+.-]*:", target):
                        continue
                    if not (file.parent / unquote(target)).exists():
                        failures.append(f"Broken collection link: {rel} -> {target}")

    result = {"success": not failures, "manifests": manifests, "preservedBytes": total,
              "textFilesScanned": scanned, "pythonFilesParsed": python_files, "failures": failures}
    if options.report:
        saved = json.loads(options.report.read_text(encoding="utf-8-sig")) if options.report.is_file() else {}
        saved.update(result)
        options.report.write_text(json.dumps(saved, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))
    return 0 if not failures else 1

if __name__ == "__main__":
    sys.exit(main())
