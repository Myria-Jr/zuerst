import { ingredients, recipes, type Ingredient, type Recipe } from './recipes.ts';

const normalize = (value: string) => value.toLocaleLowerCase('de').replaceAll('ß', 'ss').normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
const catalog = (Object.keys(ingredients) as Ingredient[]).map((id) => ({ id, names: ingredients[id].map(normalize) }));

export function searchIngredients(query: string): Ingredient[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const value = terms.join(' ');
  return catalog.flatMap(({ id, names }) => {
    if (!terms.every((term) => names.some((name) => name.includes(term)))) return [];
    return [{ id, score: names.includes(value) ? 0 : names.some((name) => name.startsWith(value)) ? 1 : 2 }];
  }).sort((a, b) => a.score - b.score || ingredients[a.id][0].localeCompare(ingredients[b.id][0], 'de')).map(({ id }) => id);
}

type Candidate = { recipe: Recipe; used: Ingredient[]; missing: Ingredient[] };

export function matchRecipes(picked: readonly Ingredient[], confirmed: readonly Ingredient[]) {
  const present = new Set([...picked, ...confirmed]);
  const candidates: Candidate[] = recipes.flatMap((recipe) => {
    const required = new Set(recipe.items.map(([id]) => id));
    if (!required.has(picked[0])) return [];
    return [{ recipe, used: picked.filter((id) => required.has(id)), missing: [...required].filter((id) => !present.has(id)) }];
  }).sort((a, b) => b.used.length - a.used.length || a.recipe.minutes - b.recipe.minutes);

  return {
    complete: candidates.filter(({ missing }) => missing.length === 0),
    almost: candidates.find(({ missing }) => missing.length === 1),
  };
}

export function confirmationChoices(picked: readonly Ingredient[]): Ingredient[] {
  const pickedSet = new Set(picked);
  const candidates = recipes.filter((recipe) => recipe.items.some(([id]) => id === picked[0])).map((recipe) => ({
    recipe,
    missing: recipe.items.map(([id]) => id).filter((id) => !pickedSet.has(id)),
  })).sort((a, b) =>
    (b.recipe.items.length - b.missing.length) - (a.recipe.items.length - a.missing.length) ||
    a.missing.length - b.missing.length || a.recipe.minutes - b.recipe.minutes,
  );

  return [...new Set(candidates.flatMap(({ missing }) => missing))].slice(0, 4);
}
