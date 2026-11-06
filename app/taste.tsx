"use client";
import {useEffect,useState} from 'react';
import {SlidersHorizontal,Check} from 'lucide-react';
import {ingredients,label,type Ingredient} from '../lib/recipes';
import {emptyTaste,parseTaste,tasteChoices,type Taste} from '../lib/taste';
export function useTaste(){
  const [taste,setTaste]=useState<Taste>(emptyTaste),[ready,setReady]=useState(false),[error,setError]=useState('');
  useEffect(()=>{try{setTaste(parseTaste(JSON.parse(localStorage.getItem('zuerst-taste')??'null')));}catch{setError('Vorlieben konnten nicht geladen werden. Du kannst sie neu auswählen.');}setReady(true);},[]);
  function update(value:Taste){setTaste(value);try{localStorage.setItem('zuerst-taste',JSON.stringify(value));setError('');}catch{setError('Vorlieben gelten für diese Sitzung. Der Gerätespeicher ist nicht verfügbar.');}}
  return {taste,update,ready,error};
}
export function TastePicker({value,onChange,error}:{value:Taste;onChange:(v:Taste)=>void;error:string}){
  const [editing,setEditing]=useState(false),[avoid,setAvoid]=useState('');
  function toggle(id:Ingredient){onChange({...value,likes:value.likes.includes(id)?value.likes.filter(x=>x!==id):[...value.likes,id],avoids:value.avoids.filter(x=>x!==id)});}
  return <section className="j-panel w-tone-kitchen taste-panel">
    <div className="j-section-title"><h2><SlidersHorizontal size={22}/> Dein Geschmack</h2>{value.done&&<button className="j-text-button" onClick={()=>setEditing(!editing)} aria-expanded={editing}>{editing?'Schließen':'Anpassen'}</button>}</div>
    {!value.done||editing?<>
      <p>Was isst du gern? Deine Auswahl sortiert die Rezepte. Alles bleibt lokal und jederzeit änderbar.</p>
      <div className="j-chips" role="group" aria-label="Ernährungsweise">{(['all','vegetarian'] as const).map(id=><button key={id} aria-pressed={value.diet===id} onClick={()=>onChange({...value,diet:id})}>{id==='all'?'Alles':'Vegetarisch'}</button>)}</div>
      <div className="j-chips" role="group" aria-label="Rezeptausrichtung">{(['all','balanced','comfort'] as const).map(id=><button key={id} aria-pressed={value.mode===id} onClick={()=>onChange({...value,mode:id})}>{{all:'Beides',balanced:'Gemüse & Alltag',comfort:'Comfort Food'}[id]}</button>)}</div>
      <p className="w-label">Das mag ich</p><div className="j-chips" role="group" aria-label="Lieblingszutaten">{tasteChoices.map(id=><button key={id} aria-pressed={value.likes.includes(id)} onClick={()=>toggle(id)}>{label(id)}</button>)}</div>
      <label className="w-field">Zutat ausschließen<select aria-label="Zutat ausschließen" value={avoid} onChange={e=>{const id=e.target.value as Ingredient;setAvoid('');if(id)onChange({...value,avoids:[...new Set([...value.avoids,id])],likes:value.likes.filter(x=>x!==id)});}}><option value="">Zutat wählen</option>{Object.keys(ingredients).sort((a,b)=>label(a as Ingredient).localeCompare(label(b as Ingredient),'de')).map(id=><option value={id} key={id}>{label(id as Ingredient)}</option>)}</select></label>
      {value.avoids.length>0&&<div className="j-chips" aria-label="Ausgeschlossene Zutaten">{value.avoids.map(id=><button key={id} onClick={()=>onChange({...value,avoids:value.avoids.filter(x=>x!==id)})}>{label(id)} wieder erlauben</button>)}</div>}
      <p className="w-small">Filter prüfen Zutatenbezeichnungen, keine Produktetiketten oder Spuren. Bei Allergien jede Zutat selbst prüfen.</p>
      <button className="j-primary" onClick={()=>{onChange({...value,done:true});setEditing(false);}}><Check size={20}/>{value.likes.length||value.avoids.length||value.diet!=='all'||value.mode!=='all'?'Passende Rezepte zeigen':'Alle Rezepte entdecken'}</button>
    </>:<p>{value.diet==='vegetarian'?'Vegetarisch · ':''}{value.likes.length} Lieblingszutaten · {value.avoids.length} ausgeschlossen. {{all:'Alltag & Genuss',balanced:'Gemüse & Alltag',comfort:'Comfort Food'}[value.mode]}</p>}
    {error&&<p role="status">{error}</p>}
  </section>;
}
