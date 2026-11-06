import { writeFile } from 'node:fs/promises';

// Original Zuerst recipes. Each combination has its own ingredient list and preparation.
const recipes = [];
const ingredientNames = {
  broccoli:'Brokkoli', corn:'Mais (Dose)', kidneybeans:'Kidneybohnen (Dose)', tofu:'Naturtofu',
  avocado:'Avocado', cream:'Sahne', creamcheese:'Frischkäse', quark:'Quark',
  gnocchi:'Gnocchi (Kühlregal)', ricenoodles:'Dünne Reisnudeln', soysauce:'Sojasauce',
  peanutbutter:'Erdnussmus', sesame:'Sesam', coconutmilk:'Kokosmilch', curry:'Currypulver',
  cumin:'Kreuzkümmel', paprikaSpice:'Paprikapulver', pepper:'Pfeffer', cinnamon:'Zimt',
  cocoa:'Backkakao', sugar:'Zucker', honey:'Honig', berries:'Frische Beeren', pear:'Birne',
  orange:'Orange', mango:'Mango', nuts:'Walnüsse', raisins:'Rosinen', lettuce:'Blattsalat',
  radish:'Radieschen', mustard:'Senf', vinegar:'Essig', herbs:'Petersilie', basil:'Basilikum',
  ginger:'Ingwer', springonion:'Frühlingszwiebeln', tomatoPaste:'Tomatenmark',
  chocolate:'Zartbitterschokolade', bakingpowder:'Backpulver', butter:'Butter',
  cookedpotatoes:'Gekochte Kartoffeln', hummus:'Hummus', olives:'Oliven', pesto:'Basilikumpesto',
  tomatoes:'Tomaten', zucchini:'Zucchini', carrots:'Karotten', mushrooms:'Champignons',
  spinach:'Babyspinat', paprika:'Paprika', cucumber:'Gurke', peas:'TK-Erbsen',
  lentils:'Linsen (Dose)', chickpeas:'Kichererbsen (Dose)', whitebeans:'Weiße Bohnen (Dose)',
  feta:'Feta', cheese:'Reibekäse', mozzarella:'Mozzarella', tuna:'Thunfisch (Dose)',
  onion:'Zwiebel', garlic:'Knoblauch', lemon:'Zitrone', banana:'Banane', apple:'Apfel',
};
const prep = {
  broccoli:'Brokkoli in sehr kleine Röschen teilen, den geschälten Strunk fein schneiden.',
  tomatoes:'Tomaten waschen und würfeln.', zucchini:'Zucchini waschen und fein würfeln.',
  carrots:'Karotten schälen und fein raspeln.', mushrooms:'Champignons putzen und dünn schneiden.',
  spinach:'Spinat waschen und abtropfen lassen.', paprika:'Paprika waschen, entkernen und fein würfeln.',
  cucumber:'Gurke waschen und würfeln.', avocado:'Avocado halbieren, entkernen und das Fruchtfleisch würfeln.',
  onion:'Zwiebel schälen und fein würfeln.', garlic:'Knoblauch schälen und fein hacken.',
  ginger:'Ingwer schälen und fein reiben.', springonion:'Frühlingszwiebeln waschen und in Ringe schneiden.',
  lettuce:'Salat waschen, trocknen und zupfen.', radish:'Radieschen waschen und fein schneiden.',
  tofu:'Tofu abtropfen lassen und in kleine Würfel schneiden.',
  banana:'Banane schälen und in Scheiben schneiden.', apple:'Apfel waschen, entkernen und klein schneiden.',
  pear:'Birne waschen, entkernen und klein schneiden.', mango:'Mango schälen und das Fruchtfleisch würfeln.',
  orange:'Orange schälen und die Stücke klein schneiden.', berries:'Frische Beeren verlesen und waschen.',
  nuts:'Walnüsse grob hacken.', chocolate:'Schokolade fein hacken.',
  cookedpotatoes:'Gekühlt gelagerte gekochte Kartoffeln in dünne Scheiben schneiden.',
};
const canned = new Set(['corn','kidneybeans','chickpeas','whitebeans','lentils','tuna']);
const cold = new Set(['feta','cheese','mozzarella','cream','creamcheese','quark','cucumber','avocado','lettuce','radish','herbs','basil','hummus','olives','pesto','lemon','nuts','sesame','peanutbutter','soysauce','curry','cumin','paprikaSpice','pepper','tomatoPaste','mustard','vinegar']);
const names = ids => ids.map(id => ingredientNames[id] ?? id).join(', ');
const prepare = extras => extras.map(([id]) => prep[id] ?? (canned.has(id) ? `${ingredientNames[id]} abgießen${id === 'tuna' ? '' : ' und abspülen'}.` : '')).filter(Boolean).join(' ');
const warm = extras => extras.filter(([id]) => !cold.has(id)).map(([id])=>id);
function add(family, title, minutes, category, mode, base, extras, steps, note) {
  title=title.replace(/\bPilze\b/g,'Pilzen');
  const items = [...base, ...extras];
  if(new Set(items.map(x=>x[0])).size !== items.length) throw new Error('Doppelte Zutat: '+title);
  recipes.push({id:`z-${family}-${recipes.filter(r=>r.id.startsWith(`z-${family}-`)).length+1}`,name:title,minutes,category,mode,note:note ?? `${title}: frisch zubereitet, für zwei Portionen.`,items,steps});
}
const v = (title, extras) => ({title,extras});
const savory = [
  v('Spinat und Feta',[['spinach','150 g'],['feta','100 g']]),
  v('Brokkoli und Zitrone',[['broccoli','250 g'],['lemon','½']]),
  v('Pilze und Frischkäse',[['mushrooms','200 g'],['creamcheese','80 g']]),
  v('Zucchini und Basilikum',[['zucchini','250 g'],['basil','10 g']]),
  v('Tomaten und Mozzarella',[['tomatoes','200 g'],['mozzarella','125 g']]),
  v('Paprika und Mais',[['paprika','1'],['corn','140 g Abtropfgewicht']]),
  v('Erbsen und Pesto',[['peas','150 g'],['pesto','40 g']]),
  v('Bohnen und Tomatenmark',[['whitebeans','240 g Abtropfgewicht'],['tomatoPaste','2 EL']]),
];
for(const x of savory) {
  const cooked = warm(x.extras);
  const finish = x.extras.filter(([id])=>cold.has(id));
  add('pasta',`Pasta mit ${x.title}`,20,'Pasta','balanced',[['pasta','200 g'],['water','1,5 l'],['salt','1 TL'],['oil','1 EL']],x.extras,
    [`Wasser mit der Hälfte des Salzes aufkochen. Nudeln nach Packungsangabe garen; vor dem Abgießen 100 ml Kochwasser auffangen. ${prepare(x.extras)}`,
     cooked.length ? `${names(cooked)} in einer großen Pfanne mit Öl bei mittlerer Hitze 7–9 Minuten braten, bis das Gemüse weich ist. Alle Zutaten vollständig durcherhitzen.` : 'Öl in einer großen Pfanne auf niedriger Stufe erwärmen.',
     `Nudeln und übriges Salz zugeben. ${finish.length?names(finish.map(x=>x[0]))+' untermischen; Zitrone dafür auspressen, Käse zerteilen und Kräuter hacken. ':''}Kochwasser nach und nach zugeben, bis sich alles gut verbindet. Heiß servieren.`]);
  add('gnocchi',`Gnocchi mit ${x.title}`,18,'Pfannengerichte','comfort',[['gnocchi','400 g'],['oil','1 EL'],['salt','¼ TL'],['water','80 ml']],x.extras,
    [prepare(x.extras)||'Die Zutaten abwiegen und bereitstellen.',`Gnocchi in Öl 4 Minuten goldbraun anbraten. ${cooked.length?names(cooked)+' zufügen. ':''}Mit Wasser ablöschen und zugedeckt 6–8 Minuten garen, bis Gemüse und Gnocchi weich sind.`,
     `Salzen. ${finish.length?names(finish.map(x=>x[0]))+' unterheben; Käse zerteilen, Kräuter hacken und Zitrone auspressen. ':''}Noch eine Minute erwärmen und auf zwei Teller verteilen.`]);
  add('couscous',`Couscous mit ${x.title}`,18,'Bowls','balanced',[['couscous','160 g'],['water','200 ml'],['oil','1 EL'],['salt','½ TL']],x.extras,
    [`Wasser aufkochen, mit Couscous und der Hälfte des Salzes in einer hitzefesten Schüssel verrühren. Zugedeckt nach Packungsangabe, etwa 5 Minuten, quellen lassen. ${prepare(x.extras)}`,
     cooked.length?`${names(cooked)} in Öl 7–9 Minuten braten, bis alles weich und vollständig heiß ist.`:'Öl mit dem übrigen Salz verrühren.',
     `Couscous mit einer Gabel lockern und alle Zutaten mit dem übrigen Salz mischen. ${finish.length?names(finish.map(x=>x[0]))+' dabei frisch zugeben; Käse zerteilen, Kräuter hacken und Zitrone auspressen.':''}`]);
  add('reis',`Reispfanne mit ${x.title}`,18,'Pfannengerichte','balanced',[['rice','350 g, gekocht und gekühlt'],['oil','1 EL'],['salt','¼ TL'],['water','50 ml']],x.extras,
    [prepare(x.extras)||'Zutaten abwiegen.',`${cooked.length?names(cooked):'Den Reis'} in Öl ${cooked.length?'7 Minuten':'2 Minuten'} anbraten. Reis auflockern und mit Wasser zugeben. Unter Rühren an allen Stellen mindestens 2 Minuten auf 70 °C erhitzen, bei Bedarf länger garen.`,
     `Mit Salz würzen. ${finish.length?names(finish.map(x=>x[0]))+' zugeben; Käse zerteilen, Kräuter hacken und Zitrone auspressen. ':''}Auf zwei Teller verteilen und sofort servieren.`], 'Für bereits gekochten, zügig gekühlten und durchgehend kalt gelagerten Reis.');
}
const fillings = [
 v('Kichererbsen und Paprika',[['chickpeas','240 g Abtropfgewicht'],['paprika','1'],['cumin','½ TL']]),
 v('Kidneybohnen und Mais',[['kidneybeans','240 g Abtropfgewicht'],['corn','140 g Abtropfgewicht'],['paprikaSpice','½ TL']]),
 v('Pilze und Spinat',[['mushrooms','180 g'],['spinach','100 g'],['garlic','1 Zehe']]),
 v('Zucchini und Feta',[['zucchini','200 g'],['feta','80 g'],['pepper','1 Prise']]),
 v('Tomate und Avocado',[['tomatoes','150 g'],['avocado','1'],['lemon','½']]),
 v('Tofu und Karotte',[['tofu','180 g'],['carrots','150 g'],['soysauce','1 EL']]),
 v('Thunfisch und Frühlingszwiebel',[['tuna','130 g Abtropfgewicht'],['springonion','2'],['lemon','½']]),
 v('Brokkoli und Erbsen',[['broccoli','150 g'],['peas','100 g'],['curry','½ TL']]),
];
for(const x of fillings) {
 const w=warm(x.extras), finish=x.extras.filter(([id])=>cold.has(id));
 const cook=`${w.length?names(w)+' in Öl 7–8 Minuten bei mittlerer Hitze braten, bis das Gemüse weich ist und alle Zutaten heiß sind.':'Öl mit den vorbereiteten Zutaten mischen.'} ${finish.length?names(finish.map(x=>x[0]))+' zugeben; Feta zerbröseln und Zitrone auspressen.':''}`;
 add('wrap',`Warme Wraps mit ${x.title}`,18,'Wraps','balanced',[['tortilla','4 kleine'],['yoghurt','120 g'],['oil','1 EL'],['salt','¼ TL']],x.extras,[prepare(x.extras),cook,'Joghurt mit Salz verrühren. Tortillas in einer trockenen Pfanne kurz erwärmen, mit Joghurt und Füllung belegen und einrollen.']);
 add('quesadilla',`Quesadillas mit ${x.title}`,20,'Wraps','comfort',[['tortilla','4 kleine'],['cheese','100 g'],['oil','1 EL'],['salt','1 Prise']],x.extras,[prepare(x.extras),cook+' Mit Salz würzen.','Die Füllung und den Reibekäse auf zwei Tortillas verteilen und mit den übrigen abdecken. In einer beschichteten Pfanne nacheinander bei mittlerer Hitze pro Seite 2 Minuten rösten, bis der Käse geschmolzen ist.']);
 add('toast',`Pfannentoast mit ${x.title}`,20,'Brote','comfort',[['bread','4 große Scheiben'],['creamcheese','80 g'],['oil','1 EL'],['salt','1 Prise']],x.extras,[prepare(x.extras),cook+' Mit Salz würzen.','Brotscheiben in einer zweiten trockenen Pfanne von beiden Seiten rösten. Mit Frischkäse bestreichen und die warme Füllung darauf verteilen.']);
 add('kartoffel',`Kartoffelpfanne mit ${x.title}`,20,'Pfannengerichte','balanced',[['cookedpotatoes','400 g'],['oil','1 EL'],['salt','¼ TL'],['water','50 ml']],x.extras,[`${prep.cookedpotatoes} ${prepare(x.extras)}`,`Kartoffeln und ${names(w)||'die vorbereitete Einlage'} in Öl 5 Minuten anbraten. Wasser zugeben und zugedeckt weitere 7 Minuten garen. Reste an allen Stellen mindestens 2 Minuten auf 70 °C erhitzen.`,`Mit Salz würzen. ${finish.length?names(finish.map(x=>x[0]))+' unterheben; Feta zerbröseln und Zitrone auspressen. ':''}Sofort servieren.`]);
}
const salads=[
 v('Gurke und Kräuterjoghurt',[['cucumber','½'],['yoghurt','100 g'],['herbs','15 g']]),
 v('Tomate und Basilikum',[['tomatoes','200 g'],['basil','10 g']]),
 v('Karotte und Kreuzkümmel',[['carrots','200 g'],['cumin','½ TL']]),
 v('Paprika und Oliven',[['paprika','1'],['olives','50 g']]),
 v('Avocado und Mais',[['avocado','1'],['corn','140 g Abtropfgewicht']]),
 v('Radieschen und Feta',[['radish','150 g'],['feta','80 g']]),
 v('Apfel und Walnuss',[['apple','1'],['nuts','30 g']]),
 v('Blattsalat und Senf',[['lettuce','100 g'],['mustard','1 TL']]),
];
for(const [baseId,baseName] of [['chickpeas','Kichererbsensalat'],['lentils','Linsensalat'],['whitebeans','Bohnensalat']])for(const x of salads) {
 add(baseId,`${baseName} mit ${x.title}`,12,'Salate','balanced',[[baseId,'240 g Abtropfgewicht'],['oil','1 EL'],['lemon','½'],['salt','¼ TL']],x.extras,[`${ingredientNames[baseId]} abgießen und abspülen. ${prepare(x.extras)}`,'Zitrone auspressen, mit Öl und Salz in einer Schüssel verrühren.',`Alle vorbereiteten Zutaten mit dem Dressing mischen. Kräuter hacken, Feta zerbröseln und gegebenenfalls Joghurt oder Senf unterrühren. Auf zwei Schalen verteilen.`]);
}
const warmProfiles=[
 v('Brokkoli und Erbsen',[['broccoli','180 g'],['peas','100 g']]),
 v('Karotte und Ingwer',[['carrots','200 g'],['ginger','10 g']]),
 v('Spinat und Knoblauch',[['spinach','200 g'],['garlic','1 Zehe']]),
 v('Paprika und Mais',[['paprika','1'],['corn','140 g Abtropfgewicht']]),
 v('Pilze und Frühlingszwiebel',[['mushrooms','200 g'],['springonion','2']]),
 v('Zucchini und Tomate',[['zucchini','150 g'],['tomatoes','150 g']]),
 v('Tofu und Curry',[['tofu','200 g'],['curry','1 TL']]),
 v('Bohnen und Kreuzkümmel',[['kidneybeans','240 g Abtropfgewicht'],['cumin','½ TL']]),
];
for(const x of warmProfiles) {
 const veg=x.extras.filter(([id])=>!cold.has(id));
 add('suppe',`Cremige Suppe mit ${x.title}`,20,'Suppen','balanced',[['whitebeans','240 g Abtropfgewicht'],['water','400 ml'],['cream','60 ml'],['oil','1 EL'],['salt','½ TL']],x.extras,[`Bohnen abgießen und abspülen. ${prepare(x.extras)}`,`${names(veg.map(x=>x[0]))} in Öl 3 Minuten anschwitzen. Bohnen, Wasser, Salz und gegebenenfalls die Gewürze zufügen. Zugedeckt 10 Minuten köcheln, bis das Gemüse weich ist.`,'Sahne einrühren. Mit einem Pürierstab vorsichtig fein pürieren oder mit einem Kartoffelstampfer zerdrücken. Noch einmal aufkochen und heiß servieren.']);
 add('curry',`Kokoscurry mit ${x.title}`,20,'Currys','balanced',[['chickpeas','240 g Abtropfgewicht'],['coconutmilk','250 ml'],['oil','1 EL'],['salt','¼ TL'],['water','100 ml'],...(x.extras.some(([id])=>id==='curry')?[]:[['curry','1 TL']])],x.extras,[`Kichererbsen abgießen und abspülen. ${prepare(x.extras)}`,`${names(veg.map(x=>x[0]))} in Öl 3 Minuten anbraten. Kichererbsen, Kokosmilch, Wasser, Salz und die übrigen Gewürze zufügen.`,'Unter gelegentlichem Rühren 10 Minuten sanft köcheln, bis alles weich und vollständig heiß ist. Auf zwei tiefe Teller verteilen.']);
 add('linsenpfanne',`Warme Linsen mit ${x.title}`,18,'Pfannengerichte','balanced',[['lentils','400 g Abtropfgewicht'],['oil','1 EL'],['salt','¼ TL'],['water','100 ml']],x.extras,[`Linsen abgießen und abspülen. ${prepare(x.extras)}`,`${names(veg.map(x=>x[0]))} in Öl 5 Minuten anbraten. Linsen, Wasser, Salz und die übrigen Gewürze zufügen.`,'Weitere 7 Minuten zugedeckt köcheln, bis das Gemüse weich und alles durchgehend heiß ist. Kurz offen einkochen lassen und servieren.']);
 add('reisnudeln',`Reisnudeln mit ${x.title}`,20,'Pasta','balanced',[['ricenoodles','160 g, Garzeit höchstens 5 Minuten'],['water','1 l'],['oil','1 EL'],['soysauce','2 EL']],x.extras,[`${prepare(x.extras)} Wasser aufkochen und die dünnen Reisnudeln nach Packungsangabe garen, anschließend abgießen.`,`${names(veg.map(x=>x[0]))} in Öl bei mittlerer Hitze 8–10 Minuten braten, bis das Gemüse weich ist. Gewürze gegebenenfalls einrühren.`,'Reisnudeln und Sojasauce unterheben und zwei Minuten zusammen heiß schwenken. Bei Bedarf etwas vom angegebenen Wasser zum Lockern verwenden.']);
}
const omelets=[
 v('Pilz-Käse',[['mushrooms','180 g'],['cheese','60 g']]),v('Spinat-Tomate',[['spinach','100 g'],['tomatoes','150 g']]),
 v('Brokkoli-Feta',[['broccoli','180 g'],['feta','60 g']]),v('Zucchini-Basilikum',[['zucchini','180 g'],['basil','10 g']]),
 v('Paprika-Frischkäse',[['paprika','1'],['creamcheese','60 g']]),v('Erbsen-Frühlingszwiebel',[['peas','120 g'],['springonion','2']]),
 v('Mais-Mozzarella',[['corn','140 g Abtropfgewicht'],['mozzarella','100 g']]),v('Karotten-Curry',[['carrots','150 g'],['curry','½ TL']]),
];
for(const x of omelets)for(const egg of [true,false]) {
 const main=egg?'eggs':'tofu';
 add(egg?'omelett':'tofu',`${x.title}-${egg?'Omelett':'Tofu-Rührei'}`,20,'Frühstück', 'balanced',[[main,egg?'4':'300 g'],['oil','1 EL'],['salt','¼ TL'],['water','30 ml']],x.extras,
  [`${prepare(x.extras)} ${egg?'Eier mit Salz, Wasser und gegebenenfalls Curry verquirlen.':'Tofu abtropfen lassen und mit einer Gabel grob zerdrücken; mit Salz, Wasser und gegebenenfalls Curry mischen.'}`,
   `${names(warm(x.extras))} in Öl 7–8 Minuten bei mittlerer Hitze garen, bis das Gemüse weich ist.`,
   egg?'Eimasse zugießen. Käse, Frischkäse oder gehackte Kräuter gegebenenfalls darauf verteilen. Zugedeckt bei niedriger bis mittlerer Hitze 5–7 Minuten garen, bis das Ei vollständig gestockt ist. Halbieren und servieren.':'Tofu und gegebenenfalls Käse oder Frischkäse zugeben und unter Wenden 5 Minuten vollständig erhitzen. Kräuter zum Schluss hacken und unterheben.']);
}
const sweet=[
 v('Banane und Zimt',[['banana','1'],['cinnamon','½ TL']]),v('Apfel und Walnuss',[['apple','1'],['nuts','30 g']]),
 v('Beeren und Kakao',[['berries','150 g'],['cocoa','1 EL']]),v('Birne und Rosine',[['pear','1'],['raisins','30 g']]),
 v('Mango und Kokos',[['mango','150 g Fruchtfleisch'],['coconutmilk','80 ml']]),v('Orange und Schokolade',[['orange','1'],['chocolate','30 g']]),
 v('Banane und Erdnuss',[['banana','1'],['peanutbutter','25 g']]),v('Apfel und Honig',[['apple','1'],['honey','1 EL']]),
];
for(const x of sweet) {
 add('porridge',`Porridge mit ${x.title}`,12,'Frühstück','balanced',[['oats','100 g'],['milk','350 ml'],['water','100 ml']],x.extras,[prepare(x.extras),'Haferflocken, Milch und Wasser unter Rühren aufkochen. Bei niedriger Hitze 5 Minuten köcheln lassen. Bei Kokosmilch diese ebenfalls einrühren.',`Obst und übrige Zutaten unterheben. Kakao oder Zimt glatt einrühren, Nüsse und Schokolade daraufstreuen. Zwei Minuten warm ziehen lassen und auf zwei Schüsseln verteilen.`]);
 add('quark',`Quarkschale mit ${x.title}`,10,'Frühstück','balanced',[['quark','300 g'],['milk','80 ml'],['oats','50 g']],x.extras,[prepare(x.extras),'Quark und Milch glatt rühren. Haferflocken unterheben; Kakao, Zimt, Honig, Erdnussmus oder Kokosmilch gegebenenfalls mit einrühren.','Obst auf dem Quark verteilen. Nüsse, Rosinen oder Schokolade gegebenenfalls darübergeben. Frisch servieren; Reste sofort kühlen.']);
 add('pancake',`Pfannkuchen mit ${x.title}`,20,'Frühstück','comfort',[['flour','100 g'],['milk','180 ml'],['eggs','1'],['oil','1 EL']],x.extras,[`${prepare(x.extras)} Mehl, Milch und Ei klümpchenfrei verrühren. Teig zwei Minuten ruhen lassen.`, 'Eine große Pfanne bei mittlerer Hitze erwärmen und jeweils dünn mit einem Teil des Öls ausstreichen. Vier dünne Pfannkuchen nacheinander je Seite etwa 1½ Minuten backen, bis das Ei vollständig gestockt und kein roher Teig mehr zu sehen ist.', 'Obst und übrige Zutaten auf den Pfannkuchen verteilen. Kakao oder Zimt darüberstäuben, Schokolade auf den heißen Pfannkuchen schmelzen lassen. Zusammenklappen und servieren.']);
 add('dessert',`Warme Schokocreme mit ${x.title}`,15,'Desserts','comfort',[['milk','350 ml'],['flour','25 g'],['cocoa','10 g'],['sugar','30 g']],x.extras.filter(([id])=>id!=='cocoa'),[prepare(x.extras),'Mehl, Kakao und Zucker mit 80 ml der Milch in einem kleinen Topf klümpchenfrei anrühren. Restliche Milch und gegebenenfalls Kokosmilch zugießen.', 'Unter ständigem Rühren langsam aufkochen und mindestens 3 Minuten sanft sprudelnd kochen lassen, damit das Mehl gart. Vom Herd nehmen, die übrigen Zutaten unterheben und Obst darauf verteilen. Kurz abkühlen lassen und warm servieren.']);
}
for(const x of fillings) {
 add('pizza',`Pfannenpizza mit ${x.title}`,20,'Pizza','comfort',[['tortilla','2 große'],['cheese','100 g'],['tomatoPaste','2 EL'],['water','3 EL'],['oil','1 EL'],['salt','1 Prise']],x.extras,[prepare(x.extras),`${names(warm(x.extras))||'Die vorbereiteten Zutaten'} in Öl 7 Minuten weich braten. Kalte Zutaten erst zum Belegen verwenden. Tomatenmark, Wasser und Salz zur Sauce verrühren.`, 'Tortillas mit Sauce bestreichen und mit Füllung und Käse belegen. Nacheinander in einer großen beschichteten Pfanne zugedeckt bei niedriger Hitze jeweils 3 Minuten erwärmen, bis der Käse schmilzt. Feta zerbröseln, Zitrone auspressen und gegebenenfalls darübergeben.']);
}
for(const x of warmProfiles) {
 add('tomatenbohnen',`Tomaten-Bohnen-Pfanne mit ${x.title}`,20,'Pfannengerichte','balanced',[['whitebeans','240 g Abtropfgewicht'],['cannedtomatoes','400 g'],['oil','1 EL'],['salt','¼ TL']],x.extras,[`Weiße Bohnen abgießen und abspülen. ${prepare(x.extras)}`,`${names(warm(x.extras))} in Öl 3 Minuten anschwitzen. Dosentomaten und gegebenenfalls Gewürze zufügen und 7 Minuten zugedeckt köcheln lassen.`, 'Bohnen und Salz zugeben und weitere 5 Minuten köcheln, bis alles vollständig heiß und das Gemüse weich ist. Auf zwei Schüsseln verteilen.']);
}
for(const x of sweet) {
 add('smoothie',`Joghurt-Smoothie mit ${x.title}`,8,'Frühstück','balanced',[['yoghurt','250 g'],['milk','200 ml']],x.extras,[prepare(x.extras), 'Obst mit Joghurt und Milch in einen Standmixer geben. Die übrigen Zutaten zufügen und 30–60 Sekunden fein mixen. Harte Nüsse nur in einem dafür geeigneten Mixer zerkleinern.', 'Auf zwei Gläser verteilen und frisch trinken. Reste sofort kühlen.']);
}
if(recipes.length!==192) throw new Error(`Erwartet 192, erhalten ${recipes.length}`);
await writeFile(new URL('../shared/recipe-library.json',import.meta.url),JSON.stringify(recipes,null,2)+'\n');
await writeFile(new URL('../shared/extra-ingredients.json',import.meta.url),JSON.stringify(Object.fromEntries(Object.entries(ingredientNames).map(([id,name])=>[id,[name]])),null,2)+'\n');
console.log(`${recipes.length} vollständige Originalrezepte erstellt.`);
