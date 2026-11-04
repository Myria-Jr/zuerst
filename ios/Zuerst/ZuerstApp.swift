import SwiftUI

@main
struct ZuerstApp: App {
    var body: some Scene {
        WindowGroup { ZuerstRoot() }
    }
}

struct ZuerstRoot: View {
    private let catalog = try? Catalog.load()

    var body: some View {
        if let catalog {
            Kitchen(catalog: catalog)
        } else {
            ContentUnavailableView("Rezepte fehlen", systemImage: "book.closed", description: Text("Der lokale Rezeptkatalog konnte nicht geladen werden."))
        }
    }
}

#Preview("Zutatenauswahl") { ZuerstRoot() }
