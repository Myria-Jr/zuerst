import SwiftUI
import Combine
import PhotosUI
import Vision
import CoreMotion
import UniformTypeIdentifiers

struct FoodValues: Codable { let energyKcal: Double?; let proteinG: Double?; let carbohydrateG: Double?; let fatG: Double? }
struct FoodItem: Codable, Identifiable { let id: String; let name: String; let aliases: [String]; let vision: [String]; let per100g: FoodValues; let fdcId: Int }
struct FoodDataset: Codable { let foods: [FoodItem] }
struct WellnessProfile: Codable { let age: Int; let consentAt: String; let policyVersion: String }
struct FoodEntry: Codable, Identifiable { let id: String; let foodId: String; let grams: Double; let day: String; let at: String; let source: String }
struct WaterEntry: Codable, Identifiable { let id: String; let kind: String; let ml: Int; let caffeineMg: Double; let day: String; let at: String; let name: String }
struct SocialIngredient: Codable { let name: String; var ingredientId: String? }
struct SocialRecipe: Codable, Identifiable { let id: String; let title: String; let url: String; let mode: String; var ingredients: [SocialIngredient]; let steps: [String]; let savedAt: String }
struct WellnessTemplate: Codable, Identifiable { let id: String; let name: String; let recipeIds: [String] }
struct WellnessData: Codable { var version = 1; var profile: WellnessProfile?; var food: [FoodEntry] = []; var drinks: [WaterEntry] = []; var imports: [SocialRecipe] = []; var shoppingText: [String] = []; var favoriteFoods: [String] = []; var templates: [WellnessTemplate]? = [] }

@MainActor final class WellnessStore: ObservableObject {
    @Published var data = WellnessData()
    @Published var message = ""
    @Published var readable = true
    let foods: [FoodItem]
    private let file: URL
    var enabled: Bool { (data.profile?.age ?? 0) >= 16 && data.profile?.policyVersion == "2026-11-05.1" }
    var adult: Bool { enabled && (data.profile?.age ?? 0) >= 18 }
    init() {
        foods = Bundle.main.url(forResource: "foods", withExtension: "json").flatMap { try? Data(contentsOf: $0) }.flatMap { try? JSONDecoder().decode(FoodDataset.self, from: $0) }?.foods ?? []
        let directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        file = directory.appendingPathComponent("wellness.json")
        do { try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            if FileManager.default.fileExists(atPath: file.path) { data = try JSONDecoder().decode(WellnessData.self, from: Data(contentsOf: file)); guard data.version == 1 else { throw CocoaError(.fileReadCorruptFile) } }
        } catch { readable = false; message = "Das lokale Journal konnte nicht gelesen werden. Originaldaten bleiben erhalten." }
    }
    func update(_ change: (inout WellnessData) -> Void) {
        guard readable else { return }; var next = data; change(&next)
        do { try JSONEncoder().encode(next).write(to: file, options: [.atomic, .completeFileProtection]); var values = URLResourceValues(); values.isExcludedFromBackup = true; var target = file; try target.setResourceValues(values); data = next }
        catch { message = "Journal konnte nicht sicher gespeichert werden. Bitte Speicher und Gerätesperre prüfen." }
    }
    func revoke() { update { $0.profile = nil; $0.food = []; $0.drinks = [] } }
    func export() -> Data { (try? Data(contentsOf: file)) ?? ((try? JSONEncoder().encode(data)) ?? Data()) }
}

@MainActor final class MotionJournal: ObservableObject {
    @Published var steps: Int?
    @Published var floors: Int?
    @Published var message = "Noch nicht verbunden. Fehlende Werte bleiben unbekannt."
    private let pedometer = CMPedometer()
    func read() {
        steps = nil; floors = nil
        guard CMPedometer.isStepCountingAvailable() else { message = "Dieser Gerätetyp stellt keine Schrittdaten bereit."; return }
        pedometer.queryPedometerData(from: Calendar.current.startOfDay(for: .now), to: .now) { [weak self] value, error in
            Task { @MainActor in
                guard let self else { return }
                guard error == nil, let value else { self.message = "Bewegungsfreigabe fehlt oder Gerätedaten sind nicht verfügbar. Prüfe die iOS-Einstellungen."; return }
                self.steps = value.numberOfSteps.intValue
                self.floors = CMPedometer.isFloorCountingAvailable() ? value.floorsAscended?.intValue : nil
                self.message = "Heute · Quelle: CoreMotion dieses iPhones · abgerufen \(Date.now.formatted(date: .omitted, time: .shortened))"
            }
        }
    }
}

