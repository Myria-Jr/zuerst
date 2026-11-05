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
    @State private var tab = Tab.today
    @State private var receipt = false
    @State private var about = false
    @State private var detail: Recipe?
    @State private var plannedDay = Date.now
    @State private var cooking: CookingSession?
    @State private var removal: MealEntry?

    private enum Tab: Hashable { case today, recipes, stock, plan, history }
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
            page("Rezepte") { RecipeLibrary(catalog: catalog, journal: journal, open: { detail = $0 }, update: update) }
                .tabItem { Label("Rezepte", systemImage: "book") }.tag(Tab.recipes)
            page("Vorrat") { pantry }
                .tabItem { Label("Vorrat", systemImage: "basket") }.tag(Tab.stock)
            page("Plan") { WeeklyPlanner(catalog: catalog, journal: journal, open: { detail = $0 }, select: { plannedDay = $0; tab = .recipes }, update: update) }
                .tabItem { Label("Plan", systemImage: "calendar") }.tag(Tab.plan)
            page("Verlauf") { history }
                .tabItem { Label("Verlauf", systemImage: "chart.bar.xaxis") }.tag(Tab.history)
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
                detail = nil; tab = .history
            }
        }
        .fullScreenCover(item: $cooking) { session in
            Kitchen(catalog: catalog, preset: session.preset, stock: session.stock, onClose: { cooking = nil }) { recipe in
                guard cooking?.id == session.id else { return }
                update { $0.meals.insert(MealEntry(name: recipe.name, date: .now, ingredients: recipe.items.map(\.id)), at: 0) }
                tab = .history
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
            .background(Color(uiColor: .systemGroupedBackground))
            .navigationTitle(title)
            .toolbar { ToolbarItem(placement: .topBarTrailing) {
                Button { about = true } label: { Label("Profil und Sicherung", systemImage: "person.crop.circle").labelStyle(.iconOnly) }
            } }
        }
    }

    private var today: some View {
        let ready = catalog.ready(stock: stock)
        return VStack(alignment: .leading, spacing: 13) {
            Text(Date.now.formatted(.dateTime.locale(Locale(identifier: "de_DE")).weekday(.wide).day().month(.wide)))
                .font(.subheadline.weight(.medium)).foregroundStyle(.secondary)
            if !journal.name.isEmpty { Text("Hallo, \(journal.name)").font(.title2.bold()) }
            JournalPanel(tint: .mint) {
                ViewThatFits(in: .horizontal) {
                    HStack(alignment: .center, spacing: 18) { suggestion(ready.first); readyCount(ready.count) }
                    VStack(alignment: .leading, spacing: 10) { suggestion(ready.first); readyCount(ready.count) }
                }
                Button {
                    let preset = ready.first?.items.map(\.id).filter { !catalog.pantry.contains($0) } ?? []
                    cooking = CookingSession(preset: Array(preset.prefix(3)), stock: stock)
                } label: {
                    Label("Kochen starten", systemImage: "fork.knife").frame(maxWidth: .infinity, minHeight: 44)
                }.buttonStyle(.borderedProminent).buttonBorderShape(.capsule)
            }
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .top, spacing: 9) { stockMetric; historyMetric }
                VStack(spacing: 9) { stockMetric; historyMetric }
            }
            let soon = stock.filter { journal.expiry[$0].map { $0 <= JournalDates.key(Calendar.current.date(byAdding: .day, value: 2, to: .now)!) } ?? false }
            if !soon.isEmpty { JournalPanel(tint: .orange) {
                Text("Zuerst aufbrauchen").font(.headline)
                ForEach(soon, id: \.self) { id in Text("\(catalog.name(id)) · \(journal.expiry[id] ?? "")") }
                Text("Nach deinen eingetragenen Daten. Prüfe Lebensmittel vor dem Verwenden.").font(.footnote).foregroundStyle(.secondary)
            } }
            JournalPanel {
                Label("Heute auf dem Plan", systemImage: "calendar").font(.headline)
                let planned = catalog.recipes.first { recipe in journal.plans.contains { $0.day == JournalDates.key(.now) && $0.recipeId == recipe.id } }
                if let planned { Button(planned.name) { detail = planned }.buttonStyle(.plain) }
                else { Text("Ein kleiner Plan macht den nächsten Einkauf leichter.").foregroundStyle(.secondary) }
                Button("Plan ansehen") { tab = .plan }.buttonStyle(.bordered).buttonBorderShape(.capsule).controlSize(.large)
            }
            JournalPanel(tint: .indigo) {
                Label("Vom Einkauf in den Vorrat", systemImage: "receipt").font(.headline)
                Text("Fotografiere einen Kassenbon und prüfe die erkannten Zutaten.").foregroundStyle(.secondary)
                Button("Bon erfassen") { receipt = true }
                    .buttonStyle(.bordered).buttonBorderShape(.capsule).controlSize(.large)
            }
        }
    }

    private var stockMetric: some View {
        metric("Vorrat", value: stock.count, detail: "Zutaten", icon: "basket", tint: .cyan) { tab = .stock }
    }

    private var historyMetric: some View {
        metric("Gekocht", value: journal.days().reduce(0) { $0 + $1.count }, detail: "letzte 7 Tage", icon: "chart.bar", tint: .purple) { tab = .history }
    }

    private func metric(_ title: String, value: Int, detail: String, icon: String, tint: Color, open: @escaping () -> Void) -> some View {
        Button(action: open) {
            JournalPanel(tint: tint) {
                Label(title, systemImage: icon).font(.subheadline.weight(.semibold))
                Text("\(value)").font(.largeTitle.bold()).monospacedDigit()
                Text(detail).font(.footnote).foregroundStyle(.secondary)
            }
        }.buttonStyle(.plain).accessibilityElement(children: .combine)
    }

    private func suggestion(_ recipe: Recipe?) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text("Aus Vorrat kochen").font(.title2.bold()).accessibilityAddTraits(.isHeader)
            Text(recipe.map { "\($0.name) · \($0.minutes) Min." } ?? "Wähle eine Zutat und finde ein Gericht für heute.")
                .font(.subheadline).foregroundStyle(.secondary)
        }.frame(maxWidth: .infinity, alignment: .leading)
    }

    private func readyCount(_ count: Int) -> some View {
        VStack(spacing: 1) {
            Text("\(count)").font(.title.bold()).monospacedDigit()
            Text("passend").font(.caption).foregroundStyle(.secondary)
        }
        .padding(12).background(Color.mint.opacity(0.13), in: .capsule)
        .accessibilityElement(children: .ignore).accessibilityLabel("\(count) passende Rezepte")
    }

    private var pantry: some View {
        VStack(alignment: .leading, spacing: 13) {
            Text("Hier steht, was du zu Hause hast.").foregroundStyle(.secondary)
            Button { receipt = true } label: { Label("Bon erfassen", systemImage: "document.viewfinder").frame(maxWidth: .infinity, minHeight: 44) }
                .buttonStyle(.borderedProminent).buttonBorderShape(.capsule)
            JournalPanel {
                Text("Zutat hinzufügen").font(.headline)
                IngredientLookup(catalog: catalog, excluded: stock) { id in update { $0.add([id]) } }
            }
            JournalPanel {
                Text("Im Vorrat · \(stock.count)").font(.headline)
                if stock.isEmpty { Text("Füge Zutaten einzeln oder über einen Bon hinzu.").foregroundStyle(.secondary) }
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
                        }.buttonStyle(.plain).foregroundStyle(.secondary)
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
            JournalPanel(tint: .purple) {
                Text("Gerichte · letzte 7 Tage").font(.headline)
                Text("\(total)").font(.largeTitle.bold()).monospacedDigit()
                if total == 0 {
                    Text("Nach dem Kochen kannst du dein Gericht hier eintragen.").foregroundStyle(.secondary)
                } else {
                    Chart(days) { day in
                        BarMark(x: .value("Tag", day.date, unit: .day), y: .value("Gerichte", day.count))
                            .foregroundStyle(Color.purple.gradient).cornerRadius(4)
                    }.chartXAxis { AxisMarks(values: days.map(\.date)) { _ in AxisValueLabel(format: .dateTime.weekday(.abbreviated)) } }
                        .chartYAxis(.hidden).frame(height: 112)
                }
            }
            if total > 0 { JournalPanel(tint: .teal) {
                Text("Zutatenvielfalt · letzte 7 Tage").font(.headline)
                Text("\(variety)").font(.largeTitle.bold()).monospacedDigit()
                Text("Verschiedene Zutaten in deinen eingetragenen Rezepten, ohne Grundzutaten.").foregroundStyle(.secondary)
            } }
            if !state.meals.isEmpty { JournalPanel {
                Text("Deine Gerichte").font(.headline)
                ForEach(state.meals) { meal in
                    Divider()
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(meal.name).font(.subheadline.weight(.semibold))
                            Text(meal.date.formatted(.dateTime.locale(Locale(identifier: "de_DE")).weekday(.wide).day().month(.wide)))
                                .font(.footnote).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Button { removal = meal } label: {
                            Label("\(meal.name) aus Verlauf entfernen", systemImage: "trash").labelStyle(.iconOnly)
                                .frame(minWidth: 44, minHeight: 44)
                        }.buttonStyle(.plain).foregroundStyle(.secondary)
                    }
                }
            } }
        }.confirmationDialog("Eintrag entfernen?", isPresented: Binding(get: { removal != nil }, set: { if !$0 { removal = nil } }), presenting: removal) { meal in
            Button("Entfernen", role: .destructive) { update { $0.meals.removeAll { $0.id == meal.id } }; removal = nil }
            Button("Abbrechen", role: .cancel) { removal = nil }
        } message: { meal in Text(meal.name) }
    }

    private func update(_ change: (inout KitchenJournal) -> Void) {
        var state = journal
        change(&state)
        if let encoded = try? JSONEncoder().encode(state) { saved = encoded }
    }
}

struct JournalPanel<Content: View>: View {
    var tint: Color = .clear
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 9, content: content)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(17)
            .background {
                RoundedRectangle(cornerRadius: 25).fill(Color(uiColor: .secondarySystemGroupedBackground))
                    .overlay { RoundedRectangle(cornerRadius: 25).fill(tint.opacity(0.11)) }
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
            if ids.isEmpty { Text("Keine weitere passende Zutat gefunden.").font(.footnote).foregroundStyle(.secondary) }
            ForEach(Array(ids), id: \.self) { id in
                Button { add(id); query = "" } label: { Label(catalog.name(id), systemImage: "plus").frame(minHeight: 44) }
                    .buttonStyle(.plain)
            }
        }
    }
}
