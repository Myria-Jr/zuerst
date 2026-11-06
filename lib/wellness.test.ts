import { test } from "node:test";
import assert from "node:assert/strict";
import {
  foods,
  portion,
  parseWellness,
  emptyWellness,
  policyVersion,
  canJournal,
  caffeineMessage,
} from "./wellness.ts";
import { parseJournal, emptyJournal } from "./journal.ts";

test("USDA: rohe und gekochte Mengen bleiben unterschiedliche Lebensmittel", () => {
  const raw = foods.find(
    (f) => /Nudeln/.test(f.name) && f.preparation === "raw",
  )!;
  const cooked = foods.find(
    (f) => /Nudeln/.test(f.name) && f.preparation === "cooked",
  )!;
  assert.ok(raw && cooked);
  assert.notEqual(raw.id, cooked.id);
  assert.ok(portion(raw, 100).energyKcal! > portion(cooked, 100).energyKcal!);
  assert.equal(portion(raw, 50).energyKcal, raw.per100g.energyKcal! / 2);
  assert.throws(() => portion(raw, Infinity));
});
test("Widerruf, alte Einwilligung und Minderjährigkeit entfernen sensible Logs", () => {
  for (const profile of [
    null,
    { age: 15, consentAt: new Date().toISOString(), policyVersion },
    { age: 20, consentAt: new Date().toISOString(), policyVersion: "old" },
  ]) {
    const parsed = parseWellness({
      ...emptyWellness(),
      profile,
      food: [
        {
          id: "test",
          foodId: foods[0].id,
          grams: 100,
          day: "2026-11-05",
          at: new Date().toISOString(),
          source: "manual",
        },
      ],
    });
    assert.equal(canJournal(parsed), false);
    assert.deepEqual(parsed.food, []);
  }
  assert.match(caffeineMessage(17, 0, 0), /keine Energy/);
});

test("Journal ab 16, Koffeinprotokoll erst ab 18 und keine doppelten IDs", () => {
  const entry = {
    id: "same",
    foodId: foods[0].id,
    grams: 100,
    day: "2026-11-05",
    at: new Date().toISOString(),
    source: "manual",
  };
  const parsed = parseWellness({
    ...emptyWellness(),
    profile: { age: 16, consentAt: new Date().toISOString(), policyVersion },
    food: [entry, entry],
    drinks: [
      {
        id: "c",
        kind: "caffeine",
        ml: 200,
        caffeineMg: 80,
        day: entry.day,
        at: entry.at,
        name: "Kaffee",
      },
    ],
  });
  assert.equal(canJournal(parsed), true);
  assert.equal(parsed.food.length, 1);
  assert.equal(parsed.drinks.length, 0);
});
test("Parser entfernt ungültige Tage und fremde Social-Links und vertraut keinen Zutaten-IDs", () => {
  const parsed = parseWellness({
    ...emptyWellness(),
    profile: { age: 20, consentAt: new Date().toISOString(), policyVersion },
    food: [
      {
        id: "bad",
        foodId: foods[0].id,
        grams: 100,
        day: "2026-02-31",
        at: new Date().toISOString(),
        source: "manual",
      },
    ],
    imports: [
      {
        id: "x",
        title: "Test",
        url: "https://evil.example",
        mode: "comfort",
        steps: [],
        ingredients: [],
        savedAt: new Date().toISOString(),
      },
      {
        id: "y",
        title: "Pasta",
        url: "https://www.instagram.com/reel/example/",
        mode: "comfort",
        steps: ["Kochen"],
        ingredients: [{ name: "Unbekannt", ingredientId: "invented" }],
        savedAt: new Date().toISOString(),
      },
    ],
  });
  assert.equal(parsed.food.length, 0);
  assert.equal(parsed.imports.length, 1);
  assert.equal(parsed.imports[0].ingredients[0].ingredientId, null);
});
test("Küchen-Backup verwirft Gesundheitsdaten auch bei eingeschleusten Feldern", () => {
  const parsed = parseJournal({
    ...emptyJournal(),
    profile: { age: 20 },
    food: [{ grams: 100 }],
    drinks: [{ caffeineMg: 80 }],
  });
  assert.equal("food" in parsed, false);
  assert.equal("drinks" in parsed, false);
  assert.equal("profile" in parsed, false);
});
