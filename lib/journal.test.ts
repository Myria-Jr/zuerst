import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recipes } from './recipes.ts';
import { emptyJournal, parseJournal, addMissing, bought, readyRecipes } from './journal.ts';

test('Sicherungen werden migriert und unbekannte IDs verworfen', () => {
  const state = parseJournal({ stock: ['paprika', 'paprika', 'unknown'], meals: [], plans: [{day:'2026-02-30',recipeId:'paprika-eier'}] });
  assert.deepEqual(state.stock, ['paprika']); assert.deepEqual(state.plans, []); assert.equal(state.version, 2);
  assert.throws(() => parseJournal({version:99,stock:[],meals:[]}));
});
test('Nur fehlende Zutaten werden eingekauft; gekauftes landet explizit im Vorrat', () => {
  const recipe = recipes.find(r=>r.id==='paprika-eier')!;
  const state = { ...emptyJournal(), stock: ['paprika'] as const };
  const shop = addMissing({ ...state, stock: [...state.stock] }, recipe);
  assert.deepEqual(shop.shopping, ['eggs','oil','salt']);
  assert.equal(readyRecipes(shop).some(r=>r.id===recipe.id), false);
  const complete = bought(shop, shop.shopping);
  assert.equal(complete.shopping.length, 0); assert.equal(readyRecipes(complete).some(r=>r.id===recipe.id), true);
});
