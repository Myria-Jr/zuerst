import { ingredients, type Ingredient, type Recipe } from './recipes.ts';

export type Taste = { version: 1; done: boolean; diet: 'all' | 'vegetarian'; mode: 'all' | 'balanced' | 'comfort'; likes: Ingredient[]; avoids: Ingredient[] };
export const emptyTaste = (): Taste => ({version:1,done:false,diet:'all',mode:'all',likes:[],avoids:[]});
export const tasteChoices: Ingredient[] = ['pasta','rice','potatoes','chickpeas','tofu','eggs','cheese','mushrooms','broccoli','spinach','paprika','banana'];
export function parseTaste(value: unknown): Taste {
  if(!value || typeof value !== 'object') return emptyTaste();
  const v=value as Record<string,unknown>;
  const ids=(key:string):Ingredient[]=>Array.isArray(v[key]) ? [...new Set((v[key] as unknown[]).filter((id):id is Ingredient=>typeof id==='string' && Object.hasOwn(ingredients,id)))].slice(0,100) : [];
  const avoids=ids('avoids');
  return {version:1,done:v.done===true,diet:v.diet==='vegetarian'?'vegetarian':'all',mode:v.mode==='balanced'||v.mode==='comfort'?v.mode:'all',likes:ids('likes').filter(id=>!avoids.includes(id)),avoids};
}
export const vegetarian = (recipe:Recipe) => !recipe.items.some(([id])=>id==='tuna');
export const recipeMode = (recipe:Recipe) => recipe.mode ?? (['kaesetoast','arme-ritter','paprika-quesadilla','bananen-pancakes','kartoffel-roesti'].includes(recipe.id)?'comfort':'balanced');
export function suitsTaste(recipe:Recipe,taste:Taste):boolean {
  return (taste.diet!=='vegetarian'||vegetarian(recipe)) && (taste.mode==='all'||recipeMode(recipe)===taste.mode) && !recipe.items.some(([id])=>taste.avoids.includes(id));
}
export function rankForTaste(list:readonly Recipe[],taste:Taste,stock:readonly Ingredient[]=[]):Recipe[] {
  const score=(r:Recipe)=>r.items.filter(([id])=>taste.likes.includes(id)).length*10+r.items.filter(([id])=>stock.includes(id)).length;
  const meal=(r:Recipe)=>['Frühstück','Desserts'].includes(r.category??'')?1:0;
  return list.filter(r=>suitsTaste(r,taste)).sort((a,b)=>score(b)-score(a)||meal(a)-meal(b)||a.minutes-b.minutes||a.name.localeCompare(b.name,'de'));
}
