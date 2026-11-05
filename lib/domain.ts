export type Preparation = 'unspecified' | 'raw' | 'cooked';
export type AmountUnit = 'g' | 'ml' | 'piece';
export type FoodKey = { id: string; preparation: Preparation };
export type Quantity = { value: number; unit: AmountUnit };
export type Provenance = {
  evidence: 'manual' | 'receipt-ocr' | 'social-caption' | 'photo-estimate' | 'health-connect' | 'legacy';
  reference?: string; observedAt?: string;
};
export type Nutrients = { energyKcal: number | null; proteinG: number | null; carbohydrateG: number | null; fatG: number | null; fibreG: number | null };
export type FoodProduct = { key: FoodKey; name: string; nutrientsPer100g: Nutrients | null; source: Provenance };
export type InventoryLot = {
  id: string; food: FoodKey; amount: Quantity | null; confirmed: boolean;
  expiry: { day: string; kind: 'best-before' | 'use-by' | 'reminder' } | null; source: Provenance;
};
export type IngredientNeed = { food: FoodKey; amount: Quantity | null };
export type PantryResult = { need: IngredientNeed; availability: 'available' | 'missing' | 'quantity-unknown' | 'insufficient'; excludedUseByLots: number };
export type RecipeDraft = { id: string; title: string; sourceUrl: string | null; mode: 'balanced' | 'comfort'; ingredients: IngredientNeed[]; steps: string[]; reviewed: boolean };
export type NutritionEntry = { id: string; day: string; food: FoodProduct; amount: Quantity };
export type HealthDailyTotals = { day: string; steps: number | null; activeEnergyKcal: number | null; source: Provenance };

export const unknownNutrients = (): Nutrients => ({ energyKcal: null, proteinG: null, carbohydrateG: null, fatG: null, fibreG: null });
export function nutrientsForAmount(nutrientsPer100g: Nutrients, amount: Quantity): Nutrients | null {
  if (!Number.isFinite(amount.value) || amount.value <= 0) throw new Error('Die Menge muss positiv und endlich sein.');
  for (const value of Object.values(nutrientsPer100g)) if (value !== null && (!Number.isFinite(value) || value < 0)) throw new Error('Ungültiger Nährwert.');
  if (amount.unit !== 'g') return null;
  return Object.fromEntries(Object.entries(nutrientsPer100g).map(([key,value]) => [key,value === null ? null : value * amount.value / 100])) as Nutrients;
}
export function matchPantry(needs: IngredientNeed[], inventory: InventoryLot[], today: string): PantryResult[] {
  const key = (food: FoodKey) => `${food.id}:${food.preparation}`;
  if (new Set(needs.map(n=>key(n.food))).size !== needs.length) throw new Error('Doppelte Rezeptzutaten müssen zuerst zusammengeführt werden.');
  return needs.map(need=>{
    const candidates = inventory.filter(lot=>key(lot.food) === key(need.food) && lot.confirmed);
    const expired = candidates.filter(lot=>lot.expiry?.kind === 'use-by' && lot.expiry.day < today);
    const usable = candidates.filter(lot=>!expired.includes(lot));
    const quantity = need.amount;
    let availability: PantryResult['availability'];
    if (!usable.length) availability = 'missing';
    else if (!quantity) availability = 'available';
    else {
      const known = usable.reduce((sum,lot)=>sum+(lot.amount?.unit === quantity.unit ? lot.amount.value : 0),0);
      availability = known >= quantity.value ? 'available' : usable.some(lot=>!lot.amount || lot.amount.unit !== quantity.unit) ? 'quantity-unknown' : 'insufficient';
    }
    return { need,availability,excludedUseByLots:expired.length };
  });
}
export function isSupportedRecipeLink(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && ['instagram.com','www.instagram.com','instagr.am','tiktok.com','www.tiktok.com','vm.tiktok.com','vt.tiktok.com'].includes(url.hostname.toLowerCase());
  } catch { return false; }
}
