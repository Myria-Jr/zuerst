import SwiftUI

@main
struct ZuerstApp: App {
    var body: some Scene {
        WindowGroup { ZuerstRoot().preferredColorScheme(.light) }
    }
}

struct ZuerstRoot: View {
    private let catalog = try? Catalog.load()

    var body: some View {
        if let catalog {
            JournalHome(catalog: catalog)
        } else {
            ContentUnavailableView("Rezepte fehlen", systemImage: "book.closed", description: Text("Der lokale Rezeptkatalog konnte nicht geladen werden."))
        }
    }
}

#Preview("Heute") { ZuerstRoot() }
