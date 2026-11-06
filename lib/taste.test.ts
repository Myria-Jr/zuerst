import {test} from 'node:test';
import {ok,deepEqual,equal} from 'node:assert/strict';
import {emptyTaste,parseTaste,rankForTaste} from './taste.ts';
import {recipes} from './recipes.ts';
import {createMealPlan} from './meal-planner.ts';
test('Unverträgliche und unbekannte Vorlieben werden bereinigt; Ausschluss gewinnt',()=>{
 const taste=parseTaste({done:true,likes:['tofu','tuna','unknown'],avoids:['tuna','tuna'],mode:'invalid',diet:'vegetarian'});
 deepEqual(taste.likes,['tofu']);deepEqual(taste.avoids,['tuna']);equal(taste.mode,'all');
});
test('Bibliothek und Vierwochenplan beachten alle Vorlieben ohne falsche Treffer',()=>{
 const taste={...emptyTaste(),diet:'vegetarian' as const,mode:'comfort' as const,likes:['mushrooms' as const],avoids:['eggs' as const]};
 const ranked=rankForTaste(recipes,taste);ok(ranked.length>0);ok(ranked[0].items.some(([id])=>id==='mushrooms'));
 for(const r of [...ranked,...createMealPlan([],28,false,20,taste)]) {ok(r.mode==='comfort'||['kaesetoast','arme-ritter','paprika-quesadilla','bananen-pancakes','kartoffel-roesti'].includes(r.id));ok(r.items.every(([id])=>!['eggs','tuna'].includes(id)));}
 equal(rankForTaste(recipes,emptyTaste()).length,recipes.length);
});