struct WellnessView: View {
    @ObservedObject var store: WellnessStore
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @StateObject private var motion = MotionJournal()
    @State private var age = ""
    @State private var consent = false
    @State private var query = ""
    @State private var selected: FoodItem?
    @State private var grams = "100"
    @State private var image: PhotosPickerItem?
    @State private var suggestions: [FoodItem] = []
    @State private var scanning = false
    @State private var photoSource = false
    @State private var message = ""
    @State private var undo: WellnessData?
    private var day: String { JournalDates.key(.now) }
    private var entries: [FoodEntry] { store.data.food.filter { $0.day == day } }
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            if !store.enabled { activation }
            foodSearch
            if store.enabled {
                JournalPanel(tint: Palette.nutrition) {
                    Text("Heute eingetragen").font(.title2.bold())
                    if store.adult { Text("\(energy, specifier: "%.0f") kcal").font(.largeTitle.bold()).contentTransition(.numericText()) }
                    Text("Nur deine bestätigten Einträge, keine vollständige Messung.").font(.footnote)
                    ForEach(entries) { entry in
                        HStack { Text("\(store.foods.first { $0.id == entry.foodId }?.name ?? "Lebensmittel") · \(entry.grams, specifier: "%.1f") g"); Spacer(); Button("Löschen", role: .destructive) { undo = store.data; store.update { $0.food.removeAll { $0.id == entry.id } }; message = "Eintrag gelöscht." }.frame(minHeight: 48) }
                    }
                    if entries.isEmpty { Text("Noch kein Essen eingetragen.") }
                }
                JournalPanel(tint: Palette.water) {
                    Text("Wasser").font(.title2.bold())
                    Text("\(store.data.drinks.filter { $0.day == day && $0.kind == "water" }.reduce(0) { $0 + $1.ml }) ml").font(.largeTitle.bold()).contentTransition(.numericText())
                    HStack { ForEach([250,500], id: \.self) { ml in Button("+ \(ml) ml") { undo = store.data; store.update { $0.drinks.append(WaterEntry(id: UUID().uuidString, kind: "water", ml: ml, caffeineMg: 0, day: day, at: ISO8601DateFormatter().string(from: .now), name: "Wasser")) }; message = "Wasser eingetragen." }.buttonStyle(.bordered).frame(minHeight: 48) } }
                }
                if store.adult { CaffeineView(store: store) }
                if store.data.drinks.contains(where: { $0.day == day }) {
                    JournalPanel {
                        Text("Deine Getränke heute").font(.title2.bold())
                        ForEach(store.data.drinks.filter { $0.day == day }) { entry in
                            HStack {
                                Text("\(entry.name) · \(entry.ml) ml\(entry.kind == "caffeine" && store.adult ? " · \(entry.caffeineMg) mg Koffein" : "")")
                                Spacer()
                                Button("Löschen", role: .destructive) { undo = store.data; store.update { $0.drinks.removeAll { $0.id == entry.id } }; message = "Getränk gelöscht." }.frame(minHeight: 48)
                            }
                        }
                    }
                }
                JournalPanel(tint: Palette.movement) {
                    Text("Bewegung").font(.title2.bold())
                    Text("\(motion.steps.map(String.init) ?? "–") Schritte · \(motion.floors.map(String.init) ?? "–") Etagen").font(.title2.bold())
                    Text(motion.message).font(.footnote)
                    Button("CoreMotion verbinden / aktualisieren") { motion.read() }.buttonStyle(.bordered).frame(minHeight: 48)
                    Text("Freigaben in iOS unter Datenschutz & Sicherheit → Bewegung & Fitness widerrufen. Blutzucker ist hier nicht verbunden.").font(.footnote)
                }
            }
            if !message.isEmpty { JournalPanel(tint: Palette.movement) { Text(message); if let previous = undo { Button("Rückgängig") { store.update { $0 = previous }; undo = nil; message = "Rückgängig gemacht." } } } }
            if !store.message.isEmpty { Text(store.message) }
        }
        .onChange(of: image) { _, value in Task { await analyze(value) } }
        .animation(reduceMotion ? nil : .easeOut(duration: 0.32), value: store.data.food.count + store.data.drinks.count)
    }
    private var energy: Double { entries.reduce(0) { result, entry in result + (store.foods.first { $0.id == entry.foodId }?.per100g.energyKcal ?? 0) * entry.grams / 100 } }
    private var activation: some View {
        JournalPanel(tint: Palette.trend) {
            Text("Dein Journal bleibt bei dir").font(.title2.bold())
            Text("Ab 16 freiwillig. Unter 18 ohne Kalorienübersicht und Koffeinjournal. Kochen bleibt offen.")
            TextField("Alter in Jahren", text: $age).keyboardType(.numberPad).textFieldStyle(.roundedBorder).frame(minHeight: 48)
            Toggle("Alter und Gesundheitsjournal freiwillig lokal speichern. Jederzeit unter Mehr widerrufbar.", isOn: $consent)
            Button("Journal aktivieren") { guard let years = Int(age), (6...120).contains(years) else { message = "Bitte ein gültiges Alter angeben."; return }; guard years >= 16 else { message = "Das Journal ist ab 16. Kochen bleibt verfügbar."; return }; store.update { $0.profile = WellnessProfile(age: years, consentAt: ISO8601DateFormatter().string(from: .now), policyVersion: "2026-11-05.1") } }.buttonStyle(.borderedProminent).disabled(!consent || !store.readable).frame(minHeight: 48)
        }
    }
    private var foodSearch: some View {
        JournalPanel(tint: Palette.nutrition) {
            Text("Was hast du gegessen?").font(.title2.bold())
            Text("Roh und gekocht bleiben getrennte Einträge.")
            PhotosPicker(selection: $image, matching: .images) { Label(scanning ? "Foto wird lokal geprüft …" : "Foto als Suchhilfe", systemImage: "camera").frame(minHeight: 48) }.disabled(scanning)
            Text("Fotos bleiben auf dem Gerät. Öl, Sauce und gewogene Gramm selbst ergänzen.").font(.footnote)
            ForEach(suggestions) { food in Button(food.name) { selected = food; photoSource = true; suggestions = [] }.frame(minHeight: 48) }
            TextField("Lebensmittel suchen · z. B. Nudeln", text: $query).textFieldStyle(.roundedBorder).frame(minHeight: 48).onChange(of: query) { _, _ in selected = nil; photoSource = false }
            if query.isEmpty && selected == nil && !store.data.favoriteFoods.isEmpty {
                Text("Häufig gegessen").font(.headline)
                ForEach(store.foods.filter { store.data.favoriteFoods.contains($0.id) }) { food in Button(food.name) { selected = food; photoSource = false }.frame(minHeight: 48) }
            }
            if selected == nil && !query.isEmpty {
                let results = store.foods.filter { ($0.name + $0.aliases.joined(separator: " ")).localizedStandardContains(query) }.prefix(10)
                if results.isEmpty { Text("Keine Treffer. Suche eine einzelne Grundzutat.") }
                ForEach(Array(results)) { food in Button { selected = food; photoSource = false } label: { HStack { Text(food.name); Spacer(); if store.adult || !store.enabled { Text("\(food.per100g.energyKcal ?? 0, specifier: "%.0f") kcal/100 g").font(.footnote) } }.frame(minHeight: 48) }.buttonStyle(.plain) }
            }
            if let food = selected {
                Text(food.name).font(.headline)
                Button(store.data.favoriteFoods.contains(food.id) ? "Nicht mehr häufig gegessen" : "Als häufiges Lebensmittel merken") { store.update { data in if data.favoriteFoods.contains(food.id) { data.favoriteFoods.removeAll { $0 == food.id } } else { data.favoriteFoods.append(food.id) } } }.frame(minHeight: 48)
                TextField("Bestätigte Menge in Gramm", text: $grams).keyboardType(.decimalPad).textFieldStyle(.roundedBorder).frame(minHeight: 48)
                if let amount = Double(grams.replacingOccurrences(of: ",", with: ".")), amount > 0, amount <= 5000 {
                    if store.adult || !store.enabled { Text("\((food.per100g.energyKcal ?? 0) * amount / 100, specifier: "%.0f") kcal") }
                    Text("\((food.per100g.proteinG ?? 0) * amount / 100, specifier: "%.1f") g Eiweiß · \((food.per100g.carbohydrateG ?? 0) * amount / 100, specifier: "%.1f") g Kohlenhydrate · \((food.per100g.fatG ?? 0) * amount / 100, specifier: "%.1f") g Fett")
                    Button(store.enabled ? "Menge bestätigen & eintragen" : "Journal zuerst aktivieren") { undo = store.data; store.update { $0.food.append(FoodEntry(id: UUID().uuidString, foodId: food.id, grams: amount, day: day, at: ISO8601DateFormatter().string(from: .now), source: photoSource ? "photo" : "manual")) }; selected = nil; query = ""; message = "Essen eingetragen." }.buttonStyle(.borderedProminent).disabled(!store.enabled).frame(minHeight: 48)
                }
                Link("USDA-Quelle ansehen", destination: URL(string: "https://fdc.nal.usda.gov/food-details/\(food.fdcId)/nutrients")!).frame(minHeight: 48)
            }
        }
    }
    private func analyze(_ item: PhotosPickerItem?) async {
        guard let item else { return }; scanning = true; defer { scanning = false }
        do { guard let data = try await item.loadTransferable(type: Data.self), data.count <= 20_000_000 else { throw CocoaError(.fileReadTooLarge) }
            let labels = try await Task.detached(priority: .userInitiated) { let request = VNClassifyImageRequest(); try VNImageRequestHandler(data: data).perform([request]); return request.results?.filter { $0.confidence >= 0.05 }.map(\.identifier) ?? [] }.value
            suggestions = Array(store.foods.filter { food in food.vision.contains { term in labels.contains { $0.localizedCaseInsensitiveContains(term) } } }.prefix(6))
            message = suggestions.isEmpty ? "Kein passender Vorschlag. Bitte manuell suchen." : "Lebensmittel und Gramm bitte selbst bestätigen."
        } catch { message = "Foto nicht lesbar. Die manuelle Suche funktioniert weiter." }
    }
}

