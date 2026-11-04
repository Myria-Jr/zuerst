import SwiftUI
import Charts

struct MealEntry: Codable, Identifiable {
    var id = UUID()
    let name: String
    let date: Date
    var ingredients: [String]?
}

struct KitchenJournal: Codable {
    var stock: [String] = []
    var meals: [MealEntry] = []

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
    @State private var cooking: CookingSession?
    @State private var removal: MealEntry?

    private enum Tab: Hashable { case today, stock, history }
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
            page("Vorrat") { pantry }
                .tabItem { Label("Vorrat", systemImage: "basket") }.tag(Tab.stock)
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
            NavigationStack {
                List {
                    Text("Dein Küchenjournal für Vorrat und selbst gekochte Gerichte. Bonfotos werden auf diesem Gerät gelesen. Gespeichert werden deine bestätigten Zutaten und Gerichte.")
                    Text("Eine Marke von Odkaz Labs.").foregroundStyle(.secondary)
                }
                .navigationTitle("Über Zuerst")
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Fertig") { about = false } } }
            }.presentationDetents([.medium, .large])
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
                Button { about = true } label: { Label("Über Zuerst", systemImage: "info.circle").labelStyle(.iconOnly) }
            } }
        }
    }

    private var today: some View {
        let ready = catalog.ready(stock: stock)
        return VStack(alignment: .leading, spacing: 13) {
            Text(Date.now.formatted(.dateTime.locale(Locale(identifier: "de_DE")).weekday(.wide).day().month(.wide)))
                .font(.subheadline.weight(.medium)).foregroundStyle(.secondary)
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
                        Text(catalog.name(id)); Spacer()
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
