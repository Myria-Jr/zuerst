import { recipes, type Recipe, type Ingredient } from "./recipes.ts";
export function createMealPlan(
  stock: Ingredient[],
  days: number,
  vegetarian = false,
  maxMinutes = 20,
): Recipe[] {
  if (!Number.isInteger(days) || days < 1 || days > 28)
    throw new Error("Plane zwischen 1 und 28 Tagen.");
  const candidates = recipes.filter(
    (r) =>
      r.minutes <= maxMinutes &&
      (!vegetarian || !r.items.some(([id]) => id === "tuna")),
  );
  const used = new Map<string, number>();
  return Array.from({ length: days }, () => {
    const ranked = [...candidates].sort(
      (a, b) =>
        (used.get(a.id) ?? 0) - (used.get(b.id) ?? 0) ||
        b.items.filter(([id]) => stock.includes(id)).length -
          a.items.filter(([id]) => stock.includes(id)).length ||
        a.minutes - b.minutes ||
        a.id.localeCompare(b.id),
    );
    const next = ranked[0];
    if (!next) throw new Error("Keine Rezepte für diese Vorlieben.");
    used.set(next.id, (used.get(next.id) ?? 0) + 1);
    return next;
  });
}
