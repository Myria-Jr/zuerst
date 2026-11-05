import dataset from "../shared/foods.json" with { type: "json" };
import { nutrientsForAmount, isSupportedRecipeLink } from "./domain.ts";
import { ingredients } from "./recipes.ts";
import type { Nutrients } from "./domain.ts";

export type Food = (typeof dataset.foods)[number];
export const foods: Food[] = dataset.foods;
export const policyVersion = "2026-11-05.1";
export const normalize = (value: string) =>
  value
    .toLocaleLowerCase("de")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replaceAll("ß", "ss")
    .trim();
export type FoodLog = {
  id: string;
  foodId: string;
  grams: number;
  day: string;
  at: string;
  source: "manual" | "photo";
};
export type DrinkLog = {
  id: string;
  kind: "water" | "caffeine";
  ml: number;
  caffeineMg: number;
  day: string;
  at: string;
  name: string;
};
export type ImportedRecipe = {
  id: string;
  title: string;
  url: string;
  mode: "balanced" | "comfort";
  ingredients: { name: string; ingredientId: string | null }[];
  steps: string[];
  savedAt: string;
};
export type PlanTemplate = { id: string; name: string; recipeIds: string[] };
export type Wellness = {
  version: 1;
  profile: { age: number; consentAt: string; policyVersion: string } | null;
  food: FoodLog[];
  drinks: DrinkLog[];
  imports: ImportedRecipe[];
  shoppingText: string[];
  favoriteFoods: string[];
  templates: PlanTemplate[];
};
export const emptyWellness = (): Wellness => ({
  version: 1,
  profile: null,
  food: [],
  drinks: [],
  imports: [],
  shoppingText: [],
  favoriteFoods: [],
  templates: [],
});
export const canJournal = (state: Wellness) =>
  !!state.profile &&
  state.profile.age >= 16 &&
  state.profile.policyVersion === policyVersion;
export const isAdult = (state: Wellness) =>
  canJournal(state) && state.profile!.age >= 18;
export const validAmount = (value: number, max = 5000) =>
  Number.isFinite(value) && value > 0 && value <= max;
