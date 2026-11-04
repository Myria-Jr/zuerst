export const ingredients = {
  paprika: ['Paprika', 'Peperoni', 'Gemüsepaprika'],
  eggs: ['Eier', 'Ei'],
  tomatoes: ['Tomaten', 'Tomate', 'Cherrytomaten', 'Cocktailtomaten'],
  zucchini: ['Zucchini', 'Zucchetti'],
  carrots: ['Karotten', 'Möhren', 'Möhre', 'Karotte', 'Rüebli'],
  potatoes: ['Kartoffeln', 'Kartoffel', 'Erdäpfel'],
  bread: ['Brot', 'Toast', 'Baguette'],
  pasta: ['Nudeln', 'Pasta', 'Spaghetti', 'Penne', 'Fusilli'],
  rice: ['Gekochter Reis', 'Reis', 'Reisreste'],
  spinach: ['Babyspinat', 'Spinat', 'Blattspinat'],
  mushrooms: ['Champignons', 'Pilze', 'Champignon'],
  cucumber: ['Gurke', 'Salatgurke'],
  chickpeas: ['Kichererbsen (Dose)', 'Kichererbse'],
  whitebeans: ['Weiße Bohnen (Dose)', 'Bohnen'],
  lentils: ['Linsen (Dose)', 'Linse', 'Dosenlinsen'],
  tuna: ['Thunfisch (Dose)', 'Thunfisch'],
  peas: ['TK-Erbsen', 'Erbsen', 'Tiefkühlerbsen'],
  onion: ['Zwiebel', 'Zwiebeln'],
  garlic: ['Knoblauch', 'Knoblauchzehe'],
  cheese: ['Reibekäse', 'Käse', 'Gouda', 'Emmentaler', 'Cheddar'],
  feta: ['Feta', 'Schafskäse', 'Hirtenkäse'],
  mozzarella: ['Mozzarella'],
  yoghurt: ['Naturjoghurt', 'Joghurt', 'Jogurt', 'Joghourt'],
  milk: ['Milch'],
  flour: ['Mehl', 'Weizenmehl'],
  oats: ['Haferflocken', 'Hafer'],
  banana: ['Banane', 'Bananen'],
  apple: ['Apfel', 'Äpfel'],
  lemon: ['Zitrone', 'Zitronensaft'],
  couscous: ['Couscous', 'Kuskus'],
  tortilla: ['Tortillas', 'Wraps', 'Tortilla', 'Wrap'],
  cannedtomatoes: ['Gehackte Tomaten (Dose)', 'Dosentomaten', 'Tomatenstücke'],
  oil: ['Öl', 'Olivenöl', 'Rapsöl', 'Pflanzenöl', 'Bratöl', 'Oel'],
  salt: ['Salz'],
  water: ['Wasser'],
} as const;

export type Ingredient = keyof typeof ingredients;
export const label = (id: Ingredient): string => ingredients[id][0];
export const pantry: ReadonlySet<Ingredient> = new Set(['oil', 'salt', 'water']);
export const quick: readonly Ingredient[] = ['paprika', 'eggs', 'tomatoes', 'zucchini', 'potatoes', 'carrots', 'bread', 'pasta'];

export type Recipe = {
  id: string;
  name: string;
  minutes: number;
  note: string;
  items: readonly (readonly [Ingredient, string])[];
  steps: readonly string[];
};

