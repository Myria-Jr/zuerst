import { readFileSync, writeFileSync } from 'node:fs';

const input = process.argv[2];
if (!input) throw new Error('Pfad zur offiziellen SR-Legacy-JSON-Datei angeben.');
const rows = JSON.parse(readFileSync(input, 'utf8')).SRLegacyFoods;
const selection = [
  [168927, 'pasta-dry', 'Nudeln, trocken', 'raw', ['pasta', 'spaghetti', 'nudeln'], []],
  [168928, 'pasta-cooked', 'Nudeln, gekocht · ohne Sauce', 'cooked', ['pasta', 'spaghetti', 'nudeln'], ['pasta', 'spaghetti', 'carbonara', 'noodle']],
  [169738, 'pasta-whole-dry', 'Vollkornnudeln, trocken', 'raw', ['vollkorn', 'pasta'], []],
  [168910, 'pasta-whole-cooked', 'Vollkornnudeln, gekocht', 'cooked', ['vollkorn', 'pasta'], []],
  [169756, 'rice-dry', 'Reis, trocken', 'raw', ['reis'], []],
  [169757, 'rice-cooked', 'Reis, gekocht · ohne Zusätze', 'cooked', ['reis'], ['rice']],
  [173904, 'oats', 'Haferflocken, trocken', 'raw', ['hafer', 'porridge'], ['oat']],
  [173905, 'porridge', 'Porridge, mit Wasser gekocht', 'cooked', ['hafer', 'porridge'], ['porridge']],
  [169699, 'couscous-dry', 'Couscous, trocken', 'raw', ['couscous'], []],
  [169700, 'couscous-cooked', 'Couscous, gekocht', 'cooked', ['couscous'], []],
  [172688, 'bread', 'Vollkornbrot', 'unspecified', ['brot', 'toast'], ['bread', 'toast']],
  [173944, 'banana', 'Banane, roh', 'raw', ['banane'], ['banana']],
  [171688, 'apple', 'Apfel, mit Schale', 'raw', ['apfel'], ['apple', 'granny smith']],
  [169097, 'orange', 'Orange, roh', 'raw', ['orange'], ['orange']],
  [167762, 'strawberry', 'Erdbeeren, roh', 'raw', ['erdbeere', 'beeren'], ['strawberry']],
  [171705, 'avocado', 'Avocado, roh', 'raw', ['avocado'], ['avocado']],
  [170379, 'broccoli', 'Brokkoli, roh', 'raw', ['brokkoli'], ['broccoli']],
  [170393, 'carrot', 'Karotte, roh', 'raw', ['karotte', 'mohre'], ['carrot']],
  [170457, 'tomato', 'Tomate, roh', 'raw', ['tomate'], ['tomato']],
  [170108, 'pepper', 'Paprika, rot, roh', 'raw', ['paprika'], ['bell pepper', 'pepper']],
  [168409, 'cucumber', 'Gurke, mit Schale', 'raw', ['gurke'], ['cucumber']],
  [168462, 'spinach', 'Spinat, roh', 'raw', ['spinat'], ['spinach']],
  [170026, 'potato-raw', 'Kartoffeln, roh', 'raw', ['kartoffel'], []],
  [170440, 'potato-cooked', 'Kartoffeln, gekocht · ohne Zusätze', 'cooked', ['kartoffel'], ['potato']],
  [171287, 'egg-raw', 'Ei, roh', 'raw', ['ei', 'eier'], []],
  [173424, 'egg-cooked', 'Ei, hart gekocht', 'cooked', ['ei', 'eier'], ['egg']],
  [172217, 'milk', 'Vollmilch, 3,25 % Fett', 'unspecified', ['milch'], ['milk']],
  [171284, 'yogurt', 'Naturjoghurt, Vollmilch', 'unspecified', ['joghurt', 'yoghurt'], ['yogurt', 'yoghurt']],
  [173414, 'cheddar', 'Cheddar', 'unspecified', ['kase', 'cheddar'], ['cheese']],
  [173420, 'feta', 'Feta', 'unspecified', ['feta', 'kase'], []],
  [171477, 'chicken', 'Hähnchenbrust, gegart · ohne Haut', 'cooked', ['hahnchen', 'huhn'], ['chicken']],
  [171998, 'salmon', 'Lachs, gegart', 'cooked', ['lachs', 'fisch'], ['salmon']],
  [173709, 'tuna', 'Thunfisch, in Wasser, abgetropft', 'cooked', ['thunfisch', 'fisch'], ['tuna']],
  [172448, 'tofu', 'Tofu, fest', 'unspecified', ['tofu'], ['tofu']],
  [172421, 'lentils', 'Linsen, gekocht', 'cooked', ['linsen'], ['lentil']],
  [173757, 'chickpeas', 'Kichererbsen, gekocht', 'cooked', ['kichererbse'], ['chickpea']],
  [175194, 'kidney', 'Kidneybohnen, gekocht', 'cooked', ['bohnen', 'kidney'], ['bean']],
  [170567, 'almonds', 'Mandeln', 'unspecified', ['mandeln', 'nusse'], ['almond']],
  [170554, 'chia', 'Chiasamen, trocken', 'raw', ['chia'], []],
  [171413, 'oil', 'Olivenöl', 'unspecified', ['ol', 'olivenol'], []],
  [173430, 'butter', 'Butter, ungesalzen', 'unspecified', ['butter'], []],
  [169655, 'sugar', 'Zucker', 'unspecified', ['zucker'], []],
  [167587, 'chocolate', 'Milchschokolade', 'unspecified', ['schokolade', 'schoko'], ['chocolate']],
  [170317, 'pizza', 'Käsepizza, gebacken · Beispielrezept', 'cooked', ['pizza'], ['pizza']],
  [170690, 'burger', 'Cheeseburger · Beispielrezept', 'cooked', ['burger', 'cheeseburger'], ['cheeseburger', 'hamburger']],
];
const nutrientIds = { energyKcal: 1008, proteinG: 1003, carbohydrateG: 1005, fatG: 1004, fibreG: 1079 };
const foods = selection.map(([fdcId, id, name, preparation, aliases, vision]) => {
  const row = rows.find(f => f.fdcId === fdcId);
  if (!row) throw new Error(`USDA ${fdcId} fehlt`);
  const nutrients = Object.fromEntries(Object.entries(nutrientIds).map(([name, key]) => {
    const nutrient = row.foodNutrients.find(n => n.nutrient.id === key);
    return [name, nutrient?.amount ?? null];
  }));
  if (nutrients.energyKcal == null) throw new Error(`Energie fehlt: ${name}`);
  return { id, name, preparation, aliases, vision, per100g: nutrients, fdcId, sourceDescription: row.description };
});
writeFileSync('shared/foods.json', JSON.stringify({ version: 1, source: 'USDA FoodData Central · SR Legacy, April 2018', sourceUrl: 'https://fdc.nal.usda.gov/download-datasets/', foods }, null, 2) + '\n');
console.log(`${foods.length} belegte Lebensmittel geschrieben.`);
