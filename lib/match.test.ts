import { deepEqual, equal, ok } from 'node:assert/strict';
import { test } from 'node:test';
import { confirmationChoices, matchRecipes, searchIngredients } from './match.ts';
import { ingredients, recipes } from './recipes.ts';

test('Paprika und Eier brauchen bestätigtes Öl und Salz', () => {
  const picked = ['paprika', 'eggs'] as const;
  deepEqual(confirmationChoices(picked), ['oil', 'salt', 'rice', 'cannedtomatoes']);
  equal(matchRecipes(picked, []).complete.length, 0);
  const { complete, almost } = matchRecipes(picked, ['salt']);
  equal(complete.length, 0);
  equal(almost?.recipe.id, 'paprika-eier');
  deepEqual(almost?.missing, ['oil']);
  deepEqual(matchRecipes(picked, ['oil', 'salt']).complete.map(({ recipe }) => recipe.id), ['paprika-eier']);
});

test('Verwertung gewinnt vor Zeit; bei gleicher Verwertung gewinnt die kürzere Dauer', () => {
  const { complete } = matchRecipes(['paprika', 'eggs', 'rice'], ['oil', 'salt', 'cannedtomatoes']);
  deepEqual(complete.map(({ recipe, used }) => [recipe.id, used.length]), [
    ['paprika-reis', 3], ['paprika-eier', 2], ['shakshuka', 2],
  ]);
});

test('Ein Treffer muss die erste Zutat enthalten; mehrere unbekannte Zutaten sind kein Beinahe-Treffer', () => {
  deepEqual(matchRecipes(['cucumber', 'paprika', 'eggs'], ['oil', 'salt']), { complete: [], almost: undefined });
});

test('Suche erkennt gängige Namen und bevorzugt exakte Treffer', () => {
  equal(searchIngredients('MOHREN')[0], 'carrots');
  equal(searchIngredients(' Ei ')[0], 'eggs');
  equal(searchIngredients('öl')[0], 'oil');
  deepEqual(searchIngredients('Ananas'), []);
});

test('Der Katalog hat über 200 vollständige Gerichte mit höchstens 20 Minuten Dauer', () => {
  ok(recipes.length > 200);
  equal(new Set(recipes.map(r=>r.name)).size,recipes.length);
  equal(new Set(recipes.map(({ id }) => id)).size, recipes.length);
  for (const recipe of recipes) {
    ok(recipe.minutes > 0 && recipe.minutes <= 20, recipe.name);
    ok(recipe.items.length > 0 && recipe.steps.length > 1, recipe.name);
    equal(new Set(recipe.items.map(([id]) => id)).size, recipe.items.length, recipe.name);
    for (const [id, amount] of recipe.items) ok(id in ingredients && amount.length > 0, recipe.name);
  }
});
