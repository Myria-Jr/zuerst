import { ingredients, recipes, pantry, type Ingredient, type Recipe } from './recipes.ts';

export type Meal = { id: string; name: string; day: string; ingredients: Ingredient[] };
export type Plan = { day: string; recipeId: string };
export type Journal = {
  version: 2; stock: Ingredient[]; meals: Meal[]; favorites: string[];
  shopping: Ingredient[]; plans: Plan[]; name: string; expiry: Partial<Record<Ingredient, string>>;
};
export const emptyJournal = (): Journal => ({ version: 2, stock: [], meals: [], favorites: [], shopping: [], plans: [], name: '', expiry: {} });
const ids = new Set(Object.keys(ingredients));
const recipeIds = new Set(recipes.map(r => r.id));
const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const strings = (v: unknown, allowed: Set<string>) => Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && allowed.has(x)))] : [];

export function parseJournal(input: unknown): Journal {
  if (!object(input) || !Array.isArray(input.stock) || !Array.isArray(input.meals)) throw new Error('Das ist keine Zuerst-Sicherung.');
  if (input.version !== undefined && input.version !== 2) throw new Error('Diese Sicherung benötigt eine neuere App-Version.');
  const state = emptyJournal();
  state.stock = strings(input.stock, ids) as Ingredient[];
  state.shopping = strings(input.shopping, ids) as Ingredient[];
  state.favorites = strings(input.favorites, recipeIds);
  state.name = typeof input.name === 'string' ? input.name.trim().slice(0, 40) : '';
  const seen = new Set<string>();
  state.meals = input.meals.slice(0, 10000).filter(object).flatMap(m => {
    if (typeof m.id !== 'string' || seen.has(m.id) || typeof m.name !== 'string' || !isDay(m.day)) return [];
    seen.add(m.id);
    return [{ id: m.id.slice(0, 100), name: m.name.slice(0, 160), day: m.day, ingredients: strings(m.ingredients, ids) as Ingredient[] }];
  });
  const days = new Set<string>();
  state.plans = (Array.isArray(input.plans) ? input.plans : []).filter(object).flatMap(p => {
    if (!isDay(p.day) || typeof p.recipeId !== 'string' || !recipeIds.has(p.recipeId) || days.has(p.day)) return [];
    days.add(p.day); return [{ day: p.day, recipeId: p.recipeId }];
  }).slice(0, 366);
  if (object(input.expiry)) for (const [id, day] of Object.entries(input.expiry)) if (ids.has(id) && state.stock.includes(id as Ingredient) && isDay(day)) state.expiry[id as Ingredient] = day;
  return state;
}

export function dayKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function daysFromToday(count = 7): string[] {
  const today = new Date();
  return Array.from({ length: count }, (_, offset) => { const day = new Date(today); day.setDate(today.getDate() + offset); return dayKey(day); });
}
export function missing(recipe: Recipe, state: Journal): Ingredient[] { return recipe.items.map(([id]) => id).filter(id => !state.stock.includes(id)); }
export function readyRecipes(state: Journal): Recipe[] {
  return recipes.filter(r => missing(r, state).length === 0).sort((a,b) => a.minutes - b.minutes);
}
export function addMissing(state: Journal, recipe: Recipe): Journal {
  return { ...state, shopping: [...new Set([...state.shopping, ...missing(recipe, state)])] };
}
export function bought(state: Journal, purchased: Ingredient[]): Journal {
  return { ...state, stock: [...new Set([...state.stock, ...purchased])], shopping: state.shopping.filter(id => !purchased.includes(id)) };
}
export function cooked(state: Journal, recipe: Recipe): Journal {
  return { ...state, meals: [{ id: crypto.randomUUID(), name: recipe.name, day: dayKey(), ingredients: recipe.items.map(([id]) => id) }, ...state.meals] };
}
export function weekCounts(state: Journal): { day: string; count: number }[] {
  const date = new Date(); date.setDate(date.getDate() - 6);
  return Array.from({ length: 7 }, (_, offset) => { const d = new Date(date); d.setDate(d.getDate() + offset); const day = dayKey(d); return { day, count: state.meals.filter(m => m.day === day).length }; });
}
export function variety(state: Journal): number {
  const days = new Set(weekCounts(state).map(d => d.day));
  return new Set(state.meals.filter(m => days.has(m.day)).flatMap(m => m.ingredients).filter(id => !pantry.has(id))).size;
}
