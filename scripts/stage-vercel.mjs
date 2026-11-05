import { access, cp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const out = new URL('../out/', import.meta.url);
const root = await realpath(fileURLToPath(new URL('../', import.meta.url)));
const vercelDir = join(root, '.vercel');
const destination = join(vercelDir, 'output');
await access(new URL('index.html', out));
const { headers } = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
await mkdir(vercelDir, { recursive: true });
if (await realpath(vercelDir) !== vercelDir) throw new Error('Unerwartetes Vercel-Verzeichnis.');
try {
  if (await realpath(destination) !== destination) throw new Error('Unerwartetes Ausgabeziel.');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(out, join(destination, 'static'), { recursive: true });
const routes = headers.map(({ source, headers: values }) => ({
  src: `^${source.replace(/[.*+?^$\{\}()|[\]\\]/g, '\\$&')}$`,
  headers: Object.fromEntries(values.map(({ key, value }) => [key, value])),
  continue: true,
}));
const functionDirectory = join(destination, 'functions', 'api', 'auth.func');
await mkdir(functionDirectory, { recursive: true });
const handler = ts.transpileModule(await readFile(new URL('../api/auth.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
await writeFile(join(functionDirectory, 'index.mjs'), handler);
await writeFile(join(functionDirectory, '.vc-config.json'), JSON.stringify({ runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs', maxDuration: 30 }));
routes.unshift({ src: '^/api/auth/(.*)$', dest: '/api/auth?path=$1' });
routes.push({ src: '^/$', dest: '/index.html' }, { handle: 'filesystem' }, { src: '/.*', status: 404, dest: '/404.html' });
await writeFile(join(destination, 'config.json'), JSON.stringify({ version: 3, routes }, null, 2) + '\n');
