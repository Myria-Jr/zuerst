'use client';

import { ArrowLeft, ArrowRight, Check, ChevronRight, Clock, Download, Info, Plus, RotateCw, Search, Users, Utensils, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { confirmationChoices, matchRecipes, searchIngredients } from '../lib/match';
import { label, pantry, quick, recipes, type Ingredient, type Recipe } from '../lib/recipes';
import { IngredientArt } from './ingredient-art';

type Screen = 'pick' | 'confirm' | 'result' | 'cook';
const screens: readonly Screen[] = ['pick', 'confirm', 'result', 'cook'];
const stepNames = ['Auswählen', 'Bestätigen', 'Kochen'];
const androidApk = process.env.NEXT_PUBLIC_ZUERST_APK;

function Steps({ screen }: { screen: Screen }) {
  const current = Math.min(screens.indexOf(screen), 2);
  return <ol className="steps" aria-label="Fortschritt">
    {stepNames.map((name, index) => <li key={name} aria-current={index === current ? 'step' : undefined} className={index <= current ? 'reached' : ''}>
      <span className="step-number" aria-hidden="true">{index < current ? <Check size={13} /> : index + 1}</span><span>{name}</span>
      {index < 2 && <ChevronRight size={13} className="step-divider" aria-hidden="true" />}
    </li>)}
  </ol>;
}

function Button({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button className="primary" type="button" onClick={onClick} disabled={disabled}>{children}</button>;
}

function RecipeDetail({ recipe }: { recipe: Recipe }) {
  return <div className="cook-grid">
    <section className="ingredient-list" aria-labelledby="amount-title">
      <h2 id="amount-title">Zutaten</h2>
      <p className="small muted">Mengen für 2 Portionen</p>
      <dl>{recipe.items.map(([id, amount]) => <div key={id}><dt>{label(id)}</dt><dd>{amount}</dd></div>)}</dl>
    </section>
    <section className="instructions" aria-labelledby="cook-title">
      <h2 id="cook-title">So geht’s</h2>
      <ol>{recipe.steps.map((step, index) => <li key={step}><span className="instruction-number" aria-hidden="true">{index + 1}</span><p>{step}</p></li>)}</ol>
    </section>
  </div>;
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>('pick');
  const [picked, setPicked] = useState<Ingredient[]>([]);
  const [confirmed, setConfirmed] = useState<Ingredient[]>([]);
  const [query, setQuery] = useState('');
  const [idea, setIdea] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const firstRender = useRef(true);
  const focusAfterPick = useRef(false);
  const focusAfterConfirm = useRef(false);
  const chosen = useRef<HTMLDivElement>(null);
  const ingredientsRef = useRef({ picked, confirmed });
  useEffect(() => { ingredientsRef.current = { picked, confirmed }; }, [picked, confirmed]);

  useEffect(() => {
    history.replaceState({ ...history.state, zuerst: 'pick' }, '');
    const onPop = (event: PopStateEvent) => {
      const target: Screen = event.state?.zuerst ?? 'pick';
      const { picked, confirmed } = ingredientsRef.current;
      if (target !== 'pick' && !picked.length) {
        history.go(-screens.indexOf(target));
        return;
      }
      if (target === 'cook' && !matchRecipes(picked, confirmed).complete.length) {
        history.back();
        return;
      }
      setScreen(target);
      setQuery('');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    window.scrollTo(0, 0);
    heading.current?.focus({ preventScroll: true });
  }, [screen]);

  useEffect(() => {
    if (!focusAfterPick.current) return;
    focusAfterPick.current = false;
    chosen.current?.querySelector<HTMLButtonElement>('button:last-child')?.focus({ preventScroll: true });
  }, [picked]);

  const matches = matchRecipes(picked, confirmed);
  const suggestion = matches.complete[idea % (matches.complete.length || 1)];
  const almost = matches.almost;
  const choices = confirmationChoices(picked);
  const searching = query.trim().length > 0;
  const visible = searching ? searchIngredients(query) : quick;

  useEffect(() => {
    if (!focusAfterConfirm.current || !suggestion) return;
    focusAfterConfirm.current = false;
    heading.current?.focus();
  }, [suggestion]);

  function go(next: Screen) {
    history.pushState({ ...history.state, zuerst: next }, '');
    setQuery('');
    setScreen(next);
  }

  function back() {
    history.back();
  }

  function changeSelection() {
    history.go(-screens.indexOf(screen));
  }

  function togglePicked(id: Ingredient, moveFocus = false) {
    if (picked.includes(id)) {
      setPicked(picked.filter((item) => item !== id));
      setConfirmed(confirmed.filter((item) => item !== id));
    } else if (picked.length < 3) {
      focusAfterPick.current = moveFocus;
      setPicked([...picked, id]);
      setQuery('');
    }
    setIdea(0);
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const first = visible.find((id) => !picked.includes(id));
    if (searching && first && picked.length < 3) togglePicked(first, true);
  }

  function toggleConfirmed(id: Ingredient) {
    setConfirmed((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    setIdea(0);
  }

  function confirmMissing(id: Ingredient) {
    focusAfterConfirm.current = true;
    setConfirmed((current) => [...current, id]);
    setIdea(0);
  }

  return <div className="shell">
    <header className="topbar">
      <div className="brand" aria-label="Zuerst"><img src="/icon.svg" width="42" height="42" alt="" /><span>Zuerst<span className="brand-dot">.</span></span></div>
      <div className="flex items-center gap-1 sm:gap-2">
        {androidApk && <a className="apk-link inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-3 sm:px-4" href={androidApk} download="zuerst-android.apk" aria-label="Android-App herunterladen (APK)">
          <Download size={17} aria-hidden="true" /><span>Android<span className="hidden sm:inline">-App</span></span>
        </a>}
        <button type="button" className="info-button" aria-label="Über Zuerst" onClick={() => dialog.current?.showModal()}><Info size={18} aria-hidden="true" /><span className={androidApk ? 'hidden sm:inline' : undefined}>Über Zuerst</span></button>
      </div>
    </header>

    <main>
      {screen === 'pick' ? <section className="hero" aria-labelledby="start-title">
        <div className="hero-copy">
          <h1 id="start-title" ref={heading} tabIndex={-1}>Was möchtest du <em>aufbrauchen?</em></h1>
          <p>Ein Gericht aus deinen Zutaten. In höchstens 20 Minuten.</p>
        </div>
        <img className="hero-art" src="/kitchen.svg" alt="" width="510" height="350" fetchPriority="high" />
      </section> : <div className="backbar">
        <button type="button" className="text-button" onClick={back}><ArrowLeft size={19} aria-hidden="true" />{screen === 'confirm' ? 'Zur Auswahl' : screen === 'result' ? 'Zur Bestätigung' : 'Zur Empfehlung'}</button>
        <Steps screen={screen} />
      </div>}

      {screen === 'pick' && <section className="workbench">
        <div className="bench-top"><h2>Deine Zutaten</h2><Steps screen={screen} /></div>
        <div className="pick-grid">
          <div className="picker">
            <form className="search" role="search" onSubmit={submitSearch}>
              <Search size={22} aria-hidden="true" />
              <label className="sr-only" htmlFor="ingredient-search">Zutat suchen</label>
              <input id="ingredient-search" ref={search} type="search" autoComplete="off" placeholder="Zutat suchen …" value={query} onChange={(event) => setQuery(event.target.value)} />
              {searching && <button className="clear" type="button" aria-label="Suche leeren" onClick={() => { setQuery(''); search.current?.focus(); }}><X size={19} aria-hidden="true" /></button>}
            </form>
            <div className="option-heading" aria-live="polite">{searching ? `${visible.length} Treffer` : 'Schnellwahl'}</div>
            {visible.length ? <div className="pills" aria-label={searching ? 'Suchergebnisse' : 'Schnellwahl'} role="group">
              {visible.map((id) => <button type="button" key={id} className="pill" aria-pressed={picked.includes(id)} disabled={picked.length === 3 && !picked.includes(id)} onClick={() => togglePicked(id, searching && !picked.includes(id))}>
                <IngredientArt id={id} />{label(id)}{picked.includes(id) && <Check className="pill-check" size={15} aria-hidden="true" />}
              </button>)}
            </div> : <p className="small muted search-empty">Diese Zutat ist noch nicht im Katalog. Versuch es mit einem anderen Begriff.</p>}
          </div>
          <aside className="selection" aria-label="Deine Auswahl">
            <div className="selection-header"><span>Ausgewählt</span><span className="counter" aria-live="polite">{picked.length} / 3</span></div>
            {picked.length ? <div className="chosen" ref={chosen}>{picked.map((id, index) => <button type="button" key={id} className="chosen-pill" onClick={() => { togglePicked(id); search.current?.focus({ preventScroll: true }); }} aria-label={`${label(id)} entfernen${index === 0 ? ', erste Zutat' : ''}`}>
              {index === 0 && <span className="first-marker" aria-hidden="true">1</span>}{label(id)}<X size={16} aria-hidden="true" />
            </button>)}</div> : <div className="empty-selection"><Plus size={18} aria-hidden="true" /><span>Wähle deine erste Zutat.</span></div>}
            <p className="small muted">{picked.length === 3 ? 'Drei Zutaten ausgewählt.' : 'Eine reicht. Zwei weitere sind optional.'}</p>
          </aside>
        </div>
        <div className="action-row"><Button onClick={() => go('confirm')} disabled={!picked.length}>Zutaten prüfen <ArrowRight size={20} aria-hidden="true" /></Button></div>
      </section>}

      {screen === 'confirm' && <section className="stage confirmation">
        <div className="stage-intro">
          <h1 ref={heading} tabIndex={-1}>Was hast du noch da?</h1>
          <p>Bestätige nur, was du wirklich zur Hand hast.</p>
          <div className="summary"><span>Aufbrauchen:</span>{picked.map((id) => <strong key={id}>{label(id)}</strong>)}</div>
        </div>
        <div className="confirmation-body">
          {choices.length ? <div className="confirm-grid" role="group" aria-label="Weitere Zutaten bestätigen">
            {choices.map((id) => <button type="button" key={id} className="confirm-option" aria-pressed={confirmed.includes(id)} onClick={() => toggleConfirmed(id)}>
              <IngredientArt id={id} /><span className="confirm-name">{label(id)}{pantry.has(id) && <small>Grundzutat</small>}</span><span className="checkbox" aria-hidden="true">{confirmed.includes(id) && <Check size={16} />}</span>
            </button>)}
          </div> : <p>Für deine Auswahl gibt es keine weiteren Zutaten zu prüfen.</p>}
          <div className="action-row"><Button onClick={() => go('result')}>Gericht finden <ArrowRight size={20} aria-hidden="true" /></Button></div>
        </div>
      </section>}

      {screen === 'result' && (suggestion ? <section className="stage result" aria-labelledby="recommendation-title">
        <div className="result-main">
          <div className="recipe-label"><Utensils size={17} aria-hidden="true" /> Deine Empfehlung</div>
          <h1 id="recommendation-title" ref={heading} tabIndex={-1} aria-live="polite">{suggestion.recipe.name}</h1>
          <p>{suggestion.recipe.note}</p>
          <div className="time"><Clock size={18} aria-hidden="true" /> {suggestion.recipe.minutes} Min.</div>
          <div className="summary"><span>Du verbrauchst:</span>{suggestion.used.map((id) => <strong key={id}>{label(id)}</strong>)}</div>
        </div>
        <div className="recipe-visual" aria-hidden="true"><div className="plate"><IngredientArt id={suggestion.used[0]} /></div></div>
        <div className="result-actions">
          <Button onClick={() => go('cook')}>Jetzt kochen <ArrowRight size={20} aria-hidden="true" /></Button>
          {matches.complete.length > 1 && <button type="button" className="text-button alternate" onClick={() => setIdea((index) => (index + 1) % matches.complete.length)}><RotateCw size={18} aria-hidden="true" /> Andere Idee</button>}
        </div>
      </section> : <section className="stage feedback">
        {almost ? <>
          <div className="feedback-art"><IngredientArt id={almost.missing[0]} /></div>
          <h1 ref={heading} tabIndex={-1}>Eine Zutat fehlt noch.</h1>
          <p>Hast du <strong>{label(almost.missing[0])}</strong> da? Dann kannst du <strong>{almost.recipe.name}</strong> in {almost.recipe.minutes} Min. machen.</p>
          <div className="feedback-actions"><Button onClick={() => confirmMissing(almost.missing[0])}>{label(almost.missing[0])} bestätigen <Check size={20} aria-hidden="true" /></Button>
            <button className="text-button" type="button" onClick={changeSelection}>Auswahl ändern</button></div>
        </> : <>
          <div className="feedback-art"><Search size={30} aria-hidden="true" /></div>
          <h1 ref={heading} tabIndex={-1}>Noch kein passendes Gericht.</h1>
          <p>Zuerst findet mit {label(picked[0])} und den bestätigten Zutaten kein Rezept. Wähle eine andere erste Zutat oder ergänze, was noch da ist.</p>
          <div className="feedback-actions"><Button onClick={changeSelection}>Auswahl ändern <ArrowRight size={20} aria-hidden="true" /></Button></div>
        </>}
      </section>)}

      {screen === 'cook' && suggestion && <article className="stage cook">
        <div className="stage-intro">
          <h1 ref={heading} tabIndex={-1}>{suggestion.recipe.name}</h1>
          <div className="cook-meta"><span><Clock size={18} aria-hidden="true" /> {suggestion.recipe.minutes} Min.</span><span><Users size={18} aria-hidden="true" /> 2 Portionen</span></div>
        </div>
        <RecipeDetail recipe={suggestion.recipe} />
      </article>}
    </main>

    <footer className="footer"><span>Aus Resten wird Essen.</span><span>{recipes.length} Rezepte · Ohne Konto</span></footer>
    <dialog ref={dialog} className="about" aria-labelledby="about-title" onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="about-content">
        <button type="button" className="close" aria-label="Info schließen" onClick={() => dialog.current?.close()}><X size={22} aria-hidden="true" /></button>
        <img src="/icon.svg" width="46" height="46" alt="" />
        <h2 id="about-title">Über Zuerst</h2>
        <p>Zuerst hilft dir, aus vorhandenen Zutaten ein schnelles Gericht zu machen. Die {recipes.length} Rezepte sind in der App gespeichert. Deine Auswahl bleibt auf diesem Gerät und wird beim Schließen verworfen.</p>
        {androidApk && <p><a className="download-text" href={androidApk} download="zuerst-android.apk">Android-App herunterladen (APK)</a>. Öffne die Datei auf deinem Android-Gerät, um Zuerst zu installieren.</p>}
        <p className="about-credit">Eine Marke von Odkaz Labs.</p>
      </div>
    </dialog>
  </div>;
}
