import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { ingredients, pantry, quick, recipes } from '../lib/recipes.ts';

const directory = new URL('../shared/', import.meta.url);
const file = new URL('catalog.json', directory);
const catalog = {
  sources: JSON.parse(await readFile(new URL('recipe-sources.json',directory),'utf8')),
  ingredients: Object.entries(ingredients).map(([id, [name, ...aliases]]) => ({ id, name, aliases })),
  quick,
  pantry: [...pantry],
  recipes: recipes.map(({ items, ...recipe }) => ({ ...recipe, items: items.map(([id, amount]) => ({ id, amount })) })),
};
const serialized = JSON.stringify(catalog, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if ((await readFile(file, 'utf8')).replaceAll('\r\n', '\n') !== serialized) throw new Error('Der native Katalog ist nicht aktuell: npm run sync:native');
} else {
  await mkdir(directory, { recursive: true });
  await writeFile(file, serialized);
}
