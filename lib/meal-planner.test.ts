import { test } from "node:test";
import assert from "node:assert/strict";
import { createMealPlan } from "./meal-planner.ts";
test("Vierwochenplan hält Vorlieben ein und wiederholt erst nach allen passenden Gerichten", () => {
  const plan = createMealPlan(["paprika", "eggs", "oil", "salt"], 28, true, 10);
  assert.equal(plan.length, 28);
  assert.equal(plan[0].id, "paprika-eier");
  assert.ok(
    plan.every(
      (r) => r.minutes <= 10 && !r.items.some(([id]) => id === "tuna"),
    ),
  );
  const repeat = plan.findIndex((r, i) =>
    plan.slice(0, i).some((previous) => previous.id === r.id),
  );
  assert.ok(repeat > 1);
  assert.equal(new Set(plan.slice(0, repeat).map((r) => r.id)).size, repeat);
  assert.throws(() => createMealPlan([], 29));
  assert.throws(() => createMealPlan([], 7, false, 1));
});
