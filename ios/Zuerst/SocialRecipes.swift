import SwiftUI

struct SocialRecipesView: View {
    let catalog: Catalog
    @ObservedObject var store: WellnessStore
    let journal: KitchenJournal
    let update: ((inout KitchenJournal) -> Void) -> Void
    @State private var title = ""
    @State private var url = ""
    @State private var ingredients = ""
    @State private var steps = ""
    @State private var mode = "comfort"
    @State private var message = ""
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            JournalPanel(tint: Palette.kitchen) {
                Text("Aus deinem Feed in deine Küche").font(.title2.bold())
                Text("Link und übernommenen Rezepttext einfügen. Kein automatischer Videoabruf. Ungeprüfte Zutaten bleiben unbekannt.")
                TextField("Rezeptname", text: $title).textFieldStyle(.roundedBorder).frame(minHeight: 48)
                TextField("Instagram- oder TikTok-Link", text: $url).textFieldStyle(.roundedBorder).keyboardType(.URL).textInputAutocapitalization(.never).frame(minHeight: 48)
                Text("Zutaten · eine pro Zeile").font(.headline)
                TextEditor(text: $ingredients).frame(minHeight: 120).clipShape(RoundedRectangle(cornerRadius: 14))
                Text("Schritte · einer pro Zeile").font(.headline)
                TextEditor(text: $steps).frame(minHeight: 120).clipShape(RoundedRectangle(cornerRadius: 14))
                Picker("Sammlung", selection: $mode) { Text("Genuss & Comfort").tag("comfort"); Text("Bewusst & ausgewogen").tag("balanced") }
                Text("Deine Einordnung, keine geprüfte Gesundheitsaussage.").font(.footnote)
                Button("Geprüften Text speichern") {
                    guard let link = URLComponents(string: url), link.scheme == "https", ["instagram.com","www.instagram.com","tiktok.com","www.tiktok.com","vm.tiktok.com","vt.tiktok.com"].contains(link.host?.lowercased() ?? ""), link.user == nil else { message = "Bitte einen gültigen Social-Link einfügen."; return }
                    let names = ingredients.components(separatedBy: .newlines).map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
                    let instructions = steps.components(separatedBy: .newlines).map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
                    guard !title.trimmingCharacters(in: .whitespaces).isEmpty, !names.isEmpty, !instructions.isEmpty else { message = "Name, Zutaten und Schritte ergänzen."; return }
                    store.update { $0.imports.append(SocialRecipe(id: UUID().uuidString, title: String(title.prefix(100)), url: String(url.prefix(2000)), mode: mode, ingredients: Array(names.prefix(40)).map { SocialIngredient(name: String($0.prefix(160)), ingredientId: nil) }, steps: Array(instructions.prefix(25)).map { String($0.prefix(2000)) }, savedAt: ISO8601DateFormatter().string(from: .now))) }
                    title = ""; ingredients = ""; steps = ""; message = "Rezept gespeichert. Zutatenzuordnung prüfen."
                }.buttonStyle(.borderedProminent).frame(minHeight: 48)
            }
            ForEach(store.data.imports) { recipe in JournalPanel {
                Text(recipe.title).font(.title2.bold())
                if let link = URL(string: recipe.url) { Link("Original öffnen", destination: link).frame(minHeight: 48) }
                Text("\(recipe.ingredients.filter { journal.stock.contains($0.ingredientId ?? "") }.count) von \(recipe.ingredients.count) Zutaten vorhanden. Mengen selbst prüfen.")
                ForEach(recipe.ingredients.indices, id: \.self) { index in
                    Text(recipe.ingredients[index].name).font(.headline)
                    Picker("Zutat zuordnen", selection: Binding(get: { recipe.ingredients[index].ingredientId ?? "" }, set: { value in store.update { data in if let i = data.imports.firstIndex(where: { $0.id == recipe.id }) { data.imports[i].ingredients[index].ingredientId = value.isEmpty ? nil : value } } })) {
                        Text("Unbekannt · prüfen").tag("")
                        ForEach(catalog.ingredients) { ingredient in Text(ingredient.name).tag(ingredient.id) }
                    }
                }
                ForEach(recipe.steps.indices, id: \.self) { index in Text("\(index + 1). \(recipe.steps[index])") }
                Button("Fehlendes zum Einkauf") {
                    let known = recipe.ingredients.compactMap(\.ingredientId).filter { !journal.stock.contains($0) }
                    update { for id in known where !$0.shopping.contains(id) { $0.shopping.append(id) } }
                    store.update { data in for item in recipe.ingredients where item.ingredientId == nil { if !data.shoppingText.contains(item.name) { data.shoppingText.append(item.name) } } }
                    message = "Fehlendes und unbekannte Zutaten zum Einkauf ergänzt."
                }.buttonStyle(.bordered).frame(minHeight: 48)
                Button("Rezept löschen", role: .destructive) { store.update { $0.imports.removeAll { $0.id == recipe.id } } }.frame(minHeight: 48)
            } }
            if !message.isEmpty { Text(message) }
        }
    }
}
