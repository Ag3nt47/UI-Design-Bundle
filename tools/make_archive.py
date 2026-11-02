"""Create a portable ZIP beside the bundle, excluding installed dependencies."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

EXCLUDED = {".git", ".local", "node_modules", "__pycache__", ".venv", "venv"}

if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    output = root.parent / (root.name + ".zip")
    files = sorted(p for p in root.rglob("*") if p.is_file() and not EXCLUDED.intersection(p.relative_to(root).parts) and p.suffix not in {".pyc", ".log", ".zip"})
    with ZipFile(output, "w", compression=ZIP_DEFLATED, compresslevel=6) as archive:
        for file in files:
            archive.write(file, root.name + "/" + file.relative_to(root).as_posix())
    print(f"Created {output} ({len(files)} files, {output.stat().st_size:,} bytes)")
