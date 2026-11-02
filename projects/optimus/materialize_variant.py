"""Reconstruct an archived UI version without running the application."""
from pathlib import Path
import argparse
import hashlib
import json
import shutil

HERE = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('version', nargs='?')
parser.add_argument('--output', type=Path)
args = parser.parse_args()
index = json.loads((HERE / 'variants/index.json').read_text(encoding='utf-8'))
if not args.version:
    print('\n'.join(v['version'] for v in index['variants']))
    raise SystemExit()
variant = next((v for v in index['variants'] if v['version'] == args.version), None)
if variant is None:
    parser.error('Unknown version; run without arguments to list versions.')
if args.output is None:
    parser.error('--output is required when selecting a version.')
for entry in variant['files']:
    src = HERE / entry['path']
    if hashlib.sha256(src.read_bytes()).hexdigest() != entry['sha256']:
        raise SystemExit('Hash mismatch: ' + entry['path'])
    dest = args.output / entry['relative_source']
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        raise SystemExit('Refusing to overwrite: ' + str(dest))
    shutil.copyfile(src, dest)
print('Restored', len(variant['files']), 'UI files for', args.version)
