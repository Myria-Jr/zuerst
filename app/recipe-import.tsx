"use client";
import { useState, type Dispatch, type SetStateAction } from "react";
import { Trash2, ArrowUpRight } from "lucide-react";
import { isSupportedRecipeLink } from "../lib/domain";
import { ingredients, label, recipes, type Ingredient } from "../lib/recipes";
import { daysFromToday, type Journal } from "../lib/journal";
import { createMealPlan } from "../lib/meal-planner";
import {
  WellnessCard as Card,
  dateLabel,
  type WellnessProps,
} from "./wellness";
type KitchenProps = {
  journal: Journal;
  setJournal: Dispatch<SetStateAction<Journal>>;
};
export function SocialRecipes({
  state,
  setState,
  journal,
  setJournal,
}: WellnessProps & KitchenProps) {
  const [url, setUrl] = useState(""),
    [title, setTitle] = useState(""),
    [raw, setRaw] = useState(""),
    [steps, setSteps] = useState(""),
    [mode, setMode] = useState<"balanced" | "comfort">("comfort"),
    [message, setMessage] = useState("");
  return (
    <div className="w-stack">
      <Card tone="kitchen">
        <h2>Aus deinem Feed in deine Küche</h2>
        <p>
          Instagram- oder TikTok-Link einfügen und Rezepttext übernehmen. Prüfe
          jede Zutat; Videos werden nicht automatisch ausgelesen.
        </p>
        <form
          className="w-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!isSupportedRecipeLink(url)) {
              setMessage(
                "Bitte einen Instagram- oder TikTok-HTTPS-Link einfügen.",
              );
              return;
            }
            const names = raw
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean)
                .slice(0, 40),
              instructions = steps
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean)
                .slice(0, 25);
            if (!names.length || !instructions.length || !title.trim()) return;
            setState((s) => ({
              ...s,
              imports: [
                {
                  id: crypto.randomUUID(),
                  title: title.trim(),
                  url: url.trim(),
                  mode,
                  ingredients: names.map((name) => ({
                    name: name.slice(0, 160),
                    ingredientId: null,
                  })),
                  steps: instructions.map((s) => s.slice(0, 2000)),
                  savedAt: new Date().toISOString(),
                },
                ...s.imports,
              ].slice(0, 100),
            }));
            setTitle("");
            setUrl("");
            setRaw("");
            setSteps("");
            setMessage(
              "Rezept gespeichert. Ordne die Zutaten für den Vorratsabgleich zu.",
            );
          }}
        >
          <label>
            Rezeptname
            <input
              value={title}
              maxLength={100}
              required
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label>
            Original-Link
            <input
              type="url"
              value={url}
              maxLength={2000}
              required
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
          <label>
            Zutaten · eine pro Zeile
            <textarea
              value={raw}
              required
              maxLength={6400}
              rows={4}
              onChange={(e) => setRaw(e.target.value)}
            />
          </label>
          <label>
            Schritte · einer pro Zeile
            <textarea
              value={steps}
              required
              maxLength={20000}
              rows={4}
              onChange={(e) => setSteps(e.target.value)}
            />
          </label>
          <label>
            Sammlung
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as typeof mode)}
            >
              <option value="comfort">Genuss & Comfort</option>
              <option value="balanced">Bewusst & ausgewogen</option>
            </select>
          </label>
          <small>
            Deine Einordnung, keine automatisch geprüfte Nährwert- oder
            Gesundheitsaussage.
          </small>
          <button className="j-primary">Geprüften Text speichern</button>
        </form>
      </Card>
      {state.imports.map((r) => (
        <Card key={r.id}>
          <div className="w-row">
            <h2>{r.title}</h2>
            <button
              className="j-icon"
              aria-label={`${r.title} löschen`}
              onClick={() =>
                setState((s) => ({
                  ...s,
                  imports: s.imports.filter((x) => x.id !== r.id),
                }))
              }
            >
              <Trash2 size={20} />
            </button>
          </div>
          <a href={r.url} target="_blank" rel="noreferrer">
            Original öffnen <ArrowUpRight size={16} />
          </a>
          <p>
            {
              r.ingredients.filter(
                (i) =>
                  i.ingredientId &&
                  journal.stock.includes(i.ingredientId as Ingredient),
              ).length
            }{" "}
            von {r.ingredients.length} Zutaten im bestätigten Vorrat. Mengen
            selbst prüfen.
          </p>
          <ul className="w-import-needs">
            {r.ingredients.map((item, index) => (
              <li key={index}>
                <span>{item.name}</span>
                <label>
                  <span className="sr-only">Zutat zuordnen</span>
                  <select
                    value={item.ingredientId ?? ""}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        imports: s.imports.map((x) =>
                          x.id === r.id
                            ? {
                                ...x,
                                ingredients: x.ingredients.map((i, j) =>
                                  j === index
                                    ? {
                                        ...i,
                                        ingredientId: e.target.value || null,
                                      }
                                    : i,
                                ),
                              }
                            : x,
                        ),
                      }))
                    }
                  >
                    <option value="">Unbekannt · prüfen</option>
                    {(Object.keys(ingredients) as Ingredient[]).map((id) => (
                      <option key={id} value={id}>
                        {label(id)}
                      </option>
                    ))}
                  </select>
                </label>
                <small>
                  {!item.ingredientId
                    ? "Noch nicht zugeordnet"
                    : journal.stock.includes(item.ingredientId as Ingredient)
                      ? "Vorhanden · Menge prüfen"
                      : "Fehlt"}
                </small>
              </li>
            ))}
          </ul>
          <ol>
            {r.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <button
            className="j-secondary"
            onClick={() => {
              setJournal((s) => ({
                ...s,
                shopping: [
                  ...new Set([
                    ...s.shopping,
                    ...r.ingredients.flatMap((i) =>
                      i.ingredientId &&
                      !s.stock.includes(i.ingredientId as Ingredient)
                        ? [i.ingredientId as Ingredient]
                        : [],
                    ),
                  ]),
                ],
              }));
              setState((s) => ({
                ...s,
                shoppingText: [
                  ...new Set([
                    ...s.shoppingText,
                    ...r.ingredients
                      .filter((i) => !i.ingredientId)
                      .map((i) => i.name),
                  ]),
                ].slice(0, 200),
              }));
              setMessage(
                "Fehlende und unbekannte Zutaten sind auf deiner Einkaufsliste.",
              );
            }}
          >
            Fehlendes zum Einkauf
          </button>
        </Card>
      ))}
      {message && (
        <p role="status" className="w-feedback">
          {message}
        </p>
      )}
    </div>
  );
}
export function AutoPlanner({
  state,
  setState,
  journal,
  setJournal,
  plus,
  openPlus,
}: WellnessProps & KitchenProps & { plus: boolean; openPlus: () => void }) {
  const [weeks, setWeeks] = useState(1),
    [vegetarian, setVegetarian] = useState(false),
    [fast, setFast] = useState(false),
    [draft, setDraft] = useState<string[]>([]),
    [name, setName] = useState("Mein Wochenplan"),
    [message, setMessage] = useState("");
  return (
    <div className="w-stack">
      <Card tone="kitchen">
        <h2>Ein Plan aus deinem Vorrat</h2>
        <p>
          Plus schlägt Gerichte für bis zu vier Wochen vor. Ein Gericht pro Tag,
          jeweils zwei Portionen. Fehlende Zutaten werden zum gemeinsamen
          Einkauf ergänzt.
        </p>
        <label>
          Wochen
          <select
            value={weeks}
            onChange={(e) => setWeeks(Number(e.target.value))}
          >
            {[1, 2, 3, 4].map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </label>
        <label className="w-check">
          <input
            type="checkbox"
            checked={vegetarian}
            onChange={(e) => setVegetarian(e.target.checked)}
          />
          Vegetarisch
        </label>
        <label className="w-check">
          <input
            type="checkbox"
            checked={fast}
            onChange={(e) => setFast(e.target.checked)}
          />
          Höchstens 10 Minuten
        </label>
        <button
          className="j-primary"
          onClick={() => {
            if (!plus) {
              openPlus();
              return;
            }
            setDraft(
              createMealPlan(
                journal.stock,
                weeks * 7,
                vegetarian,
                fast ? 10 : 20,
              ).map((r) => r.id),
            );
          }}
        >
          Plan vorschlagen{!plus ? " · Plus" : ""}
        </button>
      </Card>
      {!!draft.length && (
        <Card>
          <h2>Dein Vorschlag</h2>
          {draft.map((id, i) => (
            <p key={i}>
              {dateLabel(daysFromToday(draft.length)[i])} ·{" "}
              {recipes.find((r) => r.id === id)?.name}
            </p>
          ))}
          <p>
            Vorhandene Planungen für diese Tage werden beim Übernehmen ersetzt.
          </p>
          <button
            className="j-primary"
            disabled={!plus}
            onClick={() => {
              const days = daysFromToday(draft.length);
              setJournal((s) => ({
                ...s,
                plans: [
                  ...s.plans.filter((p) => !days.includes(p.day)),
                  ...draft.map((recipeId, i) => ({ recipeId, day: days[i] })),
                ],
                shopping: [
                  ...new Set([
                    ...s.shopping,
                    ...draft.flatMap((id) =>
                      recipes
                        .find((r) => r.id === id)!
                        .items.map(([id]) => id)
                        .filter((id) => !s.stock.includes(id)),
                    ),
                  ]),
                ],
              }));
              setMessage("Plan und zusammengefasste Einkaufsliste übernommen.");
              setDraft([]);
            }}
          >
            Plan & Einkauf übernehmen
          </button>
          <label>
            Name der Vorlage
            <input
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <button
            className="j-secondary"
            disabled={!plus || !name.trim()}
            onClick={() => {
              setState((s) => ({
                ...s,
                templates: [
                  ...s.templates,
                  {
                    id: crypto.randomUUID(),
                    name: name.trim(),
                    recipeIds: draft,
                  },
                ].slice(-30),
              }));
              setMessage("Vorlage gespeichert.");
            }}
          >
            Als Vorlage merken
          </button>
        </Card>
      )}
      <Card>
        <h2>Deine Planvorlagen</h2>
        {state.templates.map((t) => (
          <div className="w-list-row" key={t.id}>
            <button
              className="j-secondary"
              onClick={() =>
                plus
                  ? setDraft(
                      t.recipeIds.filter((id) =>
                        recipes.some((r) => r.id === id),
                      ),
                    )
                  : openPlus()
              }
            >
              {t.name} · {t.recipeIds.length} Tage
            </button>
            <button
              className="j-icon"
              aria-label="Vorlage löschen"
              onClick={() =>
                setState((s) => ({
                  ...s,
                  templates: s.templates.filter((x) => x.id !== t.id),
                }))
              }
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
        {!state.templates.length && <p>Noch keine Vorlage gespeichert.</p>}
      </Card>
      {message && (
        <p role="status" className="w-feedback">
          {message}
        </p>
      )}
    </div>
  );
}
