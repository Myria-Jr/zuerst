"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Sun,
  BookOpen,
  CalendarDays,
  ChartNoAxesColumn,
  UserRound,
  ArrowUpRight,
  Plus,
  X,
  Search,
  Heart,
  Check,
  ShoppingBasket,
  ReceiptText,
  Cloud,
  Download,
  Upload,
  ChevronRight,
  Clock3,
  Leaf,
  Utensils,
  LogOut,
} from "lucide-react";
import {
  ingredients,
  label,
  recipes,
  type Ingredient,
  type Recipe,
} from "../lib/recipes";
import { searchIngredients } from "../lib/match";
import {
  addMissing,
  bought,
  cooked,
  dayKey,
  daysFromToday,
  emptyJournal,
  missing,
  parseJournal,
  readyRecipes,
  variety,
  weekCounts,
  type Journal,
} from "../lib/journal";
import { authRequest, backupRequest, type Account } from "../lib/cloud";
import "./journal.css";
import {useWellness,WellnessSummary,FoodJournal,Insights,HealthDetails,Privacy} from "./wellness";
import {SocialRecipes,AutoPlanner} from "./recipe-import";
import {PlusPage,useEntitlement} from "./plus";
import {AppearancePicker} from "./appearance";

type Tab = "today" | "food" | "recipes" | "stock" | "more" | "plan" | "history" | "profile" | "health" | "privacy" | "social" | "plus" | "insights" | "autoplan";
const hiddenTitles:Partial<Record<Tab,string>>={plan:"Plan & Einkauf",history:"Kochverlauf",profile:"Dein Zuerst",health:"Gesundheitsdetails",privacy:"Darstellung & Datenschutz",social:"Rezeptimport",plus:"Zuerst Plus",insights:"Auswertungen",autoplan:"Automatische Planung"};
const tabs = [
  { id: "today", title: "Heute", icon: Sun },
  { id: "food", title: "Essen", icon: Utensils },
  { id: "recipes", title: "Rezepte", icon: BookOpen },
  { id: "stock", title: "Vorrat", icon: ShoppingBasket },
  { id: "more", title: "Mehr", icon: Plus },
] as const;
const dateLabel = (day: string, short = false) =>
  new Date(day + "T12:00:00").toLocaleDateString(
    "de-DE",
    short
      ? { weekday: "short", day: "numeric", month: "short" }
      : { weekday: "long", day: "numeric", month: "long" },
  );
function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`j-panel ${className}`}>{children}</section>;
}