struct ComfortView: View {
    let catalog: Catalog
    @ObservedObject var store: WellnessStore
    let journal: KitchenJournal
    let update: ((inout KitchenJournal) -> Void) -> Void
    let planning: Bool
    @StateObject private var cloud = CloudAccountStore()
    @State private var plus = false
    @State private var weeks = 1
    @State private var period = 7
    @State private var vegetarian = false
    @State private var fast = false
    @State private var draft: [String] = []
    @State private var name = "Mein Wochenplan"
    @State private var message = ""
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            if !plus { JournalPanel(tint: Palette.trend) { Text("Plus-Vorschau").font(.title2.bold()); Text("Native Käufe noch nicht erhältlich. Ein vorhandener Zugang wird über dein im Profil angemeldetes Konto geprüft."); Button("Zugang erneut prüfen") { Task { plus = (try? await cloud.plus()) ?? false } }.frame(minHeight: 48) } }
            if planning { planner } else { insights }
            if !message.isEmpty { Text(message) }
        }.task { plus = (try? await cloud.plus()) ?? false }
    }
    private var insights: some View {
        VStack(alignment: .leading, spacing: 16) {
            JournalPanel(tint: Palette.trend) {
                Text("Dein Rhythmus").font(.title2.bold())
                PillLayout { ForEach([7,30,90], id: \.self) { days in Button("\(days) Tage\(days > 7 ? " · Plus" : "")") { if days == 7 || plus { period = days } else { message = "Dafür ist ein bestätigter Plus-Zugang erforderlich." } }.buttonStyle(.bordered).frame(minHeight: 48) } }
                let current = JournalDates.key(Calendar.current.date(byAdding: .day, value: 1-period, to: .now)!)
                Text("\(store.data.food.filter { $0.day >= current }.count) Essenseinträge in \(period) Tagen").font(.title3.bold())
                if period > 7 {
                    let start = JournalDates.key(Calendar.current.date(byAdding: .day, value: 1-period*2, to: .now)!)
                    let end = JournalDates.key(Calendar.current.date(byAdding: .day, value: -period, to: .now)!)
                    Text("Vorheriger Zeitraum: \(store.data.food.filter { $0.day >= start && $0.day <= end }.count) Einträge")
                }
                Text("Fehlende Einträge bleiben unbekannt. Kein Urteil über dein Essen.")
            }
            JournalPanel {
                Text("Alle Einträge bleiben lesbar").font(.headline)
                ForEach(store.data.food.reversed()) { entry in Text("\(entry.day) · \(store.foods.first { $0.id == entry.foodId }?.name ?? entry.foodId) · \(entry.grams, specifier: "%.1f") g") }
            }
        }
    }
    private var planner: some View {
        VStack(alignment: .leading, spacing: 16) {
            JournalPanel(tint: Palette.kitchen) {
                Text("Ein Plan aus deinem Vorrat").font(.title2.bold())
                Text("Ein Gericht für zwei Portionen pro Tag. Prüfe den Vorschlag vor dem Übernehmen.")
                Picker("Wochen", selection: $weeks) { ForEach(1...4, id: \.self) { Text("\($0)").tag($0) } }
                Toggle("Vegetarisch", isOn: $vegetarian); Toggle("Höchstens 10 Minuten", isOn: $fast)
                Button("Plan vorschlagen\(plus ? "" : " · Plus")") { guard plus else { message = "Dafür ist ein bestätigter Plus-Zugang erforderlich."; return }; suggest() }.buttonStyle(.borderedProminent).frame(minHeight: 48)
            }
            if !draft.isEmpty { JournalPanel {
                Text("Dein Vorschlag").font(.title2.bold())
                ForEach(draft.indices, id: \.self) { index in Text("\(index+1). \(catalog.recipes.first { $0.id == draft[index] }?.name ?? "")") }
                Text("Planungen für diese Tage werden ersetzt.")
                Button("Plan & Einkauf übernehmen") { guard plus else { return }; let dates = draft.indices.map { JournalDates.key(Calendar.current.date(byAdding: .day, value: $0, to: .now)!) }; update { state in state.plans.removeAll { dates.contains($0.day) }; for (i,id) in draft.enumerated() { state.plans.append(MealPlan(day: dates[i],recipeId: id)); if let recipe = catalog.recipes.first(where: { $0.id == id }) { state.buyMissing(recipe) } } }; draft = []; message = "Plan & Einkauf übernommen." }.buttonStyle(.borderedProminent).frame(minHeight: 48)
                TextField("Name der Vorlage", text: $name).textFieldStyle(.roundedBorder)
                Button("Als Vorlage merken") { guard plus else { return }; store.update { if $0.templates == nil { $0.templates = [] }; $0.templates?.append(WellnessTemplate(id: UUID().uuidString, name: String(name.prefix(60)), recipeIds: draft)) }; message = "Vorlage gespeichert." }.disabled(name.isEmpty).frame(minHeight: 48)
            } }
            ForEach(store.data.templates ?? []) { template in JournalPanel { Text(template.name).font(.headline); Button("Vorlage verwenden") { if plus { draft = template.recipeIds.filter { id in catalog.recipes.contains { $0.id == id } } } else { message = "Plus-Zugang erforderlich." } }.frame(minHeight: 48); Button("Vorlage löschen", role: .destructive) { store.update { $0.templates?.removeAll { $0.id == template.id } } }.frame(minHeight: 48) } }
        }
    }
    private func suggest() {
        let choices = catalog.recipes.filter { (!vegetarian || !$0.items.contains { $0.id == "tuna" }) && (!fast || $0.minutes <= 10) }
        var used: [String:Int] = [:]; var result: [String] = []
        for _ in 0..<(weeks*7) {
            let sorted = choices.sorted { a,b in
                if used[a.id,default:0] != used[b.id,default:0] { return used[a.id,default:0] < used[b.id,default:0] }
                let aStock = a.items.filter { journal.stock.contains($0.id) }.count; let bStock = b.items.filter { journal.stock.contains($0.id) }.count
                if aStock != bStock { return aStock > bStock }; if a.minutes != b.minutes { return a.minutes < b.minutes }; return a.id < b.id
            }
            guard let next = sorted.first else { message = "Keine Rezepte für diese Vorlieben."; return }; result.append(next.id); used[next.id,default:0] += 1
        }
        draft = result
    }
}

