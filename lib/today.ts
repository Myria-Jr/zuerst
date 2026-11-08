import { recipes, type Recipe } from './recipes.ts';
import { missing, type Journal } from './journal.ts';
import { rankForTaste, type Taste } from './taste.ts';
import type { Wellness } from './wellness.ts';

export function nextMeal(journal: Journal, taste: Taste, day: string): { recipe: Recipe; missing: ReturnType<typeof missing>; reason: 'plan' | 'stock' | 'reminder' } | null {
  const planned = recipes.find(r => journal.plans.some(p => p.day === day && p.recipeId === r.id));
  if (planned) return { recipe: planned, missing: missing(planned, journal), reason: 'plan' };
  if (!journal.stock.length) return null;
  const soon = new Set(journal.stock.filter(id => journal.expiry[id] && journal.expiry[id]! >= day && journal.expiry[id]! <= shiftDay(day, 2)));
  const candidates = rankForTaste(recipes, taste, journal.stock).filter(r => r.items.some(([id]) => journal.stock.includes(id) && !['oil','salt','water'].includes(id)));
  const ranked = candidates.sort((a,b) => missing(a,journal).length - missing(b,journal).length || Number(b.items.some(([id])=>soon.has(id))) - Number(a.items.some(([id])=>soon.has(id))));
  const recipe = ranked[0];
  return recipe ? {recipe, missing: missing(recipe,journal), reason: recipe.items.some(([id])=>soon.has(id)) ? 'reminder' : 'stock'} : null;
}
export function shiftDay(day: string, offset: number): string {
  const date = new Date(day + 'T12:00:00Z'); date.setUTCDate(date.getUTCDate()+offset); return date.toISOString().slice(0,10);
}
export function recentPortions(state: Wellness): Wellness['food'] {
  const seen = new Set<string>();
  return [...state.food].sort((a,b)=>b.at.localeCompare(a.at)).filter(e=>!seen.has(e.foodId) && !!seen.add(e.foodId)).slice(0,5);
}
export type Dashboard = { water: boolean; nutrition: boolean; movement: boolean };
export const defaultDashboard = (): Dashboard => ({water:true,nutrition:true,movement:true});
export function parseDashboard(value: unknown): Dashboard {
  const v = value && typeof value === 'object' ? value as Record<string,unknown> : {};
  return Object.fromEntries(Object.entries(defaultDashboard()).map(([key])=>[key,typeof v[key] === 'boolean'?v[key]:true])) as Dashboard;
}
export function recipeLink(id: string): string { return `https://zuerst.vercel.app/?tab=recipes&recipe=${encodeURIComponent(id)}`; }
