"use client";
import {useEffect,useState} from 'react';
import {RefreshCw} from 'lucide-react';
import release from '../public/version.json';
import {hasNewerVersion} from '../lib/update';

export function UpdateNotice(){
  const [next,setNext]=useState('');
  useEffect(()=>{
    let active=true;
    async function check(){
      if(document.visibilityState!=='visible'||!navigator.onLine)return;
      try{const response=await fetch('/version.json',{cache:'no-store',signal:AbortSignal.timeout(8000)});if(!response.ok)return;const value=await response.json();if(active)setNext(hasNewerVersion(release.version,value?.version)?value.version:'');}catch{}
    }
    void check();const timer=setInterval(check,300000);document.addEventListener('visibilitychange',check);window.addEventListener('online',check);
    return()=>{active=false;clearInterval(timer);document.removeEventListener('visibilitychange',check);window.removeEventListener('online',check);};
  },[]);
  return next?<aside className="w-feedback update-notice" role="status"><RefreshCw size={20}/><span>Neue Version {next} verfügbar. Speichere offene Eingaben vor dem Neuladen.</span><button className="j-text-button" onClick={()=>location.reload()}>Jetzt neu laden</button></aside>:null;
}