export default function JournalApp() {
  const [state, setState] = useState<Journal>(emptyJournal);
  const [loaded, setLoaded] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [tab, setTab] = useState<Tab>("today");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [shopping, setShopping] = useState(false);
  const [checked, setChecked] = useState<Ingredient[]>([]);
  const [detail, setDetail] = useState<Recipe>();
  const [detailCooking, setDetailCooking] = useState(false);
  const [planDay, setPlanDay] = useState(dayKey());
  const [bon, setBon] = useState(false);
  const [bonText, setBonText] = useState("");
  const [review, setReview] = useState<Ingredient[] | null>(null);
  const [notice, setNotice] = useState("");
  const [account, setAccount] = useState<Account | null>(null);
  const wellness=useWellness();
  const entitlement=useEntitlement(account);
  const hasPlus=!!entitlement.value?.plus;
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [restore, setRestore] = useState<Journal>();
  const [cloudDate, setCloudDate] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const modal = useRef<HTMLDialogElement>(null);
  const ready = readyRecipes(state);
  const counts = weekCounts(state);
  const count = counts.reduce((sum, d) => sum + d.count, 0);
  const todayPlan = recipes.find((r) =>
    state.plans.some((p) => p.day === dayKey() && p.recipeId === r.id),
  );
  const soon = state.stock
    .filter(
      (id) => state.expiry[id] && state.expiry[id]! <= daysFromToday(3)[2],
    )
    .sort((a, b) => state.expiry[a]!.localeCompare(state.expiry[b]!));

  useEffect(() => {
    try {
      const saved = localStorage.getItem("zuerst-journal");
      if (saved) setState(parseJournal(JSON.parse(saved)));
      setStorageReady(true);
    } catch {
      setNotice(
        "Deine gespeicherten Daten konnten nicht gelesen werden. Importiere eine Sicherung im Profil.",
      );
    }
    const initialTab = new URLSearchParams(location.search).get("tab");
    if (initialTab && [...tabs.map(t=>t.id),...Object.keys(hiddenTitles)].includes(initialTab)) setTab(initialTab as Tab);
    const pop=()=>{const id=new URLSearchParams(location.search).get("tab")??"today";setTab(([...tabs.map(t=>t.id),...Object.keys(hiddenTitles)].includes(id)?id:"today") as Tab);};
    window.addEventListener("popstate",pop);
    setLoaded(true);
    authRequest("get-session")
      .then((data) => setAccount(data?.user ?? null))
      .catch(() => {});
    return ()=>window.removeEventListener("popstate",pop);
  }, []);
  useEffect(() => {
    if (storageReady) {
      try {
        localStorage.setItem("zuerst-journal", JSON.stringify(state));
      } catch {
        setNotice(
          "Der Gerätespeicher ist voll. Exportiere eine Sicherung im Profil.",
        );
      }
    }
  }, [state, storageReady]);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 6500);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  useEffect(() => {
    if (detail || bon || restore) modal.current?.showModal();
    else modal.current?.close();
  }, [detail, bon, restore]);
  function navigate(next: Tab) {
    const update=()=>setTab(next);
    const transition=(document as Document & {startViewTransition?:(update:()=>void)=>unknown}).startViewTransition;
    if(transition&&!matchMedia("(prefers-reduced-motion: reduce)").matches) transition.call(document,update);else update();
    const url=new URL(location.href);url.searchParams.set("tab",next);history.pushState(null,"",url);
    setQuery("");
    setFilter("all");
    window.scrollTo(0, 0);
    requestAnimationFrame(() => heading.current?.focus());
  }
  function closeModal() {
    setDetail(undefined);
    setDetailCooking(false);
    setBon(false);
    setBonText("");
    setReview(null);
    setRestore(undefined);
  }
  function addStock(id: Ingredient) {
    setState((s) => ({ ...s, stock: [...new Set([...s.stock, id])] }));
    setQuery("");
    setNotice(`${label(id)} ergänzt`);
  }
  function toggleFavorite(id: string) {
    setState((s) => ({
      ...s,
      favorites: s.favorites.includes(id)
        ? s.favorites.filter((x) => x !== id)
        : [...s.favorites, id],
    }));
  }
  function readBon() {
    const normalize = (s: string) =>
      s
        .toLowerCase()
        .replaceAll("ß", "ss")
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    const found = bonText
      .slice(0, 20000)
      .split("\n")
      .flatMap((line) => {
        const text = " " + normalize(line) + " ";
        if (
          /\b(summe|rabatt|gesamt|mwst|chips|sosse|sauce|pulver|getrank|saft)\b/.test(
            text,
          )
        )
          return [];
        const hits = Object.entries(ingredients).filter(
          ([id, names]) =>
            !["rice", "water"].includes(id) &&
            names.some((name) => {
              const alias = normalize(name.split(" (")[0]);
              return alias.length >= 3 && text.includes(" " + alias + " ");
            }),
        );
        return hits.length === 1 ? [hits[0][0] as Ingredient] : [];
      });
    setReview([...new Set(found)]);
  }
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setNotice("");
    try {
      await work();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Bitte prüfe deine Verbindung und versuche es erneut.",
      );
    } finally {
      setBusy(false);
    }
  }
  function exportFile() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `zuerst-${dayKey()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 1000000)
        throw new Error("Die Datei ist zu groß. Maximal 1 MB.");
      setRestore(parseJournal(JSON.parse(await file.text())));
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Die Datei konnte nicht gelesen werden.",
      );
    }
  }
  const searchResults = recipes.filter(
    (r) =>
      (!query ||
        r.name
          .toLocaleLowerCase("de")
          .includes(query.toLocaleLowerCase("de")) ||
        r.items.some(([id]) =>
          label(id)
            .toLocaleLowerCase("de")
            .includes(query.toLocaleLowerCase("de")),
        )) &&
      (filter !== "favorites" || state.favorites.includes(r.id)) &&
      (filter !== "ready" || missing(r, state).length === 0) &&
      (filter !== "veggie" || !r.items.some(([id]) => id === "tuna")) &&
      (filter !== "fast" || r.minutes <= 10),
  );

  function recipeRow(recipe: Recipe) {
    const absent = missing(recipe, state);
    return (
      <div className="j-recipe-row" key={recipe.id}>
        <button className="j-row-main" onClick={() => setDetail(recipe)}>
          <span className={`j-recipe-icon ${absent.length ? "" : "is-ready"}`}>
            <Utensils size={21} />
          </span>
          <span>
            <strong>{recipe.name}</strong>
            <small>
              {recipe.minutes} Min. ·{" "}
              {absent.length
                ? absent.length === 1
                  ? "1 Zutat fehlt"
                  : `${absent.length} Zutaten fehlen`
                : "Alles im Vorrat"}
            </small>
          </span>
          <ChevronRight size={18} />
        </button>
        <button
          className="j-icon"
          aria-label={`${recipe.name} ${state.favorites.includes(recipe.id) ? "entmerken" : "merken"}`}
          aria-pressed={state.favorites.includes(recipe.id)}
          onClick={() => toggleFavorite(recipe.id)}
        >
          <Heart
            size={21}
            fill={state.favorites.includes(recipe.id) ? "currentColor" : "none"}
          />
        </button>
      </div>
    );
  }

  return (
    <div className="journal-app">
      <header className="j-topbar">
        <a href="/" className="j-brand">
          <img src="/icon.svg" alt="" width="34" height="34" />
          Zuerst<span>.</span>
        </a>
        <div className="j-top-actions">
          {process.env.NEXT_PUBLIC_ZUERST_APK && (
            <a
              href={process.env.NEXT_PUBLIC_ZUERST_APK}
              className="j-icon"
              aria-label="Android-App herunterladen"
              download="zuerst-android.apk"
            >
              <Download size={20} />
            </a>
          )}
          <button
            className={`j-avatar ${tab === "profile" ? "selected" : ""}`}
            aria-label="Profil und Sicherung"
            onClick={() => navigate("profile")}
          >
            {state.name ? (
              state.name[0].toLocaleUpperCase("de")
            ) : (
              <UserRound size={21} />
            )}
          </button>
        </div>
      </header>
      <nav className="j-nav" aria-label="Hauptnavigation">
        {tabs.map((item) => (
          <button
            key={item.id}
            aria-current={(tab === item.id || item.id === "more" && !tabs.some(t=>t.id===tab)) ? "page" : undefined}
            onClick={() => navigate(item.id)}
          >
            <span>
              <item.icon size={22} />
            </span>
            {item.title}
          </button>
        ))}
      </nav>
      <main className="j-main">
        <div className="j-page-title">
          <h1 ref={heading} tabIndex={-1}>
            {hiddenTitles[tab] ?? tabs.find((t) => t.id === tab)?.title}
          </h1>
          {tab === "today" && (
            <span className="j-date">{dateLabel(dayKey())}</span>
          )}
        </div>
        {!loaded ? (
          <div className="j-skeleton" aria-label="Dein Journal wird geladen" />
        ) : (
          <>
            {hasPlus&&entitlement.value?.mode==="test"&&<p role="status" className="w-feedback">Sandbox · Plus-Testzugang. Keine Live-Freischaltung.</p>}
            {wellness.error&&<p role="alert" className="w-feedback">{wellness.error}</p>}
            {tab === "food"&&wellness.ready&&<FoodJournal state={wellness.state} setState={wellness.setState}/>}
            {tab === "insights"&&<Insights state={wellness.state} plus={hasPlus} openPlus={()=>navigate("plus")}/>}
            {tab === "health"&&<HealthDetails/>}
            {tab === "privacy"&&<Privacy state={wellness.state} setState={wellness.setState} reset={wellness.reset}/>}
            {tab === "social"&&<SocialRecipes state={wellness.state} setState={wellness.setState} journal={state} setJournal={setState}/>}
            {tab === "autoplan"&&<AutoPlanner state={wellness.state} setState={wellness.setState} journal={state} setJournal={setState} plus={hasPlus} openPlus={()=>navigate("plus")}/>}
            {tab === "plus"&&<PlusPage account={account} state={wellness.state} onLogin={()=>navigate("profile")} entitlement={entitlement.value} refresh={entitlement.setValue}/>}
            {tab === "more"&&<div className="w-menu">{([
              ["plan","Plan & Einkauf","kitchen",CalendarDays],["autoplan","Automatisch planen","kitchen",CalendarDays],
              ["history","Kochverlauf","trend",ChartNoAxesColumn],["insights","Auswertungen","trend",ChartNoAxesColumn],
              ["health","Gesundheitsdetails","movement",Heart],["social","Rezept importieren","kitchen",BookOpen],
              ["plus","Zuerst Plus","trend",Plus],["privacy","Darstellung & Datenschutz","water",UserRound]
            ] as const).map(([id,title,tone,Icon])=><button className={"w-tone-"+tone} key={id} onClick={()=>navigate(id)}><Icon size={26}/><span>{title}</span></button>)}</div>}
            {tab === "today" && (
              <div className="j-dashboard">
                <WellnessSummary state={wellness.state} open={()=>navigate("food")}/>
                <Panel className="j-feature">
                  <div className="j-feature-heading">
                    <span className="j-orb">
                      <Leaf size={35} strokeWidth={1.6} />
                    </span>
                    <span className="j-tag">Deine Küche. Dein Rhythmus.</span>
                  </div>
                  <h2>
                    {state.name
                      ? `Was kochen wir, ${state.name}?`
                      : "Etwas Gutes aus dem, was da ist."}
                  </h2>
                  <p>
                    {ready[0]
                      ? `${ready[0].name} ist in ${ready[0].minutes} Minuten fertig. Du hast alle Zutaten da.`
                      : "Eine Zutat reicht. Finde in wenigen Schritten dein nächstes Gericht."}
                  </p>
                  <a
                    className="j-secondary"
                    href={
                      ready[0] ? `/kochen/?recipe=${ready[0].id}` : "/kochen/"
                    }
                  >
                    Kochen starten <ArrowUpRight size={21} />
                  </a>
                </Panel>
                <div className="j-metrics">
                  <button
                    className="j-metric mint"
                    onClick={() => navigate("stock")}
                  >
                    <ShoppingBasket size={22} />
                    <span>Im Vorrat</span>
                    <strong>
                      {state.stock.length}
                      <small>Zutaten</small>
                    </strong>
                    <ChevronRight size={17} />
                  </button>
                  <button
                    className="j-metric lavender"
                    onClick={() => navigate("history")}
                  >
                    <ChartNoAxesColumn size={22} />
                    <span>Selbst gekocht</span>
                    <strong>
                      {count}
                      <small>letzte 7 Tage</small>
                    </strong>
                    <ChevronRight size={17} />
                  </button>
                </div>
                {soon.length > 0 && (
                  <Panel>
                    <div className="j-section-title">
                      <h2>Zuerst aufbrauchen</h2>
                      <span className="j-count">{soon.length}</span>
                    </div>
                    <p className="j-muted">Nach deinen eingetragenen Daten.</p>
                    <div className="j-chips">
                      {soon.map((id) => (
                        <a href={`/kochen/?ingredient=${id}`} key={id}>
                          {label(id)} · {dateLabel(state.expiry[id]!, true)}
                        </a>
                      ))}
                    </div>
                    <small>
                      Das Datum ist ein Hinweis. Prüfe Lebensmittel vor dem
                      Verwenden.
                    </small>
                  </Panel>
                )}
                <Panel className="j-today-plan">
                  <div className="j-section-title">
                    <h2>Heute auf dem Plan</h2>
                    <CalendarDays size={22} />
                  </div>
                  {todayPlan ? (
                    <>
                      {recipeRow(todayPlan)}
                      <button
                        className="j-link"
                        onClick={() => {
                          navigate("plan");
                          setShopping(false);
                        }}
                      >
                        Plan ansehen <ChevronRight size={17} />
                      </button>
                    </>
                  ) : (
                    <>
                      <p>
                        Ein kleiner Plan macht den nächsten Einkauf leichter.
                      </p>
                      <button
                        className="j-secondary"
                        onClick={() => {
                          navigate("plan");
                          setShopping(false);
                        }}
                      >
                        Gericht einplanen <Plus size={18} />
                      </button>
                    </>
                  )}
                </Panel>
                <Panel className="j-receipt-promo">
                  <ReceiptText size={28} />
                  <div>
                    <h2>Dein Einkauf, schon im Blick.</h2>
                    <p>
                      Übernimm Zutaten aus einem Kassenbon in deinen Vorrat.
                    </p>
                  </div>
                  <button className="j-secondary" onClick={() => setBon(true)}>
                    Bon erfassen <Plus size={18} />
                  </button>
                </Panel>
                {ready.length > 0 && (
                  <Panel>
                    <div className="j-section-title">
                      <h2>Du kannst direkt loslegen</h2>
                      <span className="j-count">{ready.length}</span>
                    </div>
                    {ready.slice(0, 3).map(recipeRow)}
                  </Panel>
                )}
              </div>
            )}
            {tab === "recipes" && <button className="j-secondary" onClick={()=>navigate("social")}>Instagram- oder TikTok-Rezept importieren</button>}
            {tab === "plan" && wellness.state.shoppingText.length>0&&<Panel><h2>Eigene Einkaufszutaten</h2>{wellness.state.shoppingText.map(text=><label className="w-list-row" key={text}><input type="checkbox" onChange={()=>wellness.setState(s=>({...s,shoppingText:s.shoppingText.filter(t=>t!==text)}))}/>{text}</label>)}</Panel>}
            {tab === "recipes" && (
              <>
                <p className="j-lead">
                  24 Ideen. Zwei Portionen. Höchstens 20 Minuten.
                </p>
                <label className="j-search">
                  <Search size={21} />
                  <input
                    type="search"
                    placeholder="Gericht oder Zutat suchen"
                    aria-label="Rezepte durchsuchen"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <div
                  className="j-chips j-filter"
                  role="group"
                  aria-label="Rezepte filtern"
                >
                  {[
                    ["all", "Alle"],
                    ["favorites", "Gemerkt"],
                    ["ready", "Aus Vorrat"],
                    ["veggie", "Vegetarisch"],
                    ["fast", "Bis 10 Min."],
                  ].map(([id, title]) => (
                    <button
                      key={id}
                      aria-pressed={filter === id}
                      onClick={() => setFilter(id)}
                    >
                      {title}
                    </button>
                  ))}
                </div>
                <Panel>
                  <div className="j-section-title">
                    <h2>
                      {filter === "favorites"
                        ? "Deine Sammlung"
                        : "Deine Rezepte"}
                    </h2>
                    <span className="j-count">{searchResults.length}</span>
                  </div>
                  {searchResults.map(recipeRow)}
                  {!searchResults.length && (
                    <p className="j-empty">
                      {filter === "favorites"
                        ? "Tippe bei einem Rezept auf das Herz, um es hier zu merken."
                        : "Kein passendes Rezept. Ändere die Suche oder den Filter."}
                    </p>
                  )}
                </Panel>
              </>
            )}
            {tab === "stock" && (
              <>
                <p className="j-lead">
                  Was du zu Hause hast, macht den Anfang.
                </p>
                <button className="j-primary" onClick={() => setBon(true)}>
                  Bon erfassen <ReceiptText size={20} />
                </button>
                <Panel>
                  <h2>Zutat ergänzen</h2>
                  <label className="j-search">
                    <Search size={20} />
                    <input
                      type="search"
                      aria-label="Zutat suchen"
                      placeholder="Zutat suchen"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  {query.trim() && (
                    <div className="j-chips">
                      {searchIngredients(query)
                        .filter((id) => !state.stock.includes(id))
                        .map((id) => (
                          <button key={id} onClick={() => addStock(id)}>
                            <Plus size={16} />
                            {label(id)}
                          </button>
                        ))}
                    </div>
                  )}
                </Panel>
                <Panel>
                  <div className="j-section-title">
                    <h2>Im Vorrat</h2>
                    <span className="j-count">{state.stock.length}</span>
                  </div>
                  {!state.stock.length && (
                    <p className="j-empty">
                      Füge deine ersten Zutaten einzeln oder über einen Bon
                      hinzu. Grundzutaten wie Öl und Salz bestätigst du
                      ebenfalls selbst.
                    </p>
                  )}
                  {[...state.stock]
                    .sort((a, b) => label(a).localeCompare(label(b), "de"))
                    .map((id) => (
                      <div className="j-stock-row" key={id}>
                        <div>
                          <strong>{label(id)}</strong>
                          <label>
                            <span className="sr-only">
                              Aufbrauchen bis für {label(id)}
                            </span>
                            <input
                              type="date"
                              aria-label={`Aufbrauchen bis für ${label(id)}`}
                              value={state.expiry[id] ?? ""}
                              onChange={(e) =>
                                setState((s) => ({
                                  ...s,
                                  expiry: {
                                    ...s.expiry,
                                    [id]: e.target.value || undefined,
                                  },
                                }))
                              }
                            />
                            <small>Aufbrauchen bis · optional</small>
                          </label>
                        </div>
                        <button
                          className="j-icon"
                          aria-label={`${label(id)} aus Vorrat entfernen`}
                          onClick={() =>
                            setState((s) => {
                              const expiry = { ...s.expiry };
                              delete expiry[id];
                              return {
                                ...s,
                                expiry,
                                stock: s.stock.filter((x) => x !== id),
                              };
                            })
                          }
                        >
                          <X size={20} />
                        </button>
                      </div>
                    ))}
                </Panel>
              </>
            )}
            {tab === "plan" && (
              <>
                <div
                  className="j-segment"
                  role="group"
                  aria-label="Planungsansicht"
                >
                  <button
                    aria-pressed={!shopping}
                    onClick={() => setShopping(false)}
                  >
                    Wochenplan
                  </button>
                  <button
                    aria-pressed={shopping}
                    onClick={() => setShopping(true)}
                  >
                    Einkauf <span>{state.shopping.length}</span>
                  </button>
                </div>
                {shopping ? (
                  <>
                    <p className="j-lead">
                      Abhaken. Einkaufen. In den Vorrat übernehmen.
                    </p>
                    <Panel>
                      <h2>Auf der Liste</h2>
                      <label className="j-search">
                        <Search size={20} />
                        <input
                          type="search"
                          aria-label="Einkaufszutat suchen"
                          placeholder="Zutat ergänzen"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                      </label>
                      {query.trim() && (
                        <div className="j-chips">
                          {searchIngredients(query)
                            .filter((id) => !state.shopping.includes(id))
                            .map((id) => (
                              <button
                                key={id}
                                onClick={() => {
                                  setState((s) => ({
                                    ...s,
                                    shopping: [...s.shopping, id],
                                  }));
                                  setQuery("");
                                }}
                              >
                                <Plus size={16} />
                                {label(id)}
                              </button>
                            ))}
                        </div>
                      )}
                      {state.shopping.map((id) => (
                        <div className="j-shopping-row" key={id}>
                          <label>
                            <input
                              type="checkbox"
                              checked={checked.includes(id)}
                              onChange={() =>
                                setChecked((c) =>
                                  c.includes(id)
                                    ? c.filter((x) => x !== id)
                                    : [...c, id],
                                )
                              }
                            />
                            <span>{label(id)}</span>
                          </label>
                          <button
                            className="j-icon"
                            aria-label={`${label(id)} von Einkaufsliste entfernen`}
                            onClick={() => {
                              setState((s) => ({
                                ...s,
                                shopping: s.shopping.filter((x) => x !== id),
                              }));
                              setChecked((c) => c.filter((x) => x !== id));
                            }}
                          >
                            <X size={18} />
                          </button>
                        </div>
                      ))}
                      {!state.shopping.length && (
                        <p className="j-empty">
                          Deine Liste ist frei. Füge Zutaten hinzu oder übernimm
                          fehlende Zutaten aus einem Rezept.
                        </p>
                      )}
                    </Panel>
                    {checked.length > 0 && (
                      <button
                        className="j-primary"
                        onClick={() => {
                          setState((s) => bought(s, checked));
                          setNotice(
                            `${checked.length} Zutaten im Vorrat ergänzt`,
                          );
                          setChecked([]);
                        }}
                      >
                        Gekauftes übernehmen · {checked.length}
                        <Check size={20} />
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <p className="j-lead">
                      Deine nächsten sieben Tage, ganz entspannt.
                    </p>
                    <div className="j-week">
                      {daysFromToday().map((day) => {
                        const recipe = recipes.find((r) =>
                          state.plans.some(
                            (p) => p.day === day && p.recipeId === r.id,
                          ),
                        );
                        return (
                          <Panel key={day}>
                            <div className="j-section-title">
                              <h2>
                                {day === dayKey()
                                  ? "Heute"
                                  : dateLabel(day, true)}
                              </h2>
                              {recipe && (
                                <button
                                  className="j-icon"
                                  aria-label={`Plan für ${dateLabel(day)} entfernen`}
                                  onClick={() =>
                                    setState((s) => ({
                                      ...s,
                                      plans: s.plans.filter(
                                        (p) => p.day !== day,
                                      ),
                                    }))
                                  }
                                >
                                  <X size={18} />
                                </button>
                              )}
                            </div>
                            {recipe ? (
                              <>
                                {recipeRow(recipe)}
                                <button
                                  className="j-link"
                                  onClick={() => {
                                    setState((s) => addMissing(s, recipe));
                                    setShopping(true);
                                    setNotice(
                                      "Fehlende Zutaten sind auf der Einkaufsliste.",
                                    );
                                  }}
                                >
                                  Fehlendes einkaufen{" "}
                                  <ShoppingBasket size={17} />
                                </button>
                              </>
                            ) : (
                              <button
                                className="j-plan-add"
                                onClick={() => {
                                  setPlanDay(day);
                                  navigate("recipes");
                                  setNotice(
                                    "Wähle ein Rezept und tippe auf „Einplanen“.",
                                  );
                                }}
                              >
                                <Plus size={22} />
                                Gericht auswählen
                              </button>
                            )}
                          </Panel>
                        );
                      })}
                    </div>
                    <button
                      className="j-primary"
                      disabled={
                        !state.plans.some((p) =>
                          daysFromToday().includes(p.day),
                        )
                      }
                      onClick={() => {
                        setState((s) =>
                          s.plans
                            .filter((p) => daysFromToday().includes(p.day))
                            .reduce((current, p) => {
                              const recipe = recipes.find(
                                (r) => r.id === p.recipeId,
                              );
                              return recipe
                                ? addMissing(current, recipe)
                                : current;
                            }, s),
                        );
                        setShopping(true);
                        setNotice(
                          "Fehlende Zutaten für die Woche ergänzt. Mengen prüfst du in den Rezepten.",
                        );
                      }}
                    >
                      Wocheneinkauf erstellen <ShoppingBasket size={20} />
                    </button>
                  </>
                )}
              </>
            )}
            {tab === "history" && (
              <>
                <p className="j-lead">
                  Ein Blick auf das, was du selbst gekocht hast.
                </p>
                <div className="j-history-grid">
                  <Panel className="lavender">
                    <h2>Gekocht · letzte 7 Tage</h2>
                    <div className="j-total">
                      {count}
                      <span>Gerichte</span>
                    </div>
                    <div
                      className="j-chart"
                      role="img"
                      aria-label={counts
                        .map((d) => `${dateLabel(d.day)}: ${d.count} Gerichte`)
                        .join(", ")}
                    >
                      {counts.map((d) => (
                        <div key={d.day}>
                          <span
                            style={{
                              height: `${Math.max(3, (d.count / Math.max(1, ...counts.map((x) => x.count))) * 70)}px`,
                            }}
                          />
                          <small>
                            {new Date(d.day + "T12:00").toLocaleDateString(
                              "de",
                              { weekday: "short" },
                            )}
                          </small>
                        </div>
                      ))}
                    </div>
                  </Panel>
                  <Panel className="mint">
                    <Leaf size={25} />
                    <h2>Zutatenvielfalt</h2>
                    <div className="j-total">
                      {variety(state)}
                      <span>Zutaten</span>
                    </div>
                    <p>
                      Verschiedene Zutaten in deinen eingetragenen Rezepten der
                      letzten sieben Tage, ohne Grundzutaten.
                    </p>
                  </Panel>
                </div>
                <Panel>
                  <h2>Deine Gerichte</h2>
                  {state.meals.map((m) => (
                    <div className="j-stock-row" key={m.id}>
                      <div>
                        <strong>{m.name}</strong>
                        <small>{dateLabel(m.day)}</small>
                      </div>
                      <button
                        className="j-icon"
                        aria-label={`${m.name} aus Verlauf entfernen`}
                        onClick={() => {
                          if (confirm("Diesen Kocheintrag entfernen?"))
                            setState((s) => ({
                              ...s,
                              meals: s.meals.filter((x) => x.id !== m.id),
                            }));
                        }}
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ))}
                  {!state.meals.length && (
                    <p className="j-empty">
                      Nach dem Kochen kannst du dein Gericht eintragen. Hier
                      wächst dein persönliches Küchenjournal.
                    </p>
                  )}
                </Panel>
              </>
            )}
            {tab === "profile" && <><AppearancePicker/><button className="j-secondary" onClick={()=>navigate("privacy")}>Speicher & Datenschutz</button><button className="j-secondary" onClick={()=>navigate("plus")}>Zuerst Plus</button></>}
            {tab === "profile" && (
              <>
                <Panel>
                  <div className="j-section-title">
                    <h2>Ganz du</h2>
                    <UserRound size={23} />
                  </div>
                  <label className="j-field">
                    Dein Name
                    <input
                      maxLength={40}
                      value={state.name}
                      placeholder="Wie dürfen wir dich nennen?"
                      onChange={(e) =>
                        setState((s) => ({ ...s, name: e.target.value }))
                      }
                    />
                  </label>
                  <p className="j-muted">
                    Der Name wird auf diesem Gerät gespeichert.
                  </p>
                </Panel>
                <Panel>
                  <div className="j-section-title">
                    <h2>Konto & Sicherung</h2>
                    <Cloud size={24} />
                  </div>
                  {account ? (
                    <>
                      <p>
                        Angemeldet als <strong>{account.email}</strong>
                      </p>
                      <p className="j-muted">
                        Sichere Vorrat, Sammlung, Plan und Verlauf. Es wird nur
                        übertragen, wenn du auf „Jetzt sichern“ tippst.
                      </p>
                      <button
                        className="j-primary"
                        disabled={busy}
                        onClick={() =>
                          action(async () => {
                            await backupRequest("POST", state);
                            setCloudDate(new Date().toLocaleString("de-DE"));
                            setNotice("Deine Sicherung wurde gespeichert.");
                          })
                        }
                      >
                        Jetzt sichern <Upload size={19} />
                      </button>
                      <button
                        className="j-secondary"
                        disabled={busy}
                        onClick={() =>
                          action(async () => {
                            const rows = await backupRequest("GET");
                            if (!rows.length)
                              throw new Error(
                                "Für dieses Konto ist noch keine Sicherung vorhanden.",
                              );
                            setRestore(parseJournal(rows[0].payload));
                            setCloudDate(
                              new Date(rows[0].updated_at).toLocaleString(
                                "de-DE",
                              ),
                            );
                          })
                        }
                      >
                        Sicherung wiederherstellen <Download size={19} />
                      </button>
                      {cloudDate && <small>Cloud-Sicherung: {cloudDate}</small>}
                      <div className="j-split-actions">
                        <button
                          className="j-link"
                          disabled={busy}
                          onClick={() =>
                            action(async () => {
                              await authRequest("sign-out", {});
                              setAccount(null);
                              setCloudDate("");
                              setNotice(
                                "Abgemeldet. Deine lokalen Daten bleiben erhalten.",
                              );
                            })
                          }
                        >
                          <LogOut size={16} />
                          Abmelden
                        </button>
                        <button
                          className="j-link"
                          disabled={busy}
                          onClick={() => {
                            if (
                              confirm(
                                "Deine Cloud-Sicherung endgültig löschen? Die lokalen Daten bleiben erhalten.",
                              )
                            )
                              void action(async () => {
                                await backupRequest("DELETE");
                                setCloudDate("");
                                setNotice("Cloud-Sicherung gelöscht.");
                              });
                          }}
                        >
                          Cloud-Sicherung löschen
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="j-muted">
                        Freiwillig. Dein Küchenjournal funktioniert auch ohne
                        Anmeldung. Mit einem Konto kannst du es sichern und auf
                        einem anderen Gerät wiederherstellen.
                      </p>
                      <div className="j-segment">
                        <button
                          aria-pressed={authMode === "login"}
                          onClick={() => setAuthMode("login")}
                        >
                          Anmelden
                        </button>
                        <button
                          aria-pressed={authMode === "register"}
                          onClick={() => setAuthMode("register")}
                        >
                          Konto erstellen
                        </button>
                      </div>
                      <form
                        className="j-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const form = new FormData(e.currentTarget);
                          void action(async () => {
                            await authRequest(
                              authMode === "login"
                                ? "sign-in/email"
                                : "sign-up/email",
                              {
                                email: String(form.get("email")).trim(),
                                password: String(form.get("password")),
                                ...(authMode === "register"
                                  ? { name: state.name.trim() || "Zuerst" }
                                  : {}),
                              },
                            );
                            const session = await authRequest("get-session");
                            if (!session?.user)
                              throw new Error(
                                "Bitte erlaube Cookies für die Anmeldung und versuche es erneut.",
                              );
                            setAccount(session.user);
                            setNotice(
                              "Du bist angemeldet. Deine Daten bleiben lokal, bis du sie sicherst.",
                            );
                          });
                        }}
                      >
                        <label className="j-field">
                          E-Mail
                          <input
                            type="email"
                            name="email"
                            required
                            autoComplete="email"
                            maxLength={254}
                          />
                        </label>
                        <label className="j-field">
                          Passwort
                          <input
                            type="password"
                            name="password"
                            required
                            minLength={8}
                            maxLength={128}
                            autoComplete={
                              authMode === "register"
                                ? "new-password"
                                : "current-password"
                            }
                          />
                        </label>
                        <button className="j-primary" disabled={busy}>
                          {busy
                            ? "Einen Moment …"
                            : authMode === "login"
                              ? "Anmelden"
                              : "Konto erstellen"}
                          <ArrowUpRight size={19} />
                        </button>
                        <button
                          type="button"
                          className="j-link"
                          disabled={busy}
                          onClick={(e) => {
                            const form = e.currentTarget.form;
                            const email =
                              form?.querySelector<HTMLInputElement>(
                                "input[type=email]",
                              );
                            if (!email?.reportValidity() || !email.value)
                              return;
                            void action(async () => {
                              await authRequest("request-password-reset", {
                                email: email.value,
                                redirectTo: "https://zuerst.vercel.app/reset/",
                              });
                              setNotice(
                                "Falls ein Konto besteht, erhältst du eine E-Mail zum Zurücksetzen.",
                              );
                            });
                          }}
                        >
                          Passwort vergessen?
                        </button>
                      </form>
                    </>
                  )}
                </Panel>
                <Panel>
                  <h2>Deine Daten gehören dir</h2>
                  <p className="j-muted">
                    Sichere dein Journal als Datei. Beim Import entscheidest du,
                    ob die lokalen Daten ersetzt werden.
                  </p>
                  <div className="j-split-actions">
                    <button className="j-secondary" onClick={exportFile}>
                      <Download size={18} />
                      Exportieren
                    </button>
                    <label className="j-secondary j-file">
                      <Upload size={18} />
                      Importieren
                      <input
                        type="file"
                        accept="application/json,.json"
                        onChange={(e) => {
                          void importFile(e.target.files?.[0]);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                </Panel>
                <Panel>
                  <h2>Über Zuerst</h2>
                  <p>
                    Dein Begleiter für Einkauf, Vorrat und selbst gekochte
                    Gerichte. 24 vollständige Rezepte, lokale Bonerkennung in
                    den nativen Apps und ein ruhiger Blick auf deine Kochwoche.
                  </p>
                  <p className="j-muted">
                    Von Vora · ein Projekt von Odkaz Labs. Version 1.3.0.
                  </p>
                  <a
                    className="j-link"
                    href="https://github.com/Myria-Jr/zuerst"
                  >
                    Quellcode auf GitHub <ArrowUpRight size={17} />
                  </a>
                </Panel>
              </>
            )}
          </>
        )}
      </main>
      {notice && (
        <div className="j-toast" role="status">
          <span>{notice}</span>
          <button
            className="j-icon"
            aria-label="Hinweis schließen"
            onClick={() => setNotice("")}
          >
            <X size={18} />
          </button>
        </div>
      )}
      <dialog
        ref={modal}
        className="j-dialog"
        aria-labelledby="journal-dialog-title"
        onCancel={closeModal}
        onClose={closeModal}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeModal();
        }}
      >
        <div className="j-dialog-content">
          <button
            className="j-icon j-dialog-close"
            aria-label="Schließen"
            onClick={closeModal}
          >
            <X size={22} />
          </button>
          {detail && (
            <>
              <span className="j-dialog-symbol">
                <Utensils size={28} />
              </span>
              <h2 id="journal-dialog-title">{detail.name}</h2>
              <div className="j-detail-meta">
                <Clock3 size={18} />
                {detail.minutes} Min. · 2 Portionen
              </div>
              <p>{detail.note}</p>
              <h3>Das brauchst du</h3>
              <dl className="j-amounts">
                {detail.items.map(([id, amount]) => (
                  <div key={id}>
                    <dt>
                      {label(id)}
                      {state.stock.includes(id) && (
                        <Check size={15} aria-label="Im Vorrat" />
                      )}
                    </dt>
                    <dd>{amount}</dd>
                  </div>
                ))}
              </dl>
              {detailCooking ? (
                <>
                  <h3>So geht’s</h3>
                  <ol className="j-cook-steps">
                    {detail.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  <button
                    className="j-primary"
                    onClick={() => {
                      setState((s) => cooked(s, detail));
                      closeModal();
                      navigate("history");
                      setNotice("Gericht eingetragen.");
                    }}
                  >
                    Gekocht eintragen <Check size={19} />
                  </button>
                </>
              ) : missing(detail, state).length === 0 ? (
                <button
                  className="j-primary"
                  onClick={() => setDetailCooking(true)}
                >
                  Jetzt kochen <ArrowUpRight size={19} />
                </button>
              ) : (
                <p className="j-muted">
                  Bestätige vorhandene Zutaten im Vorrat oder ergänze Fehlendes
                  über die Einkaufsliste.
                </p>
              )}
              <button
                className="j-secondary"
                disabled={!missing(detail, state).length}
                onClick={() => {
                  setState((s) => addMissing(s, detail));
                  setNotice(
                    "Fehlende Zutaten ergänzt. Mengen findest du im Rezept.",
                  );
                }}
              >
                <ShoppingBasket size={19} />
                {missing(detail, state).length
                  ? "Fehlendes auf die Liste"
                  : "Alles im Vorrat"}
              </button>
              <label className="j-field">
                Für welchen Tag?
                <input
                  type="date"
                  value={planDay}
                  min={dayKey()}
                  max={daysFromToday(366)[365]}
                  onChange={(e) => setPlanDay(e.target.value)}
                />
              </label>
              <button
                className="j-secondary"
                disabled={!planDay || planDay < dayKey()}
                onClick={() => {
                  setState((s) => ({
                    ...s,
                    plans: [
                      ...s.plans.filter((p) => p.day !== planDay),
                      { day: planDay, recipeId: detail.id },
                    ],
                  }));
                  closeModal();
                  navigate("plan");
                  setShopping(false);
                  setNotice("Gericht eingeplant.");
                }}
              >
                <CalendarDays size={19} />
                Einplanen
              </button>
            </>
          )}
          {bon && (
            <>
              <ReceiptText size={30} />
              <h2 id="journal-dialog-title">Vom Bon in den Vorrat</h2>
              <p>
                Füge den Text deines Kassenbons ein. In der Android- und iOS-App
                kannst du auch ein Foto aufnehmen oder auswählen.
              </p>
              {review === null ? (
                <>
                  <label className="j-field">
                    Bontext
                    <textarea
                      rows={7}
                      maxLength={20000}
                      placeholder={"PAPRIKA ROT 1,29\nBIO EIER 2,49"}
                      value={bonText}
                      onChange={(e) => setBonText(e.target.value)}
                    />
                  </label>
                  <button
                    className="j-primary"
                    disabled={!bonText.trim()}
                    onClick={readBon}
                  >
                    Zutaten erkennen <Search size={19} />
                  </button>
                </>
              ) : (
                <>
                  <h3>Bitte prüfen</h3>
                  {review.length ? (
                    <div className="j-chips">
                      {review.map((id) => (
                        <button
                          key={id}
                          aria-label={`${label(id)} nicht übernehmen`}
                          onClick={() =>
                            setReview((r) => r!.filter((x) => x !== id))
                          }
                        >
                          {label(id)}
                          <X size={16} />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p>
                      Keine weitere bekannte Zutat erkannt. Ergänze sie nach dem
                      Schließen über die Vorratssuche.
                    </p>
                  )}
                  <button
                    className="j-primary"
                    disabled={!review.length}
                    onClick={() => {
                      setState((s) => ({
                        ...s,
                        stock: [...new Set([...s.stock, ...review])],
                      }));
                      closeModal();
                      navigate("stock");
                      setNotice(
                        "Bestätigte Zutaten ergänzt. Der Bontext wurde verworfen.",
                      );
                    }}
                  >
                    In Vorrat übernehmen <Check size={19} />
                  </button>
                  <button className="j-link" onClick={() => setReview(null)}>
                    Bontext ändern
                  </button>
                </>
              )}
            </>
          )}
          {restore && (
            <>
              <Download size={29} />
              <h2 id="journal-dialog-title">Sicherung wiederherstellen?</h2>
              <p>
                Du übernimmst {restore.stock.length} Vorratszutaten,{" "}
                {restore.meals.length} Kocheinträge und {restore.plans.length}{" "}
                geplante Gerichte. Deine aktuellen lokalen Daten werden ersetzt.
              </p>
              <p className="j-muted">
                Exportiere vorher eine Datei, wenn du den aktuellen Stand
                behalten möchtest.
              </p>
              <button
                className="j-primary"
                onClick={() => {
                  setState(restore);
                  setStorageReady(true);
                  setChecked([]);
                  closeModal();
                  setNotice("Sicherung wiederhergestellt.");
                }}
              >
                Lokale Daten ersetzen <Check size={19} />
              </button>
              <button className="j-secondary" onClick={exportFile}>
                Aktuellen Stand exportieren
              </button>
            </>
          )}
          {notice && <p className="j-muted" role="status">{notice}</p>}
        </div>
      </dialog>
    </div>
  );
}
