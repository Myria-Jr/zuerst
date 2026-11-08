import SwiftUI
import Charts

struct MealEntry: Codable, Identifiable {
    var id = UUID()
    let name: String
    let date: Date
    var ingredients: [String]?
    private enum CodingKeys: String, CodingKey { case id, name, date, day, ingredients }
    init(name: String, date: Date, ingredients: [String]?) { self.name = name; self.date = date; self.ingredients = ingredients }
    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = try values.decode(UUID.self, forKey: .id)
        name = try values.decode(String.self, forKey: .name)
        ingredients = try values.decodeIfPresent([String].self, forKey: .ingredients)
        if let day = try values.decodeIfPresent(String.self, forKey: .day), let parsed = JournalDates.parse(day) { date = parsed }
        else { date = try values.decode(Date.self, forKey: .date) }
    }
    func encode(to encoder: Encoder) throws {
        var values = encoder.container(keyedBy: CodingKeys.self)
        try values.encode(id, forKey: .id); try values.encode(name, forKey: .name)
        try values.encode(JournalDates.key(date), forKey: .day); try values.encode(ingredients ?? [], forKey: .ingredients)
    }
}

enum JournalDates {
    static func key(_ date: Date) -> String { { let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX"); f.dateFormat = "yyyy-MM-dd"; return f.string(from: date) }() }
    static func parse(_ day: String) -> Date? {
        let formatter = DateFormatter(); formatter.locale = Locale(identifier: "en_US_POSIX"); formatter.dateFormat = "yyyy-MM-dd"; formatter.isLenient = false
        guard let date = formatter.date(from: day), formatter.string(from: date) == day else { return nil }; return date
    }
}

struct MealPlan: Codable { let day: String; let recipeId: String }

struct KitchenJournal: Codable {
    var stock: [String] = []
    var meals: [MealEntry] = []
    var favorites: [String] = []
    var shopping: [String] = []
    var plans: [MealPlan] = []
    var name = ""
    var expiry: [String: String] = [:]
    private enum CodingKeys: String, CodingKey { case version, stock, meals, favorites, shopping, plans, name, expiry }
    init() {}
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let version = try c.decodeIfPresent(Int.self, forKey: .version) ?? 2
        guard version == 2 else { throw DecodingError.dataCorruptedError(forKey: .version, in: c, debugDescription: "Neuere App-Version erforderlich") }
        stock = try c.decode([String].self, forKey: .stock); meals = try c.decode([MealEntry].self, forKey: .meals)
        favorites = try c.decodeIfPresent([String].self, forKey: .favorites) ?? []
        shopping = try c.decodeIfPresent([String].self, forKey: .shopping) ?? []
        plans = try c.decodeIfPresent([MealPlan].self, forKey: .plans) ?? []
        name = String((try c.decodeIfPresent(String.self, forKey: .name) ?? "").prefix(40))
        expiry = try c.decodeIfPresent([String:String].self, forKey: .expiry) ?? [:]
    }
    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(2, forKey: .version); try c.encode(stock, forKey: .stock); try c.encode(meals, forKey: .meals)
        try c.encode(favorites, forKey: .favorites); try c.encode(shopping, forKey: .shopping); try c.encode(plans, forKey: .plans)
        try c.encode(name, forKey: .name); try c.encode(expiry, forKey: .expiry)
    }
    func missing(_ recipe: Recipe) -> [String] { recipe.items.map(\.id).filter { !stock.contains($0) } }
    mutating func favorite(_ id: String) { if favorites.contains(id) { favorites.removeAll { $0 == id } } else { favorites.append(id) } }
    mutating func buyMissing(_ recipe: Recipe) { for id in missing(recipe) where !shopping.contains(id) { shopping.append(id) } }
    mutating func bought(_ ids: [String]) { add(ids); shopping.removeAll { ids.contains($0) } }
    mutating func plan(_ recipe: Recipe, day: Date) { let key = JournalDates.key(day); plans.removeAll { $0.day == key }; plans.append(MealPlan(day: key, recipeId: recipe.id)) }
    static func parse(_ data: Data, catalog: Catalog) throws -> KitchenJournal {
        guard data.count <= 1_000_000 else { throw CocoaError(.fileReadTooLarge) }
        var result = try JSONDecoder().decode(KitchenJournal.self, from: data)
        let valid = Set(catalog.ingredients.map(\.id)); let recipes = Set(catalog.recipes.map(\.id))
        var seen = Set<String>(); result.stock = result.stock.filter { valid.contains($0) && seen.insert($0).inserted }
        seen = []; result.shopping = result.shopping.filter { valid.contains($0) && seen.insert($0).inserted }
        seen = []; result.favorites = result.favorites.filter { recipes.contains($0) && seen.insert($0).inserted }
        seen = []; result.plans = Array(result.plans.filter { recipes.contains($0.recipeId) && JournalDates.parse($0.day) != nil && seen.insert($0.day).inserted }.prefix(366))
        result.expiry = result.expiry.filter { result.stock.contains($0.key) && JournalDates.parse($0.value) != nil }
        return result
    }