struct CaffeineView: View {
    @ObservedObject var store: WellnessStore
    @State private var name = "Kaffee"
    @State private var volume = "200"
    @State private var caffeine = "80"
    var body: some View { JournalPanel(tint: Palette.trend) {
        Text("Koffein bewusst eintragen").font(.title2.bold())
        Text("Kein Trinkziel oder Restbudget. Schon 100 mg können den Schlaf beeinflussen. Unruhe und Herzklopfen sind mögliche Wirkungen.")
        TextField("Getränk", text: $name).textFieldStyle(.roundedBorder)
        TextField("Milliliter", text: $volume).keyboardType(.numberPad).textFieldStyle(.roundedBorder)
        TextField("Koffein gesamt in mg · laut Etikett", text: $caffeine).keyboardType(.decimalPad).textFieldStyle(.roundedBorder)
        if let ml = Int(volume), let mg = Double(caffeine), (1...5000).contains(ml), (0...1000).contains(mg) {
            Button("Getränk bestätigen") { store.update { $0.drinks.append(WaterEntry(id: UUID().uuidString, kind: "caffeine", ml: ml, caffeineMg: mg, day: JournalDates.key(.now), at: ISO8601DateFormatter().string(from: .now), name: String(name.prefix(100)))) } }.buttonStyle(.bordered).frame(minHeight: 48)
        }
        Link("EFSA: 200 mg einzeln / 400 mg täglich für gesunde Erwachsene. Schwangerschaft und Stillzeit: 200 mg täglich. Keine persönliche Freigabe.", destination: URL(string: "https://www.efsa.europa.eu/en/topics/topic/caffeine")!).font(.footnote)
    } }
}

