"""Rebuild the static, offline gallery and machine-readable collection index."""
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
NAMES = {"angerona": "Angerona", "optimus": "Optimus", "palamedes": "Palamedes"}
DESCRIPTIONS = {
    "angerona": "Cyan security workbench · holographic orb · mask reveal · live telemetry art",
    "optimus": "Cyber maintenance console · starfield · reverse close · ring and character loaders",
    "palamedes": "Math instrument · Cyber / Slate / CRT · power sequence · screen and orbit effects",
}

def main():
    projects = []
    media = []
    for key, name in NAMES.items():
        base = ROOT / "projects" / key
        manifest = json.loads((base / "extraction-manifest.json").read_text(encoding="utf-8-sig"))
        entries = manifest.get("files", manifest.get("entries", []))
        project = {"id": key, "name": name, "description": DESCRIPTIONS[key],
                   "readme": f"projects/{key}/README.md", "sourceFiles": len(entries),
                   "sourceBytes": sum(item.get("bytes", 0) for item in entries),
                   "effects": json.loads((base / "effects.json").read_text(encoding="utf-8-sig")),
                   "tokens": json.loads((base / "design-tokens.json").read_text(encoding="utf-8-sig"))}
        projects.append(project)
        for folder in (base / "media", base / "reference"):
            if folder.is_dir():
                for file in sorted(folder.rglob("*")):
                    if file.suffix.lower() in {".png", ".jpg", ".webp", ".gif", ".mp4", ".webm"}:
                        media.append({"project": key, "path": file.relative_to(ROOT).as_posix(),
                                      "label": file.stem.replace("-", " ").replace("_", " "),
                                      "kind": "video" if file.suffix.lower() in {".mp4", ".webm"} else "image",
                                      "provenance": "See project README and original media manifest"})
    for folder in (ROOT / "docs/screenshots", ROOT / "docs/animations"):
        if folder.is_dir():
            for file in sorted(folder.iterdir()):
                key = next((key for key in NAMES if file.name.startswith(key)), "palamedes")
                if file.suffix.lower() in {".png", ".gif", ".webp", ".mp4", ".webm"}:
                    # The mirrored Optimus cover also appears in the original references.
                    if file.name == "optimus.png":
                        continue
                    media.append({"project": key, "path": file.relative_to(ROOT).as_posix(),
                                  "label": file.stem.replace("-", " "),
                                  "kind": "video" if file.suffix.lower() in {".mp4", ".webm"} else "image",
                                  "provenance": "New UI-only capture; see docs/VALIDATION.md"})
    catalog = {"snapshotDate": "2026-11-02", "projects": projects, "media": media}
    (ROOT / "catalog.json").write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
    template = (ROOT / "gallery/template.html").read_text(encoding="utf-8")
    encoded = json.dumps(catalog, ensure_ascii=False).replace("</", "<\\/")
    (ROOT / "gallery/index.html").write_text(template.replace("/* COLLECTION_DATA */", encoded), encoding="utf-8")
    print(f"Built catalog for {len(projects)} projects and {len(media)} media references")

if __name__ == "__main__":
    main()
