import SwiftUI

struct RecipeLibrary: View {
    let catalog: Catalog
    let journal: KitchenJournal
    let open: (Recipe) -> Void
    let update: ((inout KitchenJournal) -> Void) -> Void
    var importRecipe: () -> Void = {}
    @State private var query = ""
    @State private var filter = 0
    @AppStorage("zuerst-taste") private var tasteJSON = "{}"
    @State private var editing = false
    @State private var avoidQuery = ""
    @State private var limit = 30
    private var taste: [String:Any] { ((tasteJSON.data(using: .utf8)).flatMap { try? JSONSerialization.jsonObject(with: $0) } as? [String:Any]) ?? [:] }
    private func ids(_ key: String) -> [String] { taste[key] as? [String] ?? [] }
    private func option(_ key: String, _ value: Any) { var next = taste; next[key] = value; if let data = try? JSONSerialization.data(withJSONObject: next), let text = String(data: data, encoding: .utf8) { tasteJSON = text }; limit = 30 }
    private func suits(_ recipe: Recipe) -> Bool {
        let mode = recipe.mode ?? (["kaesetoast","arme-ritter","paprika-quesadilla","bananen-pancakes","kartoffel-roesti"].contains(recipe.id) ? "comfort" : "balanced")
        return !recipe.items.contains { ids("avoids").contains($0.id) } && ((taste["diet"] as? String) != "vegetarian" || !recipe.items.contains { $0.id == "tuna" }) && ((taste["mode"] as? String ?? "all") == "all" || mode == (taste["mode"] as? String))
    }
    private func score(_ recipe: Recipe) -> Int { recipe.items.filter { ids("likes").contains($0.id) }.count * 10 + recipe.items.filter { journal.stock.contains($0.id) }.count }
    private let filters = ["Alle", "Gemerkt", "Aus Vorrat", "Vegetarisch", "Bis 10 Min."]
    private var matches: [Recipe] {
        catalog.recipes.filter { recipe in
            let search = query.trimmingCharacters(in: .whitespacesAndNewlines)
            let matchesQuery = search.isEmpty || recipe.name.localizedCaseInsensitiveContains(search) || recipe.items.contains { catalog.name($0.id).localizedCaseInsensitiveContains(search) }
            let matchesFilter: Bool
            switch filter {
            case 1: matchesFilter = journal.favorites.contains(recipe.id)
            case 2: matchesFilter = journal.missing(recipe).isEmpty
            case 3: matchesFilter = !recipe.items.contains { $0.id == "tuna" }
            case 4: matchesFilter = recipe.minutes <= 10
            default: matchesFilter = true
            }
            return matchesQuery && matchesFilter && suits(recipe)
        }.sorted { a,b in
            if score(a) != score(b) { return score(a)>score(b) }
            let aMeal=["Frühstück","Desserts"].contains(a.category ?? "") ? 1 : 0
            let bMeal=["Frühstück","Desserts"].contains(b.category ?? "") ? 1 : 0
            if aMeal != bMeal { return aMeal<bMeal }
            if a.minutes != b.minutes { return a.minutes<b.minutes }
            return a.name<b.name
        }
    }
    var body: some View {
        Text("\(catalog.recipes.count) Ideen. Zwei Portionen. Höchstens 20 Minuten.").foregroundStyle(Color.primary.opacity(0.7))
        Button("Instagram-Rezepte entdecken & importieren",action:importRecipe).buttonStyle(.bordered).frame(minHeight:48)
        tastePicker
        TextField("Gericht oder Zutat suchen", text: $query).textFieldStyle(.roundedBorder).frame(minHeight: 44)
        PillLayout {
            ForEach(filters.indices, id: \.self) { index in
                Button { filter = index } label: { Text(filters[index]).padding(.horizontal, 17).frame(minHeight: 48).background(filter == index ? Palette.action : Palette.trend, in: .capsule).foregroundStyle(filter == index ? Palette.onAction : Palette.onTrend) }
                    .buttonStyle(.plain).accessibilityAddTraits(filter == index ? .isSelected : [])
            }
        }
        JournalPanel {
            Text("\(matches.count) Rezepte").font(.headline)
            ForEach(Array(matches.prefix(limit))) { recipe in JournalRecipeRow(recipe: recipe, journal: journal, open: { open(recipe) }, favorite: { update { $0.favorite(recipe.id) } }) }
            if matches.count > limit { Button("Weitere Rezepte zeigen (\(matches.count-limit))") { limit += 30 }.frame(minHeight: 48) }
            if matches.isEmpty { Text(filter == 1 ? "Tippe bei einem Rezept auf das Herz, um es hier zu merken." : "Kein passendes Rezept. Ändere die Suche oder den Filter.").foregroundStyle(Color.primary.opacity(0.7)) }
        }
    }
    private var tastePicker: some View {
        JournalPanel(tint: Palette.kitchen) {
            Text("Dein Geschmack").font(.title2.bold())
            if !(taste["done"] as? Bool ?? false) || editing {
                Text("Was isst du gern? Deine Auswahl sortiert die Rezepte. Jederzeit änderbar, nur auf diesem Gerät.")
                Picker("Ernährungsweise", selection: Binding(get: { taste["diet"] as? String ?? "all" }, set: { option("diet",$0) })) { Text("Alles").tag("all"); Text("Vegetarisch").tag("vegetarian") }.pickerStyle(.menu)
                Picker("Ausrichtung", selection: Binding(get: { taste["mode"] as? String ?? "all" }, set: { option("mode",$0) })) { Text("Beides").tag("all"); Text("Gemüse & Alltag").tag("balanced"); Text("Comfort Food").tag("comfort") }.pickerStyle(.menu)
                Text("Das mag ich").font(.headline)
                PillLayout { ForEach(["pasta","rice","potatoes","chickpeas","tofu","eggs","cheese","mushrooms","broccoli","spinach","paprika","banana"], id: \.self) { id in
                    Button { option("likes",ids("likes").contains(id) ? ids("likes").filter { $0 != id } : ids("likes") + [id]); option("avoids",ids("avoids").filter { $0 != id }) } label: { Text(catalog.name(id)).padding(.horizontal,16).frame(minHeight:48).background(ids("likes").contains(id) ? Palette.action : Palette.trend,in:.capsule).foregroundStyle(ids("likes").contains(id) ? Palette.onAction : Palette.onTrend) }.buttonStyle(.plain).accessibilityAddTraits(ids("likes").contains(id) ? .isSelected : [])
                } }
                TextField("Zutat ausschließen",text:$avoidQuery).textFieldStyle(.roundedBorder).frame(minHeight:48)
                if !avoidQuery.isEmpty { ForEach(Array(catalog.search(avoidQuery).prefix(4)),id:\.self) { id in Button("\(catalog.name(id)) ausschließen") { option("avoids",Array(Set(ids("avoids") + [id]))); option("likes",ids("likes").filter { $0 != id }); avoidQuery="" }.frame(minHeight:48) } }
                ForEach(ids("avoids"),id:\.self) { id in Button("\(catalog.name(id)) wieder erlauben") { option("avoids",ids("avoids").filter { $0 != id }) }.frame(minHeight:48) }
                Text("Filter prüfen Zutatenbezeichnungen, keine Etiketten oder Spuren. Bei Allergien jede Zutat prüfen.").font(.footnote)
                Button("Meine Rezepte zeigen") { option("done",true); editing=false }.buttonStyle(.borderedProminent).frame(minHeight:48)
            } else { Text("\(ids("likes").count) Lieblingszutaten · \(ids("avoids").count) ausgeschlossen"); Button("Vorlieben anpassen") { editing=true }.frame(minHeight:48) }
        }
    }
}