    mutating func add(_ ids: [String]) {
        var present = Set(stock)
        stock += ids.filter { present.insert($0).inserted }
    }

    struct Day: Identifiable {
        let date: Date
        let count: Int
        var id: Date { date }
    }

    func days(calendar: Calendar = .current, now: Date = .now) -> [Day] {
        let grouped = Dictionary(grouping: meals) { calendar.startOfDay(for: $0.date) }
        let today = calendar.startOfDay(for: now)
        return (-6...0).compactMap { offset in
            calendar.date(byAdding: .day, value: offset, to: today).map { date in
                Day(date: date, count: grouped[date]?.count ?? 0)
            }
        }
    }
}

struct JournalHome: View {
    let catalog: Catalog
    @AppStorage("kitchen_journal_v1") private var saved = Data()
    @StateObject private var wellness = WellnessStore()
    @StateObject private var todayMotion = MotionJournal()
    @AppStorage("dashboard_water") private var showWater=true
    @AppStorage("dashboard_nutrition") private var showNutrition=true
    @AppStorage("dashboard_movement") private var showMovement=true
    @AppStorage("zuerst-taste") private var tasteJSON="{}"
    @State private var editDashboard=false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var more = "menu"
    @State private var tab = Tab.today
    @State private var receipt = false
    @State private var about = false
    @State private var detail: Recipe?
    @State private var plannedDay = Date.now
    @State private var cooking: CookingSession?
    @State private var removal: MealEntry?

    private enum Tab: Hashable { case today, food, recipes, stock, more }
    private struct CookingSession: Identifiable {
        let id = UUID()
        let preset: [String]
        let stock: [String]
    }

    private var journal: KitchenJournal { (try? JSONDecoder().decode(KitchenJournal.self, from: saved)) ?? KitchenJournal() }
    private var stock: [String] {
        let known = Set(catalog.ingredients.map(\.id))
        return journal.stock.filter(known.contains)
    }

    var body: some View {
        TabView(selection: $tab) {
            page("Heute") { today }
                .tabItem { Label("Heute", systemImage: "sun.max") }.tag(Tab.today)
            page("Essen") { WellnessView(store: wellness) }
                .tabItem { Label("Essen", systemImage: "fork.knife") }.tag(Tab.food)
            page("Rezepte") { RecipeLibrary(catalog: catalog, journal: journal, open: { detail = $0 }, update: update, importRecipe: {more="social";tab = .more}) }
                .tabItem { Label("Rezepte", systemImage: "book") }.tag(Tab.recipes)
            page("Vorrat") { pantry }
                .tabItem { Label("Vorrat", systemImage: "basket") }.tag(Tab.stock)
            page("Mehr") { moreContent }
                .tabItem { Label("Mehr", systemImage: "square.grid.2x2") }.tag(Tab.more)
        }
        .sheet(isPresented: $receipt) {
            ReceiptView(catalog: catalog) { ids in
                update { $0.add(ids) }
                tab = .stock
                receipt = false
            }
        }
        .sheet(isPresented: $about) {
            ProfileView(catalog: catalog, journal: journal, update: update)
        }
        .sheet(item: $detail) { recipe in
            RecipePage(catalog: catalog, recipe: recipe, journal: journal, initialDay: plannedDay, update: update) {
                update { $0.meals.insert(MealEntry(name: recipe.name, date: .now, ingredients: recipe.items.map(\.id)), at: 0) }
                detail = nil; more = "history"; tab = .more
            }
        }
        .fullScreenCover(item: $cooking) { session in
            Kitchen(catalog: catalog, preset: session.preset, stock: session.stock, onClose: { cooking = nil }) { recipe in
                guard cooking?.id == session.id else { return }
                update { $0.meals.insert(MealEntry(name: recipe.name, date: .now, ingredients: recipe.items.map(\.id)), at: 0) }
                more = "history"; tab = .more
                cooking = nil
            }
        }
    }

