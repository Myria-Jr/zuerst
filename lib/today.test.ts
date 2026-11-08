import {test} from 'node:test';
import {equal,ok,deepEqual} from 'node:assert/strict';
import {nextMeal,recentPortions,parseDashboard,recipeLink,shiftDay} from './today.ts';
import {emptyJournal} from './journal.ts';
import {emptyTaste} from './taste.ts';
import {emptyWellness} from './wellness.ts';
test('Heute zeigt keine erfundenen vollständigen Treffer und respektiert Ausschlüsse',()=>{
 const state=emptyJournal();equal(nextMeal(state,emptyTaste(),'2026-11-08'),null);
 state.stock=['paprika','eggs','oil','salt'];const choice=nextMeal(state,emptyTaste(),'2026-11-08');equal(choice?.recipe.id,'paprika-eier');deepEqual(choice?.missing,[]);
 const avoiding=nextMeal(state,{...emptyTaste(),avoids:['eggs']},'2026-11-08');ok(!avoiding?.recipe.items.some(([id])=>id==='eggs'));
 state.stock=['paprika'];ok(nextMeal(state,emptyTaste(),'2026-11-08')!.missing.length>0);
});
test('Bewusst gewählter Tagesplan hat Vorrang; Datumswechsel bleiben korrekt',()=>{
 const state=emptyJournal();state.plans=[{day:'2026-11-08',recipeId:'paprika-eier'}];const choice=nextMeal(state,emptyTaste(),'2026-11-08');equal(choice?.reason,'plan');equal(choice?.missing.length,4);equal(shiftDay('2026-12-31',2),'2027-01-02');
});
test('Wiederholte Lebensmittel liefern jüngste bestätigte Portionen ohne automatischen Eintrag',()=>{
 const state=emptyWellness();state.food=[{id:'1',foodId:'pasta-cooked',grams:100,day:'2026-11-07',at:'2026-11-07T10:00:00Z',source:'photo'},{id:'2',foodId:'pasta-cooked',grams:200,day:'2026-11-08',at:'2026-11-08T10:00:00Z',source:'manual'}];equal(recentPortions(state).length,1);equal(recentPortions(state)[0].grams,200);equal(state.food.length,2);
 deepEqual(parseDashboard({water:false,movement:'yes'}),{water:false,nutrition:true,movement:true});ok(recipeLink('paprika-eier').endsWith('recipe=paprika-eier'));
});