struct JournalRecipeRow: View {
    let recipe: Recipe
    let journal: KitchenJournal
    let open: () -> Void
    let favorite: () -> Void
    var body: some View {
        let missing = journal.missing(recipe).count
        HStack(spacing: 8) {
            Button(action: open) {
                HStack(spacing: 10) {
                    VStack(alignment: .leading, spacing: 5) {
                        Text(recipe.name).font(.subheadline.weight(.semibold)).foregroundStyle(.primary)
                        Text("\(recipe.minutes) Min. · \(missing == 0 ? "Alles im Vorrat" : "\(missing) Zutaten fehlen")").font(.footnote).foregroundStyle(Color.primary.opacity(0.7))
                    }.frame(maxWidth: .infinity, alignment: .leading)
                    Image(systemName: "chevron.right").font(.caption).foregroundStyle(.tertiary)
                }.frame(minHeight: 58)
            }.buttonStyle(.plain)
            Button(action: favorite) {
                Label("\(recipe.name) merken", systemImage: journal.favorites.contains(recipe.id) ? "heart.fill" : "heart").labelStyle(.iconOnly).frame(minWidth: 44, minHeight: 44)
            }.buttonStyle(.plain).foregroundStyle(Color.accentColor).accessibilityAddTraits(journal.favorites.contains(recipe.id) ? .isSelected : [])
        }
        Divider()
    }
}