export const recipes: readonly Recipe[] = [
  {
    id: 'paprika-eier', name: 'Paprika-Rührei', minutes: 10,
    note: 'Saftige Paprikawürfel und cremiges Rührei aus einer Pfanne.',
    items: [['paprika', '1 große'], ['eggs', '4'], ['oil', '1 EL'], ['salt', '2 Prisen']],
    steps: ['Paprika entkernen und klein würfeln. Eier mit Salz in einer Schüssel verquirlen.', 'Öl in einer Pfanne erhitzen. Paprika bei mittlerer Hitze etwa 5 Minuten braten.', 'Eier dazugießen. Mit einem Pfannenwender langsam zusammenschieben, bis die Eier vollständig gestockt sind.'],
  },
  {
    id: 'paprika-quesadilla', name: 'Paprika-Käse-Quesadillas', minutes: 15,
    note: 'Knusprige Fladen mit geschmolzenem Käse und Paprika.',
    items: [['paprika', '1'], ['tortilla', '4 kleine'], ['cheese', '120 g'], ['oil', '1 TL']],
    steps: ['Paprika entkernen und fein würfeln. Zwei Tortillas mit Käse und Paprika belegen, die anderen beiden darauflegen.', 'Eine Pfanne dünn mit Öl ausstreichen. Quesadillas nacheinander bei mittlerer Hitze je Seite 2–3 Minuten braten.', 'Kurz ruhen lassen und in Viertel schneiden.'],
  },
  {
    id: 'paprika-reis', name: 'Paprika-Eier-Reis', minutes: 15,
    note: 'Reis vom Vortag wird mit Paprika und Ei zur schnellen Pfanne.',
    items: [['paprika', '1'], ['eggs', '2'], ['rice', '350 g'], ['oil', '1 EL'], ['salt', '¼ TL']],
    steps: ['Paprika entkernen und würfeln. Eier verquirlen und den gekochten, gekühlt gelagerten Reis mit einer Gabel auflockern.', 'Öl in einer großen Pfanne erhitzen. Paprika 4 Minuten anbraten, Reis dazugeben und unter Rühren erhitzen, bis er überall dampft.', 'Reis an den Rand schieben. Eier in der Mitte vollständig stocken lassen, dann alles mischen und salzen.'],
  },
  {
    id: 'tomaten-eier', name: 'Tomaten-Eier-Pfanne', minutes: 12,
    note: 'Süße Tomaten und locker gestockte Eier.',
    items: [['tomatoes', '250 g'], ['eggs', '4'], ['oil', '1 EL'], ['salt', '¼ TL']],
    steps: ['Tomaten in Spalten schneiden. Eier mit Salz verquirlen.', 'Öl in einer Pfanne erhitzen. Tomaten 4 Minuten braten, bis ein Teil ihres Safts verdampft ist.', 'Eier dazugeben und bei mittlerer Hitze langsam rühren, bis sie vollständig gestockt sind.'],
  },
  {
    id: 'shakshuka', name: 'Schnelle Shakshuka', minutes: 18,
    note: 'Eier in einer sämigen Tomatensauce mit Paprika.',
    items: [['eggs', '4'], ['paprika', '1'], ['cannedtomatoes', '1 Dose (400 g)'], ['oil', '1 EL'], ['salt', '¼ TL']],
    steps: ['Paprika entkernen, fein würfeln und in Öl 4 Minuten anbraten.', 'Gehackte Tomaten und Salz zugeben und 5 Minuten offen einkochen.', 'Vier Mulden in die Sauce drücken und je ein Ei hineinschlagen. Zugedeckt 6–8 Minuten garen, bis die Eier vollständig gestockt sind.'],
  },
  {
    id: 'spinat-omelett', name: 'Spinat-Feta-Omelett', minutes: 12,
    note: 'Ein weiches Omelett mit würzigem Feta und Blattspinat.',
    items: [['eggs', '4'], ['spinach', '100 g'], ['feta', '80 g'], ['oil', '1 EL']],
    steps: ['Spinat waschen und trocken schütteln. Eier verquirlen und Feta zerbröseln.', 'Öl in einer Pfanne erhitzen und Spinat darin 2 Minuten zusammenfallen lassen.', 'Eier eingießen und mit Feta bestreuen. Bei kleiner Hitze zugedeckt vollständig stocken lassen, zusammenklappen und halbieren.'],
  },
  {
    id: 'caprese', name: 'Tomaten mit Mozzarella', minutes: 8,
    note: 'Saftige Tomatenscheiben, milder Mozzarella und Olivenöl.',
    items: [['tomatoes', '350 g'], ['mozzarella', '2 Kugeln (250 g)'], ['oil', '1 EL'], ['salt', '2 Prisen']],
    steps: ['Tomaten in Scheiben schneiden. Mozzarella abtropfen lassen und in Scheiben schneiden.', 'Tomaten und Mozzarella abwechselnd auf zwei Tellern anrichten.', 'Mit Salz würzen und mit Öl beträufeln.'],
  },
  {
    id: 'tomatenbrot', name: 'Knuspriges Tomatenbrot', minutes: 10,
    note: 'Geröstetes Brot mit frischer Tomate und Knoblauch.',
    items: [['bread', '4 Scheiben'], ['tomatoes', '250 g'], ['garlic', '1 Zehe'], ['oil', '1 EL'], ['salt', '2 Prisen']],
    steps: ['Brot im Toaster oder in einer trockenen Pfanne knusprig rösten.', 'Tomaten fein würfeln und mit Öl und Salz mischen.', 'Knoblauch halbieren und die warmen Brotscheiben mit der Schnittfläche abreiben. Tomaten darauf verteilen.'],
  },
  {
    id: 'zucchini-pasta', name: 'Zucchini-Zitronen-Pasta', minutes: 18,
    note: 'Gebratene Zucchini und ein Spritzer Zitrone machen die Pasta frisch.',
    items: [['zucchini', '1 große'], ['pasta', '200 g'], ['lemon', '½'], ['oil', '2 EL'], ['salt', '2 TL'], ['water', '1,5 l']],
    steps: ['Wasser mit Salz aufkochen und Nudeln nach Packungsangabe garen. Eine kleine Tasse Kochwasser auffangen.', 'Zucchini in dünne Halbmonde schneiden und in Öl 6–8 Minuten goldbraun braten.', 'Nudeln, 3 EL Kochwasser und den Saft der halben Zitrone zur Zucchini geben und alles durchschwenken.'],
  },
  {
    id: 'zucchini-feta', name: 'Zucchini-Feta-Pfanne', minutes: 13,
    note: 'Gebratene Zucchinischeiben mit würzigen Fetabröseln.',
    items: [['zucchini', '2 kleine'], ['feta', '150 g'], ['garlic', '1 Zehe'], ['oil', '1 EL']],
    steps: ['Zucchini längs halbieren und in Scheiben schneiden. Knoblauch fein hacken.', 'Zucchini in Öl bei hoher Hitze 7–8 Minuten goldbraun braten. Knoblauch in der letzten Minute dazugeben.', 'Pfanne vom Herd ziehen, Feta darüberbröseln und kurz unterheben.'],
  },
  {
    id: 'zucchini-puffer', name: 'Zucchinipuffer', minutes: 20,
    note: 'Kleine goldbraune Puffer mit saftiger Mitte.',
    items: [['zucchini', '300 g'], ['eggs', '2'], ['flour', '60 g'], ['oil', '2 EL'], ['salt', '½ TL']],
    steps: ['Zucchini grob raspeln, mit Salz mischen und nach 3 Minuten in einem sauberen Tuch ausdrücken.', 'Raspel mit Eiern und Mehl vermischen. Öl in einer großen Pfanne erhitzen.', 'Die Masse portionsweise als flache Puffer ausbacken, je Seite etwa 3 Minuten. Bei Bedarf in zwei Durchgängen braten.'],
  },
  {
    id: 'kartoffel-eier', name: 'Kartoffel-Eier-Pfanne', minutes: 20,
    note: 'Goldbraune Kartoffelwürfel mit gebratenem Ei.',
    items: [['potatoes', '400 g'], ['eggs', '3'], ['oil', '2 EL'], ['salt', '½ TL']],
    steps: ['Kartoffeln gründlich waschen und in höchstens 1 cm große Würfel schneiden.', 'In Öl bei mittlerer Hitze zugedeckt 8 Minuten braten. Deckel abnehmen, salzen und unter Wenden 5–6 Minuten goldbraun braten.', 'Eier verquirlen, über die Kartoffeln geben und unter Wenden vollständig stocken lassen.'],
  },
  {
    id: 'kartoffel-roesti', name: 'Schnelle Kartoffelrösti', minutes: 17,
    note: 'Dünne, goldbraune Rösti mit knusprigen Rändern.',
    items: [['potatoes', '450 g'], ['oil', '2 EL'], ['salt', '½ TL']],
    steps: ['Kartoffeln schälen, grob reiben und in einem sauberen Tuch gründlich ausdrücken. Mit Salz mischen.', 'Öl in einer großen Pfanne erhitzen. Vier flache Rösti aus der Masse formen und in die Pfanne drücken.', 'Bei mittlerer Hitze je Seite 5–6 Minuten braten, bis sie außen goldbraun und innen weich sind.'],
  },
  {
    id: 'karotten-rohkost', name: 'Karotten-Apfel-Salat', minutes: 10,
    note: 'Saftige Rohkost mit Apfel und frischer Zitrone.',
    items: [['carrots', '300 g'], ['apple', '1'], ['lemon', '½'], ['oil', '1 EL'], ['salt', '1 Prise']],
    steps: ['Karotten schälen und grob raspeln. Apfel entkernen und dazuraspeln.', 'Zitrone auspressen. Saft mit Öl und Salz verrühren.', 'Das Dressing unterheben und den Salat kurz durchziehen lassen.'],
  },
  {
    id: 'karotten-couscous', name: 'Karotten-Couscous mit Joghurt', minutes: 16,
    note: 'Warmer Couscous mit gebratenen Karotten und kühlem Joghurt.',
    items: [['carrots', '250 g'], ['couscous', '150 g'], ['yoghurt', '150 g'], ['oil', '1 EL'], ['salt', '½ TL'], ['water', '180 ml']],
    steps: ['Wasser aufkochen. Couscous mit der Hälfte des Salzes übergießen und zugedeckt 5 Minuten quellen lassen.', 'Karotten schälen, in dünne Scheiben schneiden und in Öl 7–8 Minuten braten. Mit dem übrigen Salz würzen.', 'Couscous mit einer Gabel auflockern, Karotten untermischen und Joghurt daraufgeben.'],
  },
  {
    id: 'kaesetoast', name: 'Knuspriger Käsetoast', minutes: 10,
    note: 'Außen kross, innen geschmolzener Käse.',
    items: [['bread', '4 Scheiben'], ['cheese', '100 g'], ['oil', '2 TL']],
    steps: ['Käse auf zwei Brotscheiben verteilen und mit den übrigen Scheiben abdecken.', 'Die Außenseiten dünn mit Öl bestreichen. Sandwiches in eine Pfanne bei mittlerer Hitze legen.', 'Je Seite 3–4 Minuten rösten, bis das Brot knusprig ist und der Käse geschmolzen ist.'],
  },
  {
    id: 'arme-ritter', name: 'Arme Ritter mit Banane', minutes: 14,
    note: 'Goldbraune Brotscheiben mit reifer Banane.',
    items: [['bread', '4 Scheiben'], ['eggs', '2'], ['milk', '100 ml'], ['banana', '1 reife'], ['oil', '1 EL']],
    steps: ['Eier und Milch auf einem tiefen Teller verquirlen. Brotscheiben kurz von beiden Seiten eintauchen.', 'Öl in einer großen Pfanne erhitzen und das Brot je Seite etwa 3 Minuten goldbraun braten, bis die Eimasse vollständig gestockt ist.', 'Banane in Scheiben schneiden und auf dem warmen Brot verteilen.'],
  },
  {
    id: 'tomatenpasta', name: 'Pasta mit Tomaten und Knoblauch', minutes: 18,
    note: 'Eine schnelle Sauce aus frischen Tomaten und Knoblauch.',
    items: [['pasta', '200 g'], ['tomatoes', '350 g'], ['garlic', '2 Zehen'], ['oil', '2 EL'], ['salt', '2 TL'], ['water', '1,5 l']],
    steps: ['Wasser mit fast dem ganzen Salz aufkochen und Nudeln nach Packungsangabe garen.', 'Tomaten würfeln und Knoblauch fein hacken. Knoblauch 30 Sekunden in Öl anschwitzen, dann die Tomaten zugeben.', 'Tomaten 7 Minuten köcheln lassen, mit dem restlichen Salz würzen und die abgetropften Nudeln unterheben.'],
  },
  {
    id: 'bohnenpfanne', name: 'Weiße Bohnen in Tomatensauce', minutes: 14,
    note: 'Cremige Bohnen in einer schnell eingekochten Tomatensauce.',
    items: [['whitebeans', '1 Dose (240 g Abtropfgewicht)'], ['cannedtomatoes', '1 Dose (400 g)'], ['onion', '1 kleine'], ['oil', '1 EL'], ['salt', '¼ TL']],
    steps: ['Zwiebel fein würfeln und 3 Minuten in Öl anschwitzen. Bohnen abgießen und abspülen.', 'Tomaten und Salz in die Pfanne geben und 5 Minuten offen köcheln lassen.', 'Bohnen unterrühren und weitere 4 Minuten erhitzen.'],
  },
  {
    id: 'kichererbsensalat', name: 'Kichererbsen-Gurken-Salat', minutes: 10,
    note: 'Knackige Gurke, Kichererbsen und ein Zitronendressing.',
    items: [['chickpeas', '1 Dose (240 g Abtropfgewicht)'], ['cucumber', '1'], ['lemon', '½'], ['oil', '1 EL'], ['salt', '¼ TL']],
    steps: ['Kichererbsen abgießen und abspülen. Gurke würfeln.', 'Zitrone auspressen. Saft mit Öl und Salz verrühren.', 'Kichererbsen und Gurke mit dem Dressing mischen.'],
  },
  {
    id: 'linsen-thunfisch', name: 'Linsensalat mit Thunfisch', minutes: 10,
    note: 'Ein herzhafter Salat mit Tomate und Zitrone.',
    items: [['lentils', '1 Dose (240 g Abtropfgewicht)'], ['tuna', '1 Dose (130 g Abtropfgewicht)'], ['tomatoes', '200 g'], ['lemon', '½'], ['oil', '1 EL'], ['salt', '2 Prisen']],
    steps: ['Linsen abgießen und abspülen. Thunfisch abtropfen lassen und mit einer Gabel zerteilen.', 'Tomaten würfeln. Zitrone auspressen und den Saft mit Öl und Salz verrühren.', 'Alles vorsichtig mischen und auf zwei Teller verteilen.'],
  },
  {
    id: 'pilz-reis', name: 'Pilzreis mit Erbsen', minutes: 15,
    note: 'Braun gebratene Champignons, Erbsen und Reis aus der Pfanne.',
    items: [['mushrooms', '250 g'], ['peas', '120 g'], ['rice', '350 g'], ['oil', '1 EL'], ['salt', '½ TL']],
    steps: ['Champignons putzen und in Scheiben schneiden. In einer großen Pfanne in Öl 6 Minuten kräftig braten.', 'Erbsen und den gekochten, gekühlt gelagerten Reis zugeben.', 'Unter häufigem Rühren mindestens 5 Minuten braten, bis alles überall dampfend heiß ist. Mit Salz abschmecken.'],
  },
  {
    id: 'bananen-pancakes', name: 'Bananen-Hafer-Pancakes', minutes: 16,
    note: 'Kleine, weiche Pancakes mit reifer Banane.',
    items: [['banana', '2 reife'], ['eggs', '2'], ['oats', '80 g'], ['oil', '1 EL']],
    steps: ['Bananen mit einer Gabel zerdrücken. Eier und Haferflocken unterrühren und den Teig 3 Minuten quellen lassen.', 'Öl in einer Pfanne auf mittlerer Stufe erhitzen. Je Pancake einen gehäuften Esslöffel Teig hineingeben und etwas flach drücken.', 'In zwei Durchgängen je Seite 2–3 Minuten backen, bis die Pancakes goldbraun und innen fest sind.'],
  },
  {
    id: 'apfel-porridge', name: 'Warmes Apfelporridge', minutes: 10,
    note: 'Cremige Haferflocken mit fein geriebenem Apfel.',
    items: [['apple', '1 großer'], ['oats', '100 g'], ['milk', '400 ml'], ['salt', '1 Prise']],
    steps: ['Apfel entkernen und grob raspeln.', 'Milch, Haferflocken und Salz unter Rühren aufkochen.', 'Apfel dazugeben und etwa 5 Minuten sanft köcheln lassen. Zwischendurch umrühren.'],
  },
];
