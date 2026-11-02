// MIT. Prepare a separate runnable browser copy; preserve the source snapshot.
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const original = fileURLToPath(new URL('../original/', import.meta.url));
if (!process.argv[2]) throw new Error('Usage: node reusable/prepare-preview.mjs <empty-destination-folder>');
const destination = path.resolve(process.argv[2]);
const source = path.resolve(original);
if (destination === source || destination.startsWith(source + path.sep)) throw new Error('Choose a destination outside the original source snapshot.');
try {
  if ((await readdir(destination)).length) throw new Error('Destination must be empty; existing files will not be overwritten.');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const app = await readFile(path.join(source, 'src', 'App.jsx'), 'utf8');
const pattern = /useEffect\(\(\)=>writeStorage\(/g;
const count = [...app.matchAll(pattern)].length;
if (count !== 6) throw new Error(`Expected six original storage effects; found ${count}. Inspect the source before adapting this script.`);
await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true });
await writeFile(path.join(destination, 'src', 'App.jsx'), app.replace(pattern, 'useEffect(()=>void writeStorage('));
console.log(`Prepared preview with ${count} React storage-effect callbacks returning undefined.`);
console.log('Install the copied package dependencies, then run its dev script.');
