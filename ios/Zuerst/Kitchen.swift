import SwiftUI

private enum Stage: Hashable { case pick, confirm, result, cook }

struct Kitchen: View {
    let catalog: Catalog
    @State private var path: [Stage] = []
    @State private var picked: [String] = []
    @State private var confirmed: Set<String> = []
    @State private var query = ""
    @State private var idea = 0
    @State private var showsInfo = false
    @FocusState private var searchFocused: Bool
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ScaledMetric(relativeTo: .body) private var chipWidth = 106.0

    private var matches: RecipeMatches { catalog.matches(picked: picked, confirmed: confirmed) }
    private var active: Candidate? {
        let available = matches.complete
        return available.isEmpty ? nil : available[idea % available.count]
    }
    private var accent: Color { colorScheme == .dark ? Color(red: 0.82, green: 0.90, blue: 0.58) : Color(red: 0.32, green: 0.40, blue: 0.20) }
    private var paper: Color { colorScheme == .dark ? Color(red: 0.15, green: 0.12, blue: 0.16) : Color(red: 1, green: 0.985, blue: 0.95) }

    var body: some View {
        NavigationStack(path: $path) {
            screen(.pick) { picker }
                .navigationDestination(for: Stage.self) { stage in
                    switch stage {
                    case .pick: screen(.pick) { picker }
                    case .confirm: screen(.confirm) { confirmation }
                    case .result: screen(.result) { recommendation }
                    case .cook: screen(.cook) { if let active { cooking(active.recipe) } }
                    }
                }
        }
        .tint(accent)
        .sheet(isPresented: $showsInfo) {
            NavigationStack {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        Image("Mark").resizable().frame(width: 52, height: 52).accessibilityHidden(true)
                        Text("Über Zuerst").font(.largeTitle.bold()).accessibilityAddTraits(.isHeader)
                        Text("\(catalog.recipes.count) schnelle Rezepte für Zutaten, die du aufbrauchen möchtest. Die Rezepte und deine Auswahl bleiben auf diesem Gerät.")
                        Text("Eine Marke von Odkaz Labs.").font(.footnote).foregroundStyle(.secondary)
                    }.frame(maxWidth: .infinity, alignment: .leading).padding(24)
                }.toolbar { ToolbarItem(placement: .confirmationAction) { Button("Fertig") { showsInfo = false } } }
            }.presentationDetents([.medium, .large])
        }
    }

    private func screen<Content: View>(_ stage: Stage, @ViewBuilder content: () -> Content) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 15) {
                if stage != .pick { progress(stage) }
                content()
            }
            .frame(maxWidth: 600)
            .padding(.horizontal, 18)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
        .background { MeshBackdrop() }
        .navigationBarTitleDisplayMode(.inline)
        .navigationTitle(stage == .pick ? "" : "Zuerst")
        .toolbar {
            if stage == .pick {
                ToolbarItem(placement: .principal) {
                    HStack(spacing: 8) {
                        Image("Mark").resizable().frame(width: 29, height: 29).accessibilityHidden(true)
                        Text("Zuerst.").font(.title3.weight(.heavy))
                    }
                }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button { showsInfo = true } label: { Label("Über Zuerst", systemImage: "info.circle").labelStyle(.iconOnly) }
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if let action = action(for: stage) {
                GlassDock(action: action, accent: accent)
                    .frame(maxWidth: 600)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 8)
                    .frame(maxWidth: .infinity)
            }
        }
    }

    private var picker: some View {
        let searching = !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let options = searching ? catalog.search(query) : catalog.quick
        return VStack(alignment: .leading, spacing: 15) {
            hero {
                Text("Was möchtest du aufbrauchen?").font(.largeTitle.weight(.heavy)).accessibilityAddTraits(.isHeader)
                Text("Ein Gericht aus deinen Zutaten. In höchstens 20 Minuten.").font(.subheadline)
                Image("Kitchen").resizable().scaledToFit().frame(maxWidth: .infinity).frame(height: 121).accessibilityHidden(true)
            }
            panel {
                title("Deine Zutaten")
                HStack(spacing: 10) {
                    Image(systemName: "magnifyingglass").foregroundStyle(.secondary).accessibilityHidden(true)
                    TextField("Zutat suchen …", text: $query)
                        .focused($searchFocused).submitLabel(.search).autocorrectionDisabled()
                        .onSubmit { if searching, let id = options.first(where: { !picked.contains($0) }), picked.count < 3 { togglePick(id) } }
                    if searching {
                        Button { query = "" } label: {
                            Label("Suche leeren", systemImage: "xmark.circle.fill").labelStyle(.iconOnly).frame(minWidth: 44, minHeight: 44)
                        }.buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 12).frame(minHeight: 49)
                .background(.quaternary, in: .rect(cornerRadius: 15))
                Text(searching ? "\(options.count) Treffer" : "Schnellwahl").font(.subheadline.weight(.semibold)).foregroundStyle(.secondary)
                if options.isEmpty { Text("Diese Zutat ist noch nicht im Katalog. Versuch es mit einem anderen Begriff.").foregroundStyle(.secondary) }
                LazyVGrid(columns: [GridItem(.adaptive(minimum: chipWidth), spacing: 7)], alignment: .leading, spacing: 7) {
                    ForEach(options, id: \.self) { id in
                        chip(catalog.name(id), symbol: picked.contains(id) ? "checkmark" : nil, selected: picked.contains(id)) { togglePick(id) }
                            .disabled(picked.count == 3 && !picked.contains(id))
                            .opacity(picked.count == 3 && !picked.contains(id) ? 0.64 : 1)
                    }
                }
            }
            panel {
                HStack { Text("Ausgewählt").font(.headline); Spacer(); badge("\(picked.count) / 3") }
                if !picked.isEmpty {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: chipWidth), spacing: 7)], spacing: 7) {
                        ForEach(Array(picked.enumerated()), id: \.element) { index, id in
                            chip(index == 0 ? "1 · \(catalog.name(id))" : catalog.name(id), symbol: "xmark", selected: true) { togglePick(id) }
                                .accessibilityLabel("\(catalog.name(id)) entfernen")
                        }
                    }
                }
                Text(picked.count == 3 ? "Drei Zutaten ausgewählt." : "Eine reicht. Zwei weitere sind optional.").font(.subheadline).foregroundStyle(.secondary)
            }
        }
    }

    private var confirmation: some View {
        VStack(alignment: .leading, spacing: 12) {
            hero {
                Text("Was hast du noch da?").font(.largeTitle.bold()).accessibilityAddTraits(.isHeader)
                Text("Bestätige nur, was du wirklich zur Hand hast.")
                Text("Aufbrauchen: \(picked.map(catalog.name).joined(separator: ", "))").font(.subheadline.weight(.semibold))
            }
            let choices = catalog.choices(picked: picked)
            if choices.isEmpty { panel { Text("Für deine Auswahl gibt es keine weiteren Zutaten zu prüfen.") } }
            ForEach(choices, id: \.self) { id in
                panel {
                    Toggle(isOn: Binding(get: { confirmed.contains(id) }, set: { on in
                        if on { confirmed.insert(id) } else { confirmed.remove(id) }
                        idea = 0
                    })) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(catalog.name(id)).font(.headline)
                            if catalog.pantry.contains(id) { Text("Grundzutat").font(.footnote).foregroundStyle(.secondary) }
                        }
                    }.frame(minHeight: 44)
                }
            }
        }
    }

    @ViewBuilder private var recommendation: some View {
        if let active {
            hero {
                Label("Deine Empfehlung", systemImage: "fork.knife").font(.subheadline.weight(.semibold))
                Text(active.recipe.name).font(.largeTitle.bold()).accessibilityAddTraits(.isHeader)
                Text(active.recipe.note)
                Label("\(active.recipe.minutes) Min.", systemImage: "clock").font(.headline)
            }
            panel {
                title("Du verbrauchst")
                Text(active.used.map(catalog.name).joined(separator: ", ")).font(.body)
            }
        } else if let almost = matches.almost, let missing = almost.missing.first {
            panel {
                title("Eine Zutat fehlt noch.")
                Text("Hast du **\(catalog.name(missing))** da? Dann kannst du **\(almost.recipe.name)** in \(almost.recipe.minutes) Min. machen.")
                Button("Auswahl ändern", action: startAgain).frame(minHeight: 44)
            }
        } else {
            panel {
                title("Noch kein passendes Gericht.")
                Text("Zuerst findet mit \(picked.first.map(catalog.name) ?? "deiner Auswahl") und den bestätigten Zutaten kein Rezept. Ändere deine Auswahl oder ergänze, was noch da ist.")
            }
        }
    }

    private func cooking(_ recipe: Recipe) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            hero {
                Text(recipe.name).font(.largeTitle.bold()).accessibilityAddTraits(.isHeader)
                Label("\(recipe.minutes) Min. · 2 Portionen", systemImage: "clock").font(.subheadline.weight(.semibold))
            }
            panel {
                title("Zutaten")
                Text("Mengen für 2 Portionen").font(.subheadline).foregroundStyle(.secondary)
                ForEach(recipe.items) { item in
                    Divider()
                    HStack(alignment: .firstTextBaseline, spacing: 12) {
                        Text(catalog.name(item.id)).fontWeight(.semibold)
                        Spacer(minLength: 5)
                        Text(item.amount).foregroundStyle(.secondary).multilineTextAlignment(.trailing)
                    }.accessibilityElement(children: .combine)
                }
            }
            panel {
                title("So geht’s")
                ForEach(Array(recipe.steps.enumerated()), id: \.offset) { index, step in
                    HStack(alignment: .top, spacing: 11) {
                        badge("\(index + 1)")
                        Text(step).padding(.top, 2).frame(maxWidth: .infinity, alignment: .leading)
                    }.accessibilityElement(children: .combine)
                }
            }
        }
    }

    private func togglePick(_ id: String) {
        if picked.contains(id) { picked.removeAll { $0 == id }; confirmed.remove(id) }
        else if picked.count < 3 { picked.append(id); query = ""; searchFocused = false }
        idea = 0
    }

    private func go(_ stage: Stage) { searchFocused = false; query = ""; path.append(stage) }
    private func startAgain() { path.removeAll() }

    private func action(for stage: Stage) -> DockAction? {
        switch stage {
        case .pick:
            return picked.isEmpty ? nil : DockAction(title: "Zutaten prüfen", symbol: "arrow.right") { go(.confirm) }
        case .confirm:
            return DockAction(title: "Gericht finden", symbol: "arrow.right") { go(.result) }
        case .result:
            if active != nil {
                return DockAction(title: "Jetzt kochen", symbol: "arrow.right", alternative: matches.complete.count > 1 ? {
                    withAnimation(reduceMotion ? nil : .smooth) { idea = (idea + 1) % matches.complete.count }
                } : nil) { go(.cook) }
            }
            if let missing = matches.almost?.missing.first {
                return DockAction(title: "Zutat bestätigen", symbol: "checkmark") {
                    withAnimation(reduceMotion ? nil : .smooth) { _ = confirmed.insert(missing); idea = 0 }
                }
            }
            return DockAction(title: "Auswahl ändern", symbol: "arrow.right", perform: startAgain)
        case .cook: return nil
        }
    }

    private func progress(_ stage: Stage) -> some View {
        Text(stage == .confirm ? "2 / 3  ·  Bestätigen" : "3 / 3  ·  Kochen")
            .font(.subheadline.weight(.semibold)).foregroundStyle(.secondary).padding(.horizontal, 4)
    }

    private func title(_ text: String) -> some View { Text(text).font(.title2.bold()).accessibilityAddTraits(.isHeader) }

    private func panel<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 11, content: content)
            .padding(17).frame(maxWidth: .infinity, alignment: .leading)
            .background(paper, in: .rect(cornerRadius: 25))
    }

    private func hero<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10, content: content)
            .padding(19).frame(maxWidth: .infinity, alignment: .leading)
            .foregroundStyle(Color(red: 1, green: 0.96, blue: 0.89))
            .background(Color(red: 0.20, green: 0.133, blue: 0.23), in: .rect(cornerRadius: 28))
    }

    private func badge(_ text: String) -> some View {
        Text(text).font(.subheadline.weight(.semibold)).foregroundStyle(accent)
            .padding(.horizontal, 9).padding(.vertical, 5).background(accent.opacity(0.13), in: .capsule)
    }

    private func chip(_ name: String, symbol: String?, selected: Bool, onTap: @escaping () -> Void) -> some View {
        Button(action: onTap) {
            HStack(spacing: 4) {
                if let symbol { Image(systemName: symbol).imageScale(.small).accessibilityHidden(true) }
                Text(name).multilineTextAlignment(.center)
            }
            .font(.subheadline.weight(.semibold)).padding(.horizontal, 8).padding(.vertical, 5)
            .frame(maxWidth: .infinity, minHeight: 44)
            .foregroundStyle(selected ? accent : Color.primary)
            .background(accent.opacity(selected ? 0.18 : 0.075), in: .capsule)
            .contentShape(.capsule)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}
