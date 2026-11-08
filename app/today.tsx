"use client";
import {useEffect,useState} from 'react';
import {ArrowRight,BookOpen,Camera,Check,Footprints,Droplets,Utensils,SlidersHorizontal,ShoppingBasket} from 'lucide-react';
import {nextMeal,defaultDashboard,parseDashboard,type Dashboard} from '../lib/today';
import {label,type Recipe} from '../lib/recipes';
import {dayKey,weekCounts,variety,type Journal} from '../lib/journal';
import {canJournal,isAdult,totals,type Wellness} from '../lib/wellness';
import type {Taste} from '../lib/taste';
import {AnimatedNumber} from './appearance';
import type {Setter} from './wellness';
import './today.css';

export function Today({journal,wellness,setWellness,taste,openRecipe,food,health,stock,recipes,receipt,history}:{journal:Journal;wellness:Wellness;setWellness:Setter;taste:Taste;openRecipe:(r:Recipe)=>void;food:()=>void;health:()=>void;stock:()=>void;recipes:()=>void;receipt:()=>void;history:()=>void}) {
  const [dashboard,setDashboard]=useState(defaultDashboard),[editing,setEditing]=useState(false),[feedback,setFeedback]=useState(''),[undo,setUndo]=useState<string>();
  useEffect(()=>{try{setDashboard(parseDashboard(JSON.parse(localStorage.getItem('zuerst-dashboard')??'null')));}catch{}},[]);
  const enabled=canJournal(wellness), day=dayKey(), suggestion=nextMeal(journal,taste,day), entries=wellness.food.filter(e=>e.day===day), water=wellness.drinks.filter(e=>e.day===day&&e.kind==='water').reduce((a,e)=>a+e.ml,0), energy=totals(wellness,day).energyKcal;
  function toggle(key:keyof Dashboard){const next={...dashboard,[key]:!dashboard[key]};setDashboard(next);try{localStorage.setItem('zuerst-dashboard',JSON.stringify(next));}catch{setFeedback('Deine Übersicht gilt für diese Sitzung. Gerätespeicher nicht verfügbar.');}}
  function addWater(){if(!enabled){food();return;}const id=crypto.randomUUID();setWellness(s=>({...s,drinks:[...s.drinks,{id,kind:'water',ml:250,caffeineMg:0,day,at:new Date().toISOString(),name:'Wasser'}]}));setUndo(id);setFeedback('250 ml Wasser eingetragen.');}
  const cooked=weekCounts(journal).reduce((a,d)=>a+d.count,0);
  return <div className="today-layout">
    <section className="today-next w-tone-kitchen">
      <h2>{suggestion?suggestion.recipe.name:'Was kochen wir heute?'}</h2>
      <p>{suggestion?`${suggestion.recipe.minutes} Minuten · 2 Portionen${suggestion.reason==='plan'?' · Heute eingeplant':suggestion.reason==='reminder'?' · Für dein Aufbrauchdatum':''}`:'Eine Zutat reicht. Finde ein Gericht in höchstens 20 Minuten.'}</p>
      {suggestion&&<p className="today-availability">{suggestion.missing.length?`Noch nicht im Vorrat erfasst: ${suggestion.missing.slice(0,3).map(label).join(', ')}${suggestion.missing.length>3?` und ${suggestion.missing.length-3} weitere`:''}.`:'Alle Zutaten im Vorrat erfasst. Mengen und Zustand bitte prüfen.'}</p>}
      {suggestion?<button className="j-primary" onClick={()=>openRecipe(suggestion.recipe)}>Rezept ansehen <ArrowRight size={20}/></button>:<a className="j-primary" href="/kochen/">Zutat auswählen <ArrowRight size={20}/></a>}
    </section>
    <div className="today-shortcuts" aria-label="Schnellzugriff">
      <button onClick={food}><Utensils size={22}/><span>Essen eintragen</span></button>
      <button onClick={receipt}><Camera size={22}/><span>Bon erfassen</span></button>
      <button onClick={recipes}><BookOpen size={22}/><span>Rezepte finden</span></button>
    </div>
    <div className="today-section-head"><h2>Dein Überblick</h2><button className="j-text-button" aria-expanded={editing} onClick={()=>setEditing(!editing)}><SlidersHorizontal size={18}/>{editing?'Fertig':'Anpassen'}</button></div>
    {editing&&<fieldset className="today-settings"><legend>Was möchtest du auf Heute sehen?</legend>{([['water','Wasser'],['nutrition','Ernährung'],['movement','Bewegung']] as const).map(([id,name])=><label key={id}><input type="checkbox" checked={dashboard[id]} onChange={()=>toggle(id)}/>{name}</label>)}<p>Die Auswahl ändert nur deine Übersicht. Gespeicherte Daten bleiben erhalten.</p></fieldset>}
    <div className="today-grid">
      {dashboard.water&&<section className="today-tile w-tone-water"><h3><Droplets size={20}/>Wasser</h3><strong>{enabled?<><AnimatedNumber value={water}/> <small>ml</small></>:'–'}</strong><p>{enabled?'Heute protokolliert':'Freiwilliges Journal aktivieren'}</p><button className="j-text-button" onClick={addWater}>{enabled?'+ 250 ml':'Journal aktivieren'}</button></section>}
      {dashboard.nutrition&&<section className="today-tile w-tone-nutrition"><h3><Utensils size={20}/>Ernährung</h3><strong>{!enabled?'–':isAdult(wellness)&&entries.length&&energy!==null?<><AnimatedNumber value={energy}/> <small>kcal</small></>:<><AnimatedNumber value={entries.length}/> <small>Einträge</small></>}</strong><p>{enabled?'Nur bestätigte Mengen':'Essen suchen oder Foto prüfen'}</p><button className="j-text-button" onClick={food}>{enabled?'Eintrag hinzufügen':'Essen entdecken'}</button></section>}
      {dashboard.movement&&<section className="today-tile w-tone-movement"><h3><Footprints size={20}/>Bewegung</h3><strong>– <small>Schritte</small></strong><p>Mit Gerätedaten in der nativen App</p><button className="j-text-button" onClick={health}>Verbinden & Details</button></section>}
      <section className="today-tile w-tone-kitchen"><h3><ShoppingBasket size={20}/>Vorrat</h3><strong><AnimatedNumber value={journal.stock.length}/> <small>Zutaten</small></strong><p>{journal.stock.length?'Deine bestätigte Auswahl':'Starte mit einer Zutat'}</p><button className="j-text-button" onClick={stock}>Vorrat öffnen</button></section>
    </div>
    {feedback&&<p className="w-feedback" role="status"><Check size={18}/>{feedback}{undo&&<button onClick={()=>{setWellness(s=>({...s,drinks:s.drinks.filter(e=>e.id!==undo)}));setUndo(undefined);setFeedback('Wassereintrag rückgängig gemacht.');}}>Rückgängig</button>}</p>}
    <button className="today-week w-tone-trend" onClick={history}><span><strong>Deine Kochwoche</strong><span>{cooked} {cooked===1?'Gericht':'Gerichte'} · {variety(journal)} verschiedene Zutaten</span></span><ArrowRight size={22}/></button>
    <p className="today-note">Dein Überblick zeigt Einträge und verbundene Daten. Er bewertet weder deinen Körper noch deinen Tagesbedarf.</p>
  </div>;
}