struct WeeklyPlanner: View {
    let catalog: Catalog
    let journal: KitchenJournal
    let open: (Recipe) -> Void
    let select: (Date) -> Void
    let update: ((inout KitchenJournal) -> Void) -> Void
    @State private var shopping = false
    @State private var checked: Set<String> = []
    private var days: [Date] { (0...6).compactMap { Calendar.current.date(byAdding: .day, value: $0, to: .now) } }
    var body: some View {
        Picker("Planungsansicht", selection: $shopping) { Text("Wochenplan").tag(false); Text("Einkauf · \(journal.shopping.count)").tag(true) }.pickerStyle(.segmented)
        if shopping { shoppingList } else { weeklyPlan }
    }
    private var shoppingList: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Abhaken. Einkaufen. In den Vorrat übernehmen.").foregroundStyle(Color.primary.opacity(0.7))
            JournalPanel {
                Text("Auf der Liste").font(.headline)
                IngredientLookup(catalog: catalog, excluded: journal.shopping) { id in update { $0.shopping.append(id) } }
                ForEach(journal.shopping, id: \.self) { id in
                    HStack {
                        Button { if checked.contains(id) { checked.remove(id) } else { checked.insert(id) } } label: {
                            HStack(spacing: 12) { Image(systemName: checked.contains(id) ? "checkmark.circle.fill" : "circle"); Text(catalog.name(id)).foregroundStyle(.primary); Spacer() }.frame(minHeight: 48)
                        }.buttonStyle(.plain).accessibilityAddTraits(checked.contains(id) ? .isSelected : [])
                        Button { update { $0.shopping.removeAll { $0 == id } }; checked.remove(id) } label: { Label("\(catalog.name(id)) von Einkaufsliste entfernen", systemImage: "xmark").labelStyle(.iconOnly).frame(minWidth: 44, minHeight: 44) }.buttonStyle(.plain).foregroundStyle(Color.primary.opacity(0.7))
                    }; Divider()
                }
                if journal.shopping.isEmpty { Text("Deine Liste ist frei. Füge Zutaten hinzu oder übernimm fehlende Zutaten aus einem Rezept.").foregroundStyle(Color.primary.opacity(0.7)) }
            }
            if !checked.isEmpty {
                Button { update { $0.bought(Array(checked)) }; checked = [] } label: { Text("Gekauftes übernehmen · \(checked.count)").frame(maxWidth: .infinity, minHeight: 44) }.buttonStyle(.borderedProminent).buttonBorderShape(.capsule)
            }
        }
    }
    private var weeklyPlan: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Deine nächsten sieben Tage, ganz entspannt.").foregroundStyle(Color.primary.opacity(0.7))
            ForEach(days, id: \.self) { day in
                let key = JournalDates.key(day)
                let recipe = catalog.recipes.first { recipe in journal.plans.contains { $0.day == key && $0.recipeId == recipe.id } }
                JournalPanel {
                    HStack {
                        Text(Calendar.current.isDateInToday(day) ? "Heute" : day.formatted(.dateTime.locale(Locale(identifier: "de_DE")).weekday(.abbreviated).day().month(.abbreviated))).font(.headline)
                        Spacer()
                        if recipe != nil { Button { update { $0.plans.removeAll { $0.day == key } } } label: { Label("Plan für \(key) entfernen", systemImage: "xmark").labelStyle(.iconOnly).frame(minWidth: 44, minHeight: 44) }.buttonStyle(.plain).foregroundStyle(Color.primary.opacity(0.7)) }
                    }
                    if let recipe {
                        JournalRecipeRow(recipe: recipe, journal: journal, open: { open(recipe) }, favorite: { update { $0.favorite(recipe.id) } })
                        Button("Fehlendes einkaufen") { update { $0.buyMissing(recipe) }; shopping = true }.frame(minHeight: 44)
                    } else { Button { select(day) } label: { Label("Gericht auswählen", systemImage: "plus").frame(minHeight: 44) } }
                }
            }
            Button {
                let keys = Set(days.map(JournalDates.key))
                update { state in for plan in state.plans where keys.contains(plan.day) { if let recipe = catalog.recipes.first(where: { $0.id == plan.recipeId }) { state.buyMissing(recipe) } } }
                shopping = true
            } label: { Text("Wocheneinkauf erstellen").frame(maxWidth: .infinity, minHeight: 44) }.buttonStyle(.borderedProminent).buttonBorderShape(.capsule).disabled(!journal.plans.contains { plan in days.contains { JournalDates.key($0) == plan.day } })
            Text("Die Liste bündelt Zutaten. Die benötigten Mengen findest du in den Rezepten.").font(.footnote).foregroundStyle(Color.primary.opacity(0.7))
        }
    }
}