    private func page<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 13, content: content)
                    .frame(maxWidth: 570)
                    .padding(.horizontal, 17).padding(.vertical, 10)
                    .frame(maxWidth: .infinity)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(Palette.canvas)
            .navigationTitle(title)
            .toolbar { ToolbarItem(placement: .topBarTrailing) {
                Button { about = true } label: { Label("Profil und Sicherung", systemImage: "person.crop.circle").labelStyle(.iconOnly) }
            } }
        }
    }

    private var focusRecipe: Recipe? {
        if let plan=journal.plans.first(where:{$0.day==JournalDates.key(.now)}),let r=catalog.recipes.first(where:{$0.id==plan.recipeId}) {return r}
        let taste=(tasteJSON.data(using:.utf8).flatMap {try? JSONSerialization.jsonObject(with:$0)} as? [String:Any]) ?? [:]
        let avoids=taste["avoids"] as? [String] ?? []
        return catalog.recipes.filter { r in
            r.items.contains {stock.contains($0.id) && !catalog.pantry.contains($0.id)} && !r.items.contains {avoids.contains($0.id)} &&
            ((taste["diet"] as? String) != "vegetarian" || !r.items.contains {$0.id=="tuna"}) && ((taste["mode"] as? String ?? "all")=="all" || (r.mode ?? "balanced")==((taste["mode"] as? String) ?? "all"))
        }.sorted {a,b in journal.missing(a).count != journal.missing(b).count ? journal.missing(a).count<journal.missing(b).count : a.minutes<b.minutes}.first
    }
    private var today: some View {
        VStack(alignment:.leading,spacing:16) {
            Text(Date.now.formatted(.dateTime.locale(Locale(identifier:"de_DE")).weekday(.wide).day().month(.wide))).font(.subheadline).foregroundStyle(.secondary)
            JournalPanel(tint:Palette.kitchen) {
                Text(focusRecipe?.name ?? "Was kochen wir heute?").font(.title2.bold())
                if let recipe=focusRecipe {
                    Text("\(recipe.minutes) Minuten · 2 Portionen")
                    let missing=journal.missing(recipe)
                    Text(missing.isEmpty ? "Alle Zutaten im Vorrat erfasst. Mengen und Zustand prüfen." : "Noch nicht erfasst: " + missing.prefix(3).map {catalog.name($0)}.joined(separator:", ") + (missing.count>3 ? " und \(missing.count-3) weitere." : ".")).font(.footnote)
                    Button("Rezept ansehen") {detail=recipe}.buttonStyle(.borderedProminent).frame(minHeight:48)
                } else {
                    Text("Eine Zutat reicht. Finde ein Gericht in höchstens 20 Minuten.")
                    Button("Zutat auswählen") {cooking=CookingSession(preset:[],stock:stock)}.buttonStyle(.borderedProminent).frame(minHeight:48)
                }
            }
            PillLayout {
                Button("Essen eintragen") {tab = .food}.buttonStyle(.bordered).frame(minHeight:48)
                Button("Bon erfassen") {receipt=true}.buttonStyle(.bordered).frame(minHeight:48)
                Button("Rezepte finden") {tab = .recipes}.buttonStyle(.bordered).frame(minHeight:48)
            }
            HStack {Text("Dein Überblick").font(.title2.bold());Spacer();Button(editDashboard ? "Fertig" : "Anpassen") {editDashboard.toggle()}.frame(minHeight:48)}
            if editDashboard { JournalPanel {Toggle("Wasser",isOn:$showWater);Toggle("Ernährung",isOn:$showNutrition);Toggle("Bewegung",isOn:$showMovement);Text("Ändert nur deine Übersicht. Gespeicherte Daten bleiben erhalten.").font(.footnote)} }
            if wellness.enabled {
                LazyVGrid(columns:[GridItem(.adaptive(minimum:140),spacing:12)],alignment:.leading,spacing:12) {
                    if showWater { waterTile }
                    if showNutrition { nutritionTile }
                }
                if showMovement { JournalPanel(tint:Palette.movement) {
                    Text("Bewegung").font(.headline)
                    Text("\(todayMotion.steps.map(String.init) ?? "–") Schritte · \(todayMotion.floors.map(String.init) ?? "–") Etagen").font(.title2.bold()).contentTransition(.numericText())
                    Text(todayMotion.message).font(.footnote)
                    Button("Verbinden / aktualisieren") {todayMotion.read()}.frame(minHeight:48)
                } }
            } else { JournalPanel(tint:Palette.nutrition) {Text("Essen, Wasser & Bewegung").font(.headline);Text("Dein freiwilliges Journal bleibt auf dem Gerät. Kochen funktioniert sofort.");Button("Journal entdecken") {tab = .food}.frame(minHeight:48)} }
            ViewThatFits(in:.horizontal) {HStack(spacing:12){stockMetric;historyMetric};VStack(spacing:12){stockMetric;historyMetric}}
            JournalPanel {Button("Plan & Einkauf öffnen") {more="plan";tab = .more}.frame(minHeight:48);Text("Dein Überblick zeigt Einträge und verbundene Daten, keine Bewertung deines Körpers oder Tagesbedarfs.").font(.footnote)}
        }
    }
    private var waterTile: some View {
        JournalPanel(tint:Palette.water) {
            Text("Wasser").font(.headline)
            Text("\(wellness.data.drinks.filter {$0.day==JournalDates.key(.now) && $0.kind=="water"}.reduce(0) {$0+$1.ml}) ml").font(.title.bold()).contentTransition(.numericText())
            Text("Heute protokolliert").font(.footnote)
            Button("+ 250 ml") {wellness.update {$0.drinks.append(WaterEntry(id:UUID().uuidString,kind:"water",ml:250,caffeineMg:0,day:JournalDates.key(.now),at:ISO8601DateFormatter().string(from:.now),name:"Wasser"))}}.frame(minHeight:48)
        }
    }
    private var nutritionTile: some View {
        let entries=wellness.data.food.filter {$0.day==JournalDates.key(.now)}
        return JournalPanel(tint:Palette.nutrition) {
            Text("Ernährung").font(.headline)
            if wellness.adult && !entries.isEmpty {Text("\(entries.reduce(0.0) {sum,e in sum+(wellness.foods.first {$0.id==e.foodId}?.per100g.energyKcal ?? 0)*e.grams/100},specifier:"%.0f") kcal").font(.title.bold())}
            Text("\(entries.count) bestätigte Einträge").font(.footnote)
            Button("Essen eintragen") {tab = .food}.frame(minHeight:48)
        }
    }

    private var stockMetric: some View {
        metric("Vorrat", value: stock.count, detail: "Zutaten", icon: "basket", tint: Palette.kitchen) { tab = .stock }
    }

    private var historyMetric: some View {
        metric("Gekocht", value: journal.days().reduce(0) { $0 + $1.count }, detail: "letzte 7 Tage", icon: "chart.bar", tint: Palette.trend) { more = "history"; tab = .more }
    }

    private func metric(_ title: String, value: Int, detail: String, icon: String, tint: Color, open: @escaping () -> Void) -> some View {
        Button(action: open) {
            JournalPanel(tint: tint) {
                Label(title, systemImage: icon).font(.subheadline.weight(.semibold))
                Text("\(value)").font(.largeTitle.bold()).monospacedDigit()
                Text(detail).font(.footnote).foregroundStyle(Color.primary.opacity(0.7))
            }
        }.buttonStyle(.plain).accessibilityElement(children: .combine)
    }

    private func suggestion(_ recipe: Recipe?) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text("Aus Vorrat kochen").font(.title2.bold()).accessibilityAddTraits(.isHeader)
            Text(recipe.map { "\($0.name) · \($0.minutes) Min." } ?? "Wähle eine Zutat und finde ein Gericht für heute.")
                .font(.subheadline).foregroundStyle(Color.primary.opacity(0.7))
        }.frame(maxWidth: .infinity, alignment: .leading)
    }

    private func readyCount(_ count: Int) -> some View {
        VStack(spacing: 1) {
            Text("\(count)").font(.title.bold()).monospacedDigit()
            Text("passend").font(.caption).foregroundStyle(Color.primary.opacity(0.7))
        }
        .padding(12).background(Color.mint.opacity(0.13), in: .capsule)
        .accessibilityElement(children: .ignore).accessibilityLabel("\(count) passende Rezepte")
    }

    private var pantry: some View {
        VStack(alignment: .leading, spacing: 13) {
            Text("Hier steht, was du zu Hause hast.").foregroundStyle(Color.primary.opacity(0.7))
            Button { receipt = true } label: { Label("Bon erfassen", systemImage: "document.viewfinder").frame(maxWidth: .infinity, minHeight: 44) }
                .buttonStyle(.borderedProminent).buttonBorderShape(.capsule)
            JournalPanel {
                Text("Zutat hinzufügen").font(.headline)
                IngredientLookup(catalog: catalog, excluded: stock) { id in update { $0.add([id]) } }
            }
            JournalPanel {
                Text("Im Vorrat · \(stock.count)").font(.headline)
                if stock.isEmpty { Text("Füge Zutaten einzeln oder über einen Bon hinzu.").foregroundStyle(Color.primary.opacity(0.7)) }
                ForEach(stock.sorted { catalog.name($0).localizedCompare(catalog.name($1)) == .orderedAscending }, id: \.self) { id in
                    Divider()
                    HStack {
                        VStack(alignment: .leading, spacing: 5) {
                            Text(catalog.name(id))
                            StockDate(id: id, journal: journal, update: update)
                        }; Spacer()
                        Button { update { $0.stock.removeAll { $0 == id } } } label: {
                            Label("\(catalog.name(id)) aus Vorrat entfernen", systemImage: "xmark.circle").labelStyle(.iconOnly)
                                .frame(minWidth: 44, minHeight: 44)
                        }.buttonStyle(.plain).foregroundStyle(Color.primary.opacity(0.7))
                    }
                }
            }
        }
    }

    private var history: some View {
        let state = journal
        let days = state.days()
        let total = days.reduce(0) { $0 + $1.count }
        let dates = Set(days.map(\.date))
        let variety = Set(state.meals.filter { dates.contains(Calendar.current.startOfDay(for: $0.date)) }.flatMap { $0.ingredients ?? [] })
            .subtracting(catalog.pantry).count
        return VStack(alignment: .leading, spacing: 13) {
            JournalPanel(tint: Palette.trend) {
                Text("Gerichte · letzte 7 Tage").font(.headline)
                Text("\(total)").font(.largeTitle.bold()).monospacedDigit()
                if total == 0 {
                    Text("Nach dem Kochen kannst du dein Gericht hier eintragen.").foregroundStyle(Color.primary.opacity(0.7))
                } else {
                    Chart(days) { day in
                        BarMark(x: .value("Tag", day.date, unit: .day), y: .value("Gerichte", day.count))
                            .foregroundStyle(Color.purple.gradient).cornerRadius(4)
                    }.chartXAxis { AxisMarks(values: days.map(\.date)) { _ in AxisValueLabel(format: .dateTime.weekday(.abbreviated)) } }
                        .chartYAxis(.hidden).frame(height: 112)
                }
            }
            if total > 0 { JournalPanel(tint: Palette.water) {
                Text("Zutatenvielfalt · letzte 7 Tage").font(.headline)
                Text("\(variety)").font(.largeTitle.bold()).monospacedDigit()
                Text("Verschiedene Zutaten in deinen eingetragenen Rezepten, ohne Grundzutaten.").foregroundStyle(Color.primary.opacity(0.7))
            } }
            if !state.meals.isEmpty { JournalPanel {
                Text("Deine Gerichte").font(.headline)
                ForEach(state.meals) { meal in
                    Divider()
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(meal.name).font(.subheadline.weight(.semibold))
                            Text(meal.date.formatted(.dateTime.locale(Locale(identifier: "de_DE")).weekday(.wide).day().month(.wide)))
                                .font(.footnote).foregroundStyle(Color.primary.opacity(0.7))
                        }
                        Spacer()
                        Button { removal = meal } label: {
                            Label("\(meal.name) aus Verlauf entfernen", systemImage: "trash").labelStyle(.iconOnly)
                                .frame(minWidth: 44, minHeight: 44)
                        }.buttonStyle(.plain).foregroundStyle(Color.primary.opacity(0.7))
                    }
                }
            } }
        }.confirmationDialog("Eintrag entfernen?", isPresented: Binding(get: { removal != nil }, set: { if !$0 { removal = nil } }), presenting: removal) { meal in
            Button("Entfernen", role: .destructive) { update { $0.meals.removeAll { $0.id == meal.id } }; removal = nil }
            Button("Abbrechen", role: .cancel) { removal = nil }
        } message: { meal in Text(meal.name) }
    }

    @ViewBuilder private var moreContent: some View {
        if more != "menu" { Button("Zurück zu Mehr") { more = "menu" }.frame(minHeight: 48) }
        switch more {
        case "plan":
            WeeklyPlanner(catalog: catalog, journal: journal, open: { detail = $0 }, select: { plannedDay = $0; tab = .recipes }, update: update)
            if !wellness.data.shoppingText.isEmpty { JournalPanel { Text("Eigene Einkaufszutaten").font(.headline); ForEach(wellness.data.shoppingText, id: \.self) { text in Button("Erledigt: \(text)") { wellness.update { $0.shoppingText.removeAll { $0 == text } } }.frame(minHeight: 48) } } }
        case "history": history
        case "insights": ComfortView(catalog: catalog, store: wellness, journal: journal, update: update, planning: false)
        case "autoplan": ComfortView(catalog: catalog, store: wellness, journal: journal, update: update, planning: true)
        case "privacy": WellnessPrivacy(store: wellness)
        case "social": SocialRecipesView(catalog: catalog, store: wellness, journal: journal, update: update)
        case "plus": JournalPanel(tint: Palette.trend) { Text("Zuerst Plus").font(.title2.bold()); Text("30/90-Tage-Vergleiche, automatische Planung für bis zu vier Wochen, Vorlagen und gemeinsamer Einkauf. Gratisfunktionen bleiben ohne Konto nutzbar."); Text("1 € monatlich · 5 € jährlich · 10 € einmalig für die Laufzeit des Produkts. Alle Varianten haben dieselben Funktionen. Keine kostenpflichtige Cloud-KI."); Text("Plus-Vorschau · native Käufe noch nicht erhältlich. Eigene Käufe ab 18. Für die App-Store-Veröffentlichung wird eine Store-Zahlungsanbindung benötigt.") }
        default:
            JournalPanel(tint: Palette.kitchen) { Button("Plan & Einkauf") { more = "plan" }.frame(minHeight: 48); Button("Rezept importieren") { more = "social" }.frame(minHeight: 48) }
            JournalPanel(tint: Palette.trend) { Button("Automatisch planen") { more = "autoplan" }.frame(minHeight: 48); Button("Auswertungen") { more = "insights" }.frame(minHeight: 48); Button("Kochverlauf") { more = "history" }.frame(minHeight: 48); Button("Zuerst Plus") { more = "plus" }.frame(minHeight: 48) }
            JournalPanel(tint: Palette.water) { Button("Darstellung & Datenschutz") { more = "privacy" }.frame(minHeight: 48) }
        }
    }

    private func update(_ change: (inout KitchenJournal) -> Void) {
        var state = journal
        change(&state)
        if let encoded = try? JSONEncoder().encode(state) { saved = encoded }
    }
}

struct JournalPanel<Content: View>: View {
    var tint: Color = Palette.card
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 9, content: content)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(17)
            .foregroundStyle(Palette.foreground(tint))
            .background {
                RoundedRectangle(cornerRadius: 25).fill(tint)
            }
    }
}

struct IngredientLookup: View {
    let catalog: Catalog
    let excluded: [String]
    let add: (String) -> Void
    @State private var query = ""

    var body: some View {
        TextField("Zutat suchen", text: $query).textFieldStyle(.roundedBorder).frame(minHeight: 44)
        if !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            let ids = catalog.search(query).filter { !excluded.contains($0) }.prefix(8)
            if ids.isEmpty { Text("Keine weitere passende Zutat gefunden.").font(.footnote).foregroundStyle(Color.primary.opacity(0.7)) }
            ForEach(Array(ids), id: \.self) { id in
                Button { add(id); query = "" } label: { Label(catalog.name(id), systemImage: "plus").frame(minHeight: 44) }
                    .buttonStyle(.plain)
            }
        }
    }
}
