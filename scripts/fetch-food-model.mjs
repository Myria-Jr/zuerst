import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const target = new URL("../public/models/food/weights.bin", import.meta.url);
const expected =
  "eb49857447f6089e7e392f7991f3f4fdce1936efaf83d535f5eb8aaba9538e0b";
const hash = (data) => createHash("sha256").update(data).digest("hex");
try {
  if (hash(await readFile(target)) === expected) process.exit(0);
} catch {}
const source =
  "https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json";
const get = async (url) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok)
    throw Error(`Food-Modell nicht erreichbar (${response.status}).`);
  return response;
};
const model = await (await get(source)).json();
const chunks = [];
for (const group of model.weightsManifest)
  for (const path of group.paths) {
    const url = new URL(path, source);
    if (url.origin !== new URL(source).origin)
      throw Error("Unerwartete Modellquelle.");
    chunks.push(Buffer.from(await (await get(url)).arrayBuffer()));
  }
const weights = Buffer.concat(chunks);
if (hash(weights) !== expected)
  throw Error("Prüfsumme des lokalen Food-Modells stimmt nicht überein.");
await mkdir(new URL("../public/models/food/", import.meta.url), {
  recursive: true,
});
await writeFile(target, weights);
console.log("Lokales Food-Modell geladen und SHA-256 geprüft.");
