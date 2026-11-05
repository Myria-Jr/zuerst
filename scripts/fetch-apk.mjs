import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const release = JSON.parse(await readFile(new URL('../release/android.json', import.meta.url), 'utf8'));
const response = await fetch(release.url, { signal: AbortSignal.timeout(90000) });
if (!response.ok) throw new Error(`APK-Download fehlgeschlagen: ${response.status}`);
const chunks = [];
let size = 0;
for await (const chunk of response.body) {
  size += chunk.byteLength;
  if (size > 50_000_000) throw new Error('Unerwartete APK-Größe.');
  chunks.push(chunk);
}
const apk = Buffer.concat(chunks);
if (createHash('sha256').update(apk).digest('hex') !== release.sha256) throw new Error('APK-Prüfsumme stimmt nicht mit der freigegebenen Version überein.');
const directory = new URL('../public/downloads/', import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL('zuerst-android.apk', directory), apk);
console.log(`Signierte Android-APK ${release.version} mit SHA-256 geprüft.`);
