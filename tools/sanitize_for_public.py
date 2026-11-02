"""Redact local identity references and refresh copied-source digests.

Copyright/license notices are retained. Original digests are opaque provenance;
the published SHA256 fields always describe the actual sanitized bytes.
"""
from pathlib import Path
import argparse
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[1]
TEXT = {".py", ".js", ".jsx", ".cjs", ".mjs", ".json", ".toml", ".md", ".txt", ".html", ".css", ".yml", ".yaml", ".svg", ".ps1", ".bat", ".cmd"}
SKIP = {".git", ".local", "node_modules", "__pycache__", ".venv", "venv"}

def legal(file):
    name = file.name.upper()
    return name.startswith(("LICENSE", "LICENCE", "NOTICE")) or name.endswith("-NOTICE.TXT") or name == "THIRD_PARTY_NOTICES.MD"

def redact(text, redactions):
    protected = []
    def protect(match):
        protected.append(match.group(0))
        return f"__PRESERVED_COPYRIGHT_{len(protected)-1}__"
    text = re.sub(r"(?im)^.*copyright.*$", protect, text)
    for before, after in redactions:
        for value in dict.fromkeys((before.replace("\\", "\\\\"), before, before.replace("\\", "/"))):
            text = re.sub(re.escape(value), lambda _: after, text, flags=re.I)
    text = re.sub(r"\b(?:DESKTOP|LAPTOP)-[A-Z0-9]{4,}\b", "EXAMPLE-PC", text)
    for i, line in enumerate(protected):
        text = text.replace(f"__PRESERVED_COPYRIGHT_{i}__", line)
    return text

def refresh_entries(node, base):
    if isinstance(node, dict):
        target = node.get("bundleRelative", node.get("path"))
        if target and "sha256" in node:
            file = base / target
            if file.is_file():
                digest = hashlib.sha256(file.read_bytes()).hexdigest()
                if digest != node["sha256"]:
                    node.setdefault("original_sha256", node["sha256"])
                    node["sha256"] = digest
                    if "bytes" in node:
                        node["bytes"] = file.stat().st_size
                    node["privacy_redacted"] = True
        for value in node.values():
            refresh_entries(value, base)
    elif isinstance(node, list):
        for value in node:
            refresh_entries(value, base)

def main():
    args = argparse.ArgumentParser(description=__doc__)
    args.add_argument("--apply", action="store_true")
    args.add_argument("--private-map", type=Path, required=True,
                      help="External JSON {redactions: [[privateValue, replacement], ...]}; never put this file in the repository")
    options = args.parse_args()
    apply = options.apply
    if options.private_map.resolve().is_relative_to(ROOT):
        raise SystemExit("The private redaction map must be outside this bundle")
    redactions = json.loads(options.private_map.read_text(encoding="utf-8"))["redactions"]
    changed = []
    for file in sorted(ROOT.rglob("*")):
        if not file.is_file() or SKIP.intersection(file.relative_to(ROOT).parts) or legal(file):
            continue
        if file.suffix.lower() not in TEXT:
            continue
        raw = file.read_bytes()
        try:
            text = raw.decode("utf-8-sig")
        except UnicodeDecodeError:
            continue
        result = redact(text, redactions)
        if result != text:
            changed.append(file.relative_to(ROOT).as_posix())
            if apply:
                file.write_text(result, encoding="utf-8", newline="")
    if apply:
        for project in (ROOT / "projects").iterdir():
            for file in (project / "extraction-manifest.json", project / "variants/index.json"):
                if file.is_file():
                    data = json.loads(file.read_text(encoding="utf-8-sig"))
                    refresh_entries(data, project)
                    data["publication_privacy"] = "Local identifiers and owner-specific non-legal links redacted. sha256 describes published bytes; original_sha256, when present, is the pre-redaction digest. Historical object directories retain their original-source identifier. Required legal attribution retained."
                    file.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        report_file = ROOT / "docs/privacy-report.json"
        prior = json.loads(report_file.read_text(encoding="utf-8-sig")) if report_file.is_file() else {}
        all_changed = sorted(set(prior.get("changedFiles", [])) | set(changed))
        report = {**prior, "applied": True, "changedFiles": all_changed,
                  "retained": ["required copyright and license notices", "repository hosting account"],
                  "policy": "Remove collection-machine paths, personal names/emails and owner-specific non-legal links. Synthetic/demo screenshots only. No credentials or live data."}
        report_file.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"applied": apply, "changedFiles": len(changed), "files": changed}, indent=2))

if __name__ == "__main__":
    main()
