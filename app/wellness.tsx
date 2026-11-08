"use client";
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
  type ReactNode,
} from "react";
import {
  Camera,
  Plus,
  Trash2,
  Download,
  Heart,
  Droplets,
  Footprints,
  ShieldCheck,
  Check,
  Undo2,
} from "lucide-react";
import {
  emptyWellness,
  parseWellness,
  policyVersion,
  canJournal,
  isAdult,
  foods,
  searchFoods,
  portion,
  totals,
  photoCandidates,
  caffeineMessage,
  validAmount,
  type Wellness,
  type Food,
} from "../lib/wellness";
import { dayKey } from "../lib/journal";
import { AnimatedNumber, AppearancePicker } from "./appearance";
import {recentPortions} from '../lib/today';
import "./wellness.css";
export type Setter = Dispatch<SetStateAction<Wellness>>;
export type WellnessProps = { state: Wellness; setState: Setter };
export const num = (value: number | null, d = 0) =>
  value === null
    ? "Unbekannt"
    : value.toLocaleString("de-DE", { maximumFractionDigits: d });
export const dateLabel = (value: string) =>
  new Date(value + "T12:00:00").toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
  });
export function WellnessCard({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <section className={`j-panel ${tone ? "w-tone-" + tone : ""}`}>
      {children}
    </section>
  );
}
export function downloadData(
  data: string,
  name: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function useWellness() {
  const [state, setState] = useState<Wellness>(emptyWellness),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    try {
      const raw = localStorage.getItem("zuerst-wellness");
      if (raw) setState(parseWellness(JSON.parse(raw)));
      setReady(true);
    } catch {
      setError(
        "Der lokale Journalspeicher kann nicht gelesen werden. Sichere die Originaldaten unter Datenschutz, bevor du ihn zurücksetzt.",
      );
    }
  }, []);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem("zuerst-wellness", JSON.stringify(state));
      } catch {
        setError(
          "Gerätespeicher voll oder gesperrt. Exportiere deine Daten vor dem Schließen.",
        );
      }
  }, [state, ready]);
  return {
    state,
    setState,
    ready,
    error,
    reset() {
      try {
        localStorage.removeItem("zuerst-wellness");
        setState(emptyWellness());
        setReady(true);
        setError("");
      } catch {
        setError("Speicher gesperrt. Prüfe die Browser-Einstellungen.");
      }
    },
  };
}
export function JournalConsent({ state, setState }: WellnessProps) {
  const [age, setAge] = useState(""),
    [consent, setConsent] = useState(false),
    [message, setMessage] = useState("");
  if (canJournal(state)) return null;
  return (
    <WellnessCard tone="trend">
      <h2>Dein Journal bleibt bei dir</h2>
      <p>
        Ab 16 kannst du Essen und Wasser lokal festhalten. Unter 18 ohne
        Kalorienübersicht, Abnehmziele oder Koffeinbudgets. Kochen funktioniert
        immer.
      </p>
      <form
        className="w-form"
        onSubmit={(e) => {
          e.preventDefault();
          const value = Number(age);
          if (!Number.isInteger(value) || value < 6 || value > 120) {
            setMessage("Bitte ein Alter zwischen 6 und 120 angeben.");
            return;
          }
          if (value < 16) {
            setMessage(
              "Das Journal ist ab 16 verfügbar. Rezepte und Vorrat kannst du weiter nutzen.",
            );
            return;
          }
          if (consent)
            setState((s) => ({
              ...s,
              profile: {
                age: value,
                consentAt: new Date().toISOString(),
                policyVersion,
              },
            }));
        }}
      >
        <label>
          Alter in Jahren
          <input
            type="number"
            inputMode="numeric"
            min="6"
            max="120"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            required
          />
        </label>
        <label className="w-check">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          Ich möchte Alter und Gesundheitsjournal freiwillig auf diesem Gerät
          speichern. Ich kann die Freigabe unter Datenschutz widerrufen und die
          Daten löschen.
        </label>
        <button className="j-primary" disabled={!consent}>
          Journal aktivieren
        </button>
      </form>
      {message && <p role="status">{message}</p>}
    </WellnessCard>
  );
}
export function FoodJournal({ state, setState }: WellnessProps) {
  const [query, setQuery] = useState(""),
    [selected, setSelected] = useState<Food>(),
    [grams, setGrams] = useState("100"),
    [day, setDay] = useState(dayKey());
  const [message, setMessage] = useState(""),
    [scanning, setScanning] = useState(false),
    [suggestions, setSuggestions] = useState<Food[]>([]),
    [source, setSource] = useState<"manual" | "photo">("manual");
  const [drinkName, setDrinkName] = useState("Kaffee"),
    [ml, setMl] = useState("200"),
    [mg, setMg] = useState("80");
  const undo = useRef<Wellness | null>(null),
    lastAction = useRef(-1000);
  const enabled = canJournal(state),
    adult = isAdult(state),
    amount = Number(grams),
    preview =
      selected && validAmount(amount) ? portion(selected, amount) : null;
  const entries = state.food.filter((f) => f.day === day),
    drinks = state.drinks.filter((d) => d.day === day),
    values = totals(state, day);
  function change(next: (s: Wellness) => Wellness, text: string) {
    if (performance.now() - lastAction.current < 450) return;
    lastAction.current = performance.now();
    undo.current = state;
    setState(next);
    setMessage(text);
  }
  async function scan(file?: File) {
    if (!file) return;
    setScanning(true);
    setMessage("");
    setSuggestions([]);
    try {
      const { classifyFood } = await import("../lib/food-photo");
      const hits = photoCandidates(await classifyFood(file));
      setSuggestions(hits);
      setMessage(
        hits.length
          ? "Suchvorschläge bereit. Lebensmittel und gewogene Gramm selbst bestätigen."
          : "Kein passender Vorschlag. Suche das Lebensmittel manuell.",
      );
    } catch {
      setMessage(
        "Foto nicht erkannt oder Bildanalyse nicht verfügbar. Die manuelle Suche funktioniert weiter.",
      );
    } finally {
      setScanning(false);
    }
  }
  function drink(kind: "water" | "caffeine", volume: number, caffeineMg = 0) {
    if (
      !enabled ||
      (kind === "caffeine" && !adult) ||
      !validAmount(volume) ||
      !Number.isFinite(caffeineMg) ||
      caffeineMg < 0 ||
      caffeineMg > 1000
    ) {
      setMessage("Bitte Menge und tatsächlichen Koffeingehalt prüfen.");
      return;
    }
    change(
      (s) => ({
        ...s,
        drinks: [
          ...s.drinks,
          {
            id: crypto.randomUUID(),
            kind,
            ml: volume,
            caffeineMg,
            day,
            at: new Date().toISOString(),
            name:
              kind === "water"
                ? "Wasser"
                : drinkName.trim().slice(0, 100) || "Getränk",
          },
        ],
      }),
      "Getränk eingetragen.",
    );
  }
  const results = query
    ? searchFoods(query).slice(0, 12)
    : state.favoriteFoods
        .map((id) => foods.find((f) => f.id === id)!)
        .filter(Boolean);
  return (
    <div className="w-stack">
      <JournalConsent state={state} setState={setState} />
      <WellnessCard tone="nutrition">
        <h2>Was hast du gegessen?</h2>
        {enabled&&!selected&&!query&&recentPortions(state).length>0&&<div className="w-repeat"><h3>Nochmal das Gleiche?</h3><p className="w-note">Letzte bestätigte Portion wählen, Menge prüfen und neu eintragen.</p>{recentPortions(state).map(entry=>{const food=foods.find(f=>f.id===entry.foodId);return food?<button className="w-search-result" key={entry.foodId} onClick={()=>{setSelected(food);setGrams(String(entry.grams));setSource('manual');setDay(dayKey());}}><span>{food.name}</span><span>{num(entry.grams,1)} g</span></button>:null;})}</div>}
        <p>
          Suche ein Lebensmittel. Rohes und gekochtes Gewicht sind getrennte
          Einträge.
        </p>
        <label className="w-photo">
          <Camera size={20} />
          {scanning ? "Foto wird lokal geprüft …" : "Foto als Suchhilfe"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            disabled={scanning}
            onChange={(e) => {
              void scan(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        <p className="w-note">
          Das Foto bleibt auf dem Gerät. Das Modell wird beim ersten Scan
          geladen. Öl, Sauce und Gramm bitte selbst ergänzen.
        </p>
        {suggestions.length > 0 && (
          <div className="w-choice">
            {suggestions.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setSelected(f);
                  setSource("photo");
                  setSuggestions([]);
                }}
              >
                {f.name}
              </button>
            ))}
          </div>
        )}
        <label>
          Lebensmittel suchen
          <input
            type="search"
            placeholder="Zum Beispiel Nudeln, gekocht"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(undefined);
              setSource("manual");
            }}
          />
        </label>
        {!selected && (
          <div className="w-list">
            {!query && !!results.length && <h3>Häufig gegessen</h3>}
            {results.map((f) => (
              <button
                className="w-search-result"
                key={f.id}
                onClick={() => {
                  setSelected(f);
                  setSource("manual");
                }}
              >
                <span>{f.name}</span>
                {(!state.profile || adult) && (
                  <small>{num(f.per100g.energyKcal)} kcal/100 g</small>
                )}
              </button>
            ))}
            {query && !results.length && (
              <p>Kein Lebensmittel gefunden. Suche eine einzelne Grundzutat.</p>
            )}
          </div>
        )}
        {selected && (
          <form
            className="w-form w-portion"
            onSubmit={(e) => {
              e.preventDefault();
              if (!enabled || !preview) return;
              const food = selected;
              change(
                (s) => ({
                  ...s,
                  food: [
                    ...s.food,
                    {
                      id: crypto.randomUUID(),
                      foodId: food.id,
                      grams: amount,
                      day,
                      at: new Date().toISOString(),
                      source,
                    },
                  ],
                }),
                "Essen eingetragen.",
              );
              setSelected(undefined);
              setQuery("");
            }}
          >
            <div className="w-row">
              <h3>{selected.name}</h3>
              <button
                type="button"
                className="j-icon"
                aria-label="Als häufiges Lebensmittel merken"
                aria-pressed={state.favoriteFoods.includes(selected.id)}
                onClick={() =>
                  setState((s) => ({
                    ...s,
                    favoriteFoods: s.favoriteFoods.includes(selected.id)
                      ? s.favoriteFoods.filter((id) => id !== selected.id)
                      : [...s.favoriteFoods, selected.id],
                  }))
                }
              >
                <Heart
                  fill={
                    state.favoriteFoods.includes(selected.id)
                      ? "currentColor"
                      : "none"
                  }
                  size={22}
                />
              </button>
            </div>
            <label>
              Gewogene Menge in Gramm
              <input
                type="number"
                min="0.1"
                max="5000"
                step="0.1"
                inputMode="decimal"
                required
                value={grams}
                onChange={(e) => setGrams(e.target.value)}
              />
            </label>
            {preview && (
              <div className="w-nutrients">
                {(!state.profile || adult) && (
                  <span>{num(preview.energyKcal)} kcal</span>
                )}
                <span>{num(preview.proteinG, 1)} g Eiweiß</span>
                <span>{num(preview.carbohydrateG, 1)} g Kohlenhydrate</span>
                <span>{num(preview.fatG, 1)} g Fett</span>
              </div>
            )}
            <a
              href={`https://fdc.nal.usda.gov/food-details/${selected.fdcId}/nutrients`}
              target="_blank"
              rel="noreferrer"
            >
              USDA FoodData Central · Quelle ansehen
            </a>
            <button className="j-primary" disabled={!preview || !enabled}>
              <Check size={18} />
              {enabled
                ? "Menge bestätigen & eintragen"
                : "Journal zuerst aktivieren"}
            </button>
          </form>
        )}
      </WellnessCard>
      {enabled && (
        <>
          <label>
            Tag der Einträge
            <input
              type="date"
              value={day}
              max={dayKey()}
              onChange={(e) => {
                if (e.target.value) setDay(e.target.value);
              }}
            />
          </label>
          <WellnessCard>
            <h2>Dein Essen am {dateLabel(day)}</h2>
            {adult && (
              <p className="w-total">
                <AnimatedNumber value={values.energyKcal ?? 0} /> kcal{" "}
                <small>eingetragen</small>
              </p>
            )}
            <p className="w-note">
              Deine Einträge, keine vollständige Messung deiner Ernährung.
            </p>
            <div className="w-list">
              {entries.map((entry) => (
                <div className="w-list-row" key={entry.id}>
                  <div>
                    <strong>
                      {foods.find((f) => f.id === entry.foodId)?.name}
                    </strong>
                    <small>
                      {num(entry.grams, 1)} g ·{" "}
                      {entry.source === "photo"
                        ? "Fotovorschlag bestätigt"
                        : "Manuell bestätigt"}
                    </small>
                  </div>
                  <button
                    className="j-icon"
                    aria-label="Essenseintrag löschen"
                    onClick={() =>
                      change(
                        (s) => ({
                          ...s,
                          food: s.food.filter((f) => f.id !== entry.id),
                        }),
                        "Eintrag gelöscht.",
                      )
                    }
                  >
                    <Trash2 size={19} />
                  </button>
                </div>
              ))}
            </div>
            {!entries.length && <p>Noch kein Essen eingetragen.</p>}
          </WellnessCard>
          <WellnessCard tone="water">
            <h2>Wasser</h2>
            <p className="w-total">
              <AnimatedNumber
                value={drinks
                  .filter((d) => d.kind === "water")
                  .reduce((s, d) => s + d.ml, 0)}
              />{" "}
              ml
            </p>
            <div className="w-choice">
              {[250, 500].map((volume) => (
                <button key={volume} onClick={() => drink("water", volume)}>
                  <Droplets size={18} />+ {volume} ml
                </button>
              ))}
            </div>
          </WellnessCard>
          {adult && (
            <WellnessCard tone="trend">
              <h2>Koffein bewusst eintragen</h2>
              <details>
                <summary>Getränk hinzufügen</summary>
                <div className="w-form">
                  <label>
                    Getränk
                    <input
                      value={drinkName}
                      maxLength={100}
                      onChange={(e) => setDrinkName(e.target.value)}
                    />
                  </label>
                  <div className="w-grid">
                    <label>
                      Milliliter
                      <input
                        type="number"
                        min="1"
                        max="5000"
                        value={ml}
                        onChange={(e) => setMl(e.target.value)}
                      />
                    </label>
                    <label>
                      Koffein gesamt (mg)
                      <input
                        type="number"
                        min="0"
                        max="1000"
                        value={mg}
                        onChange={(e) => setMg(e.target.value)}
                      />
                    </label>
                  </div>
                  <small>
                    Gesamtgehalt von Etikett oder Hersteller übernehmen. Kaffee
                    schwankt stark.
                  </small>
                  <button
                    className="j-secondary"
                    onClick={() => drink("caffeine", Number(ml), Number(mg))}
                  >
                    Getränk bestätigen
                  </button>
                </div>
              </details>
              <p>
                {caffeineMessage(
                  state.profile?.age,
                  drinks.reduce((s, d) => s + d.caffeineMg, 0),
                  Math.max(0, ...drinks.map((d) => d.caffeineMg)),
                )}
              </p>
              <p className="w-note">
                Für gesunde Erwachsene: EFSA nennt 200 mg einzeln und 400 mg/Tag
                als allgemeine Orientierung, in Schwangerschaft und Stillzeit
                200 mg/Tag. Keine persönliche Freigabe.{" "}
                <a
                  href="https://www.efsa.europa.eu/en/topics/topic/caffeine"
                  target="_blank"
                  rel="noreferrer"
                >
                  EFSA-Quelle
                </a>
              </p>
            </WellnessCard>
          )}
          {!!drinks.length && (
            <WellnessCard>
              <h2>Getränke am {dateLabel(day)}</h2>
              {drinks.map((d) => (
                <div className="w-list-row" key={d.id}>
                  <div>
                    <strong>{d.name}</strong>
                    <small>
                      {d.ml} ml
                      {adult && d.kind === "caffeine"
                        ? ` · ${d.caffeineMg} mg Koffein`
                        : ""}
                    </small>
                  </div>
                  <button
                    className="j-icon"
                    aria-label="Getränk löschen"
                    onClick={() =>
                      change(
                        (s) => ({
                          ...s,
                          drinks: s.drinks.filter((x) => x.id !== d.id),
                        }),
                        "Getränk gelöscht.",
                      )
                    }
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </WellnessCard>
          )}
        </>
      )}
      {message && (
        <div className="w-feedback" role="status">
          <Check size={20} />
          <span>{message}</span>
          {undo.current && (
            <button
              className="j-icon"
              aria-label="Letzte Änderung rückgängig"
              onClick={() => {
                setState(undo.current!);
                undo.current = null;
                setMessage("Änderung rückgängig gemacht.");
              }}
            >
              <Undo2 size={20} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
export function Insights({
  state,
  plus,
  openPlus,
}: {
  state: Wellness;
  plus: boolean;
  openPlus: () => void;
}) {
  const [period, setPeriod] = useState(7);
  const dates = Array.from({ length: period * 2 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - period * 2 + 1 + i);
    return dayKey(d);
  });
  const current = dates.slice(-period),
    previous = dates.slice(0, period),
    count = (days: string[]) =>
      state.food.filter((f) => days.includes(f.day)).length;
  return (
    <div className="w-stack">
      <WellnessCard tone="trend">
        <h2>Dein Rhythmus</h2>
        <div className="w-choice">
          {[7, 30, 90].map((days) => (
            <button
              key={days}
              aria-pressed={period === days}
              onClick={() => {
                if (days > 7 && !plus) openPlus();
                else setPeriod(days);
              }}
            >
              {days} Tage{days > 7 ? " · Plus" : ""}
            </button>
          ))}
        </div>
        <p>
          {count(current)} Essenseinträge
          {period > 7 ? ` · Vorheriger Zeitraum: ${count(previous)}` : ""}
        </p>
        <p className="w-note">
          Keine Einträge bedeutet unbekannt, nicht nichts gegessen.
        </p>
        <div
          className="w-bars"
          role="img"
          aria-label={`${count(current)} Essenseinträge in ${period} Tagen`}
        >
          {current.map((key) => (
            <div
              key={key}
              title={`${dateLabel(key)}: ${state.food.filter((f) => f.day === key).length} Einträge`}
            >
              <span
                style={{
                  height:
                    Math.min(
                      95,
                      state.food.filter((f) => f.day === key).length * 14 + 3,
                    ) + "%",
                }}
              />
              {period === 7 && (
                <small>
                  {new Date(key + "T12:00:00").toLocaleDateString("de-DE", {
                    weekday: "short",
                  })}
                </small>
              )}
            </div>
          ))}
        </div>
      </WellnessCard>
      <WellnessCard>
        <h2>Alle Einträge bleiben lesbar</h2>
        {[...new Set(state.food.map((f) => f.day))]
          .sort()
          .reverse()
          .map((day) => (
            <details key={day}>
              <summary>
                {dateLabel(day)} ·{" "}
                {state.food.filter((f) => f.day === day).length} Einträge
              </summary>
              {state.food
                .filter((f) => f.day === day)
                .map((f) => (
                  <p key={f.id}>
                    {foods.find((x) => x.id === f.foodId)?.name} ·{" "}
                    {num(f.grams, 1)} g
                  </p>
                ))}
            </details>
          ))}
        {!state.food.length && (
          <p>Deine Übersicht wächst mit deinen Einträgen.</p>
        )}
        <button
          className="j-secondary"
          onClick={() =>
            downloadData(
              "\uFEFF" +
                [
                  "Tag;Lebensmittel;Gramm",
                  ...state.food.map(
                    (e) =>
                      `${e.day};"${foods.find((f) => f.id === e.foodId)!.name.replaceAll('"', '""')}";${e.grams}`,
                  ),
                ].join("\n"),
              "zuerst-essen.csv",
              "text/csv;charset=utf-8",
            )
          }
        >
          <Download size={18} />
          Alle Einträge als CSV
        </button>
      </WellnessCard>
    </div>
  );
}
export function HealthDetails() {
  return (
    <div className="w-stack">
      <WellnessCard tone="movement">
        <Footprints size={28} />
        <h2>Bewegung aus echten Gerätedaten</h2>
        <p>
          Im Browser sind Health Connect und CoreMotion nicht verfügbar.
          Gerätedaten werden in den nativen Apps verbunden. Hier wird kein Wert
          geschätzt oder als null dargestellt.
        </p>
        <a className="j-primary" href="/downloads/zuerst-android.apk">Android-App mit Schritten herunterladen</a>
      </WellnessCard>
      <WellnessCard>
        <h2>Blutzucker</h2>
        <p>
          Nur tatsächliche Messungen aus einer verbundenen Quelle. Zuerst misst
          keinen Blutzucker mit Kamera oder Fingerabdrucksensor und gibt keine
          Therapieempfehlungen.
        </p>
        <p>Ohne Verbindung: keine Messwerte vorhanden.</p>
      </WellnessCard>
      <WellnessCard><h2>Blutdruck</h2><p>Die Android-App kann vorhandene Blutdruckmessungen nach separater Freigabe aus Health Connect lesen – mit Quelle und Messzeitpunkt. Zuerst misst den Blutdruck nicht selbst.</p><p>Im Browser sind keine Messwerte verbunden.</p></WellnessCard>
    </div>
  );
}
export function Privacy({
  state,
  setState,
  reset,
}: WellnessProps & { reset: () => void }) {
  const [confirm, setConfirm] = useState(false),
    [message, setMessage] = useState("");
  return (
    <div className="w-stack">
      <AppearancePicker />
      <WellnessCard>
        <ShieldCheck size={28} />
        <h2>Speicher & Datenschutz</h2>
        <p>
          Küche, Darstellungswahl und freiwilliges Gesundheitsjournal liegen in
          getrennten Speichern. Küchensicherungen enthalten keine
          Gesundheitsdaten. Kein Werbetracking.
        </p>
        <p>
          Anmeldecookies sind für ein freiwilliges Konto erforderlich. Ohne
          Anmeldung funktionieren die Gratisfunktionen lokal. Zahlungsdaten
          gehen erst beim bewussten Checkout an Stripe.
        </p>
        <button
          className="j-secondary"
          onClick={() =>
            downloadData(JSON.stringify(state, null, 2), "zuerst-journal.json")
          }
        >
          <Download size={18} />
          Journal & Rezeptimporte exportieren
        </button>
        <label className="w-photo">
          Journal-Sicherung importieren
          <input
            type="file"
            accept="application/json"
            onChange={async (e) => {
              const input = e.currentTarget,
                file = input.files?.[0];
              if (!file) return;
              try {
                if (file.size > 5_000_000) throw Error();
                const value = parseWellness(JSON.parse(await file.text()));
                if (
                  window.confirm(
                    "Lokales Journal und Rezeptimporte durch diese Sicherung ersetzen?",
                  )
                ) {
                  setState(value);
                  setMessage("Sicherung übernommen.");
                }
              } catch {
                setMessage("Diese Datei ist keine lesbare Journalsicherung.");
              }
              input.value = "";
            }}
          />
        </label>
        <button
          className="j-secondary"
          onClick={() => {
            const raw = localStorage.getItem("zuerst-wellness");
            if (raw) downloadData(raw, "zuerst-originalspeicher.json");
          }}
        >
          Originalspeicher sichern
        </button>
        <p>
          {state.profile
            ? `Lokales Alter: ${state.profile.age}. Freigabe vom ${new Date(state.profile.consentAt).toLocaleDateString("de-DE")}.`
            : "Keine Speicherfreigabe für ein Gesundheitsjournal."}
        </p>
        <button
          className="j-secondary"
          disabled={!state.profile}
          onClick={() => {
            setState((s) => ({ ...s, profile: null, food: [], drinks: [] }));
            setMessage(
              "Freigabe widerrufen. Alter und Gesundheitsdaten gelöscht. Rezeptimporte bleiben erhalten.",
            );
          }}
        >
          Gesundheitsfreigabe widerrufen & Daten löschen
        </button>
        <label className="w-check">
          <input
            type="checkbox"
            checked={confirm}
            onChange={(e) => setConfirm(e.target.checked)}
          />
          Auch Rezeptimporte, Vorlagen und das gesamte lokale Journal löschen.
        </label>
        <button
          className="j-secondary"
          disabled={!confirm}
          onClick={() => {
            reset();
            setConfirm(false);
            setMessage("Lokales Journal gelöscht.");
          }}
        >
          Journal vollständig löschen
        </button>
      </WellnessCard>
      <WellnessCard>
        <h2>Über Zuerst</h2>
        <p>Zuerst · von Vora, Studio-Arbeitsname im Projekt Odkaz Labs.</p>
        <p>
          Kontakt: <a href="mailto:myriajr@gmx.net">myriajr@gmx.net</a>
        </p>
        <p>
          Die rechtliche Anbieterfreigabe und die Verkaufsbedingungen für
          kostenpflichtige Live-Angebote stehen noch aus. Es werden keine
          erfundenen Firmendaten verwendet.
        </p>
        <p>
          Zuerst ist ein Küchen- und Alltagsjournal. Nährwerte sind
          Referenzwerte, kein medizinischer Rat. Keine Diagnose oder Behandlung.
        </p>
        <a href="/datenschutz/">Datenschutzhinweise & Nutzung</a>
      </WellnessCard>
      {message && (
        <p role="status" className="w-feedback">
          {message}
        </p>
      )}
    </div>
  );
}