struct WellnessPrivacy: View {
    @ObservedObject var store: WellnessStore
    @State private var export = false
    @State private var remove = false
    var body: some View { VStack(alignment: .leading, spacing: 16) {
        AppearancePicker()
        JournalPanel(tint: Palette.trend) {
            Text("Speicher & Datenschutz").font(.title2.bold())
            Text("Das Journal ist mit iOS-Dateischutz gesichert und von Gerätesicherungen ausgeschlossen. Gesundheitsdaten sind nicht Teil der Küchensicherung. Keine Werbung oder Tracking-Cookies.")
            Button("Journal exportieren") { export = true }.frame(minHeight: 48)
            Button("Gesundheitsfreigabe widerrufen & Daten löschen", role: .destructive) { store.revoke() }.frame(minHeight: 48)
            Toggle("Auch Rezeptimporte und das gesamte Journal löschen", isOn: $remove)
            Button("Journal vollständig löschen", role: .destructive) { store.update { $0 = WellnessData() }; remove = false }.disabled(!remove).frame(minHeight: 48)
        }
        JournalPanel { Text("Zuerst · von Vora").font(.headline); Text("Studio-Arbeitsname im Projekt Odkaz Labs. Kontakt: myriajr@gmx.net. Anbieterfreigabe für Live-Käufe ausstehend."); Link("Datenschutz & Nutzung", destination: URL(string: "https://zuerst.vercel.app/datenschutz/")!) }
    }.fileExporter(isPresented: $export, document: JournalDocument(data: store.export()), contentType: .json, defaultFilename: "zuerst-journal") { result in if case .failure = result { store.message = "Export fehlgeschlagen. Bitte erneut versuchen." } } }
}
