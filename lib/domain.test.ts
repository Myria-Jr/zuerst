import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isSupportedRecipeLink, matchPantry, nutrientsForAmount, unknownNutrients, type FoodKey, type InventoryLot } from './domain.ts';

const fixture = JSON.parse(readFileSync(new URL('../shared/domain-fixtures.json', import.meta.url), 'utf8'));
const raw: FoodKey = {id:'pasta',preparation:'raw'};
const lot = (override: Partial<InventoryLot> = {}): InventoryLot => ({id:'fixture',food:raw,amount:{value:100,unit:'g'},confirmed:true,expiry:null,source:{evidence:'manual'},...override});

test('Nährwerte nutzen dieselben Testvektoren wie Android; Unbekanntes bleibt unbekannt',()=>{
  assert.deepEqual(nutrientsForAmount(fixture.nutrition.per100g,{value:fixture.nutrition.grams,unit:'g'}),fixture.nutrition.expected);
  assert.deepEqual(nutrientsForAmount(unknownNutrients(),{value:100,unit:'g'}),unknownNutrients());
  assert.equal(nutrientsForAmount(fixture.nutrition.per100g,{value:1,unit:'piece'}),null);
  assert.throws(()=>nutrientsForAmount(fixture.nutrition.per100g,{value:Infinity,unit:'g'}));
});
test('Vorratsmengen, Zustand und Bestätigung verhindern falsche vollständige Treffer',()=>{
  const need = [{food:raw,amount:{value:100,unit:'g' as const}}];
  assert.equal(matchPantry(need,[lot({amount:{value:75,unit:'g'}}),lot({id:'second',amount:{value:25,unit:'g'}})],'2026-11-05')[0].availability,'available');
  assert.equal(matchPantry(need,[lot({amount:{value:75,unit:'g'}})],'2026-11-05')[0].availability,'insufficient');
  assert.equal(matchPantry(need,[lot({amount:null})],'2026-11-05')[0].availability,'quantity-unknown');
  assert.equal(matchPantry(need,[lot({confirmed:false})],'2026-11-05')[0].availability,'missing');
  assert.equal(matchPantry(need,[lot({food:{id:'pasta',preparation:'cooked'}})],'2026-11-05')[0].availability,'missing');
  assert.throws(()=>matchPantry([...need,...need],[lot()],'2026-11-05'));
});
test('Verbrauchsdatum und Erinnerung bleiben unterschiedliche Angaben',()=>{
  const need=[{food:raw,amount:null}];
  assert.equal(matchPantry(need,[lot({expiry:{day:'2026-11-04',kind:'use-by'}})],'2026-11-05')[0].excludedUseByLots,1);
  assert.equal(matchPantry(need,[lot({expiry:{day:'2026-11-04',kind:'reminder'}})],'2026-11-05')[0].availability,'available');
});
test('Social-Links sind streng auf unterstützte HTTPS-Hosts begrenzt',()=>{
  for(const entry of fixture.links) assert.equal(isSupportedRecipeLink(entry.url),entry.accepted,entry.url);
});