struct StockDate: View {
    let id: String
    let journal: KitchenJournal
    let update: ((inout KitchenJournal) -> Void) -> Void
    @State private var show = false
    @State private var date = Date.now
    var body: some View {
        Button { date = journal.expiry[id].flatMap(JournalDates.parse) ?? .now; show = true } label: { Text(journal.expiry[id].map { "Aufbrauchen bis \($0)" } ?? "Aufbrauchdatum ergänzen").font(.footnote).frame(minHeight: 44) }
            .buttonStyle(.plain).foregroundStyle(Color.accentColor)
            .sheet(isPresented: $show) {
                NavigationStack {
                    Form { DatePicker("Aufbrauchen bis", selection: $date, displayedComponents: .date).datePickerStyle(.graphical)
                        Button("Datum entfernen", role: .destructive) { update { $0.expiry.removeValue(forKey: id) }; show = false }
                    }.navigationTitle("Aufbrauchdatum").navigationBarTitleDisplayMode(.inline)
                        .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Abbrechen") { show = false } }; ToolbarItem(placement: .confirmationAction) { Button("Übernehmen") { update { $0.expiry[id] = JournalDates.key(date) }; show = false } } }
                }.presentationDetents([.medium, .large])
            }
    }
}

struct RecipePage: View {
    let catalog: Catalog
    let recipe: Recipe
    let journal: KitchenJournal
    let initialDay: Date
    let update: ((inout KitchenJournal) -> Void) -> Void
    let onCooked: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var cooking = false
    @State private var date = Date.now
    @State private var notice = ""
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 17) {
                    Text(recipe.name).font(.largeTitle.bold()).accessibilityAddTraits(.isHeader)
                    Text("\(recipe.minutes) Min. · 2 Portionen").foregroundStyle(Color.primary.opacity(0.7))
                    Text(recipe.note)
                    JournalPanel {
                        Text("Das brauchst du").font(.title2.bold())
                        ForEach(recipe.items) { item in HStack { Text(catalog.name(item.id)); Spacer(); if journal.stock.contains(item.id) { Image(systemName: "checkmark").accessibilityLabel("Im Vorrat").foregroundStyle(Color.accentColor) }; Text(item.amount).foregroundStyle(Color.primary.opacity(0.7)) }.padding(.vertical, 4) }
                    }
                    if cooking {
                        JournalPanel {
                            Text("So geht’s").font(.title2.bold())
                            ForEach(recipe.steps.indices, id: \.self) { index in HStack(alignment: .top, spacing: 14) { Text("\(index + 1)").font(.headline).foregroundStyle(Color.accentColor); Text(recipe.steps[index]).frame(maxWidth: .infinity, alignment: .leading) }.padding(.vertical, 5) }
                        }
                        Button(action: onCooked) { Text("Gekocht eintragen").frame(maxWidth: .infinity, minHeight: 44) }.buttonStyle(.borderedProminent).buttonBorderShape(.capsule)
                    } else { actions }
                    if !notice.isEmpty { Text(notice).font(.subheadline).foregroundStyle(Color.accentColor).accessibilityAddTraits(.updatesFrequently) }
                }.frame(maxWidth: 600).padding(20).frame(maxWidth: .infinity)
            }.background(Color(uiColor: .systemGroupedBackground)).navigationTitle("Rezept").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Fertig") { dismiss() } } }
        }.onAppear { date = initialDay }
    }
    private var actions: some View {
        VStack(alignment: .leading, spacing: 14) {
            let missing = journal.missing(recipe)
            if missing.isEmpty { Button { cooking = true } label: { Text("Jetzt kochen").frame(maxWidth: .infinity, minHeight: 44) }.buttonStyle(.borderedProminent).buttonBorderShape(.capsule) }
            else {
                Text("Noch nicht im Vorrat: \(missing.map(catalog.name).joined(separator: ", ")).").foregroundStyle(Color.primary.opacity(0.7))
                Button { update { $0.buyMissing(recipe) }; notice = "Fehlende Zutaten ergänzt. Du findest sie unter Plan → Einkauf." } label: { Text("Fehlendes auf die Liste").frame(maxWidth: .infinity, minHeight: 44) }.buttonStyle(.borderedProminent).buttonBorderShape(.capsule)
            }
            JournalPanel {
                DatePicker("Für welchen Tag?", selection: $date, in: Calendar.current.startOfDay(for: .now)..., displayedComponents: .date)
                Button("Einplanen") { update { $0.plan(recipe, day: date) }; notice = "Gericht eingeplant." }.controlSize(.large).buttonStyle(.bordered).buttonBorderShape(.capsule)
            }
            Button { update { $0.favorite(recipe.id) } } label: { Label(journal.favorites.contains(recipe.id) ? "Gemerkt" : "Rezept merken", systemImage: journal.favorites.contains(recipe.id) ? "heart.fill" : "heart").frame(minHeight: 44) }
        }
    }
}