export function searchFoods(query: string): Food[] {
  const q = normalize(query);
  return foods
    .filter(
      (f) => !q || normalize(f.name + " " + f.aliases.join(" ")).includes(q),
    )
    .sort(
      (a, b) =>
        Number(normalize(b.name).startsWith(q)) -
        Number(normalize(a.name).startsWith(q)),
    );
}
export function portion(food: Food, grams: number): Nutrients {
  if (!validAmount(grams))
    throw new Error("Bitte eine Menge zwischen 0 und 5.000 g angeben.");
  return nutrientsForAmount(food.per100g, { value: grams, unit: "g" })!;
}
export function totals(state: Wellness, day: string): Nutrients {
  const result: Nutrients = {
    energyKcal: 0,
    proteinG: 0,
    carbohydrateG: 0,
    fatG: 0,
    fibreG: 0,
  };
  for (const entry of state.food.filter((e) => e.day === day)) {
    const food = foods.find((f) => f.id === entry.foodId);
    if (!food) continue;
    const values = portion(food, entry.grams);
    for (const key of Object.keys(result) as (keyof Nutrients)[])
      result[key] =
        result[key] == null || values[key] == null
          ? null
          : result[key]! + values[key]!;
  }
  return result;
}
export function photoCandidates(labels: string[]): Food[] {
  const normalized = labels.map(normalize);
  return foods
    .filter((f) =>
      f.vision.some((term) =>
        normalized.some((label) =>
          new RegExp(`\\b${term}\\b`, "i").test(label),
        ),
      ),
    )
    .slice(0, 6);
}
export function caffeineMessage(
  age: number | undefined,
  totalMg: number,
  largestDose: number,
): string {
  if (age == null || age < 18)
    return "Für Minderjährige gibt Zuerst keine Energy-Drink-Empfehlung. Wasser ist die bessere Alltagswahl.";
  if (totalMg > 400 || largestDose > 200)
    return "Du liegst über einem EFSA-Orientierungswert für gesunde Erwachsene. Verzichte auf weiteres Koffein. Unruhe, Herzklopfen und Schlafprobleme können auftreten.";
  return "Das ist kein Trinkziel und kein persönliches Restbudget. Schon 100 mg können den Schlaf beeinflussen. Empfindlichkeit, Medikamente und Erkrankungen verändern die Verträglichkeit.";
}
export function parseWellness(raw: unknown): Wellness {
  if (!raw || typeof raw !== "object" || (raw as Wellness).version !== 1)
    throw new Error("Unbekanntes Gesundheitsjournal-Format.");
  const input = raw as Wellness;
  const result = emptyWellness();
  const timestamp = (s: unknown) =>
    typeof s === "string" && s.length <= 40 && Number.isFinite(Date.parse(s));
  if (
    input.profile &&
    Number.isInteger(input.profile.age) &&
    input.profile.age >= 6 &&
    input.profile.age <= 120 &&
    timestamp(input.profile.consentAt) &&
    input.profile.policyVersion === policyVersion
  )
    result.profile = {
      age: input.profile.age,
      consentAt: input.profile.consentAt,
      policyVersion,
    };
  const day = (s: unknown) =>
    typeof s === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !Number.isNaN(Date.parse(s + "T12:00:00Z")) &&
    new Date(s + "T12:00:00Z").toISOString().slice(0, 10) === s;
  result.food = (Array.isArray(input.food) ? input.food : [])
    .filter(
      (e) =>
        e &&
        typeof e.id === "string" &&
        foods.some((f) => f.id === e.foodId) &&
        validAmount(e.grams) &&
        day(e.day) &&
        typeof e.at === "string" &&
        ["manual", "photo"].includes(e.source),
    )
    .slice(-10000);
  result.drinks = (Array.isArray(input.drinks) ? input.drinks : [])
    .filter(
      (e) =>
        e &&
        typeof e.id === "string" &&
        ["water", "caffeine"].includes(e.kind) &&
        validAmount(e.ml) &&
        Number.isFinite(e.caffeineMg) &&
        e.caffeineMg >= 0 &&
        e.caffeineMg <= 1000 &&
        (e.kind !== "water" || e.caffeineMg === 0) &&
        typeof e.name === "string" &&
        e.name.length <= 100 &&
        day(e.day) &&
        typeof e.at === "string",
    )
    .slice(-10000);
  result.imports = (Array.isArray(input.imports) ? input.imports : [])
    .filter(
      (e) =>
        e &&
        typeof e.id === "string" &&
        typeof e.title === "string" &&
        e.title.length > 0 &&
        e.title.length <= 100 &&
        typeof e.url === "string" &&
        e.url.length <= 2000 &&
        ["balanced", "comfort"].includes(e.mode) &&
        Array.isArray(e.ingredients) &&
        e.ingredients.length <= 40 &&
        e.ingredients.every(
          (i) =>
            i &&
            typeof i.name === "string" &&
            i.name.length <= 160 &&
            (i.ingredientId == null || typeof i.ingredientId === "string"),
        ) &&
        Array.isArray(e.steps) &&
        e.steps.length <= 25 &&
        e.steps.every((s) => typeof s === "string" && s.length <= 2000) &&
        typeof e.savedAt === "string",
    )
    .slice(-100);
  result.food = result.food
    .filter((e) => timestamp(e.at))
    .map(({ id, foodId, grams, day, at, source }) => ({
      id: id.slice(0, 100),
      foodId,
      grams,
      day,
      at,
      source,
    }));
  result.drinks = result.drinks
    .filter((e) => timestamp(e.at))
    .map(({ id, kind, ml, caffeineMg, day, at, name }) => ({
      id: id.slice(0, 100),
      kind,
      ml,
      caffeineMg,
      day,
      at,
      name,
    }));
  result.imports = result.imports
    .filter((e) => isSupportedRecipeLink(e.url) && timestamp(e.savedAt))
    .map((e) => ({
      id: e.id.slice(0, 100),
      title: e.title,
      url: e.url,
      mode: e.mode,
      steps: e.steps,
      savedAt: e.savedAt,
      ingredients: e.ingredients.map((i) => ({
        name: i.name,
        ingredientId:
          i.ingredientId && Object.hasOwn(ingredients, i.ingredientId)
            ? i.ingredientId
            : null,
      })),
    }));
  if (!canJournal(result)) {
    result.food = [];
    result.drinks = [];
  }
  if (!isAdult(result))
    result.drinks = result.drinks.filter((e) => e.kind === "water");
  const unique = <T extends { id: string }>(entries: T[]) => [
    ...new Map(entries.map((e) => [e.id, e])).values(),
  ];
  result.food = unique(result.food);
  result.drinks = unique(result.drinks);
  result.imports = unique(result.imports);
  result.favoriteFoods = [
    ...new Set(
      (Array.isArray(input.favoriteFoods) ? input.favoriteFoods : []).filter(
        (id) => foods.some((f) => f.id === id),
      ),
    ),
  ];
  result.templates = (Array.isArray(input.templates) ? input.templates : [])
    .filter(
      (t) =>
        t &&
        typeof t.id === "string" &&
        typeof t.name === "string" &&
        t.name.length > 0 &&
        t.name.length <= 60 &&
        Array.isArray(t.recipeIds) &&
        t.recipeIds.length > 0 &&
        t.recipeIds.length <= 28 &&
        t.recipeIds.every((id) => typeof id === "string"),
    )
    .slice(0, 30)
    .map((t) => ({
      id: t.id.slice(0, 100),
      name: t.name,
      recipeIds: t.recipeIds,
    }));
  result.shoppingText = [
    ...new Set(
      (Array.isArray(input.shoppingText) ? input.shoppingText : []).filter(
        (s) => typeof s === "string" && s.length > 0 && s.length <= 160,
      ),
    ),
  ].slice(0, 200);
  return result;
}
