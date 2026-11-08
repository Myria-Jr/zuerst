import SwiftUI
import UniformTypeIdentifiers

struct JournalDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.json] }
    var data: Data
    init(data: Data) { self.data = data }
    init(configuration: ReadConfiguration) throws { data = configuration.file.regularFileContents ?? Data() }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper { FileWrapper(regularFileWithContents: data) }
}

struct ProfileView: View {
    let catalog: Catalog
    let journal: KitchenJournal
    let update: ((inout KitchenJournal) -> Void) -> Void
    @Environment(\.dismiss) private var dismiss
    @StateObject private var cloud = CloudAccountStore()
    @State private var register = false
    @State private var email = ""
    @State private var password = ""
    @State private var exporting = false
    @State private var importing = false
    @State private var restore: KitchenJournal?
    @State private var removeBackup = false
    @State private var fileMessage = ""
    private var document: JournalDocument { JournalDocument(data: (try? JSONEncoder().encode(journal)) ?? Data()) }
    var body: some View {
        NavigationStack {
            Form {
                AppearancePicker().listRowInsets(EdgeInsets())
                Section("Ganz du") {
                    TextField("Dein Name", text: Binding(get: { journal.name }, set: { name in update { $0.name = String(name.prefix(40)) } })).textContentType(.nickname)
                    Text("Der Name wird auf diesem Gerät gespeichert.").font(.footnote).foregroundStyle(Color.primary.opacity(0.7))
                }
                Section("Konto & Sicherung") {
                    if let account = cloud.account { signedIn(account) } else { signIn }
                    if cloud.busy { ProgressView().frame(maxWidth: .infinity) }
                    if !cloud.message.isEmpty { Text(cloud.message).font(.subheadline).foregroundStyle(Color.accentColor).accessibilityAddTraits(.updatesFrequently) }
                }
                Section {
                    Button { exporting = true } label: { Label("Exportieren", systemImage: "square.and.arrow.up").frame(minHeight: 44) }
                    Button { importing = true } label: { Label("Importieren", systemImage: "square.and.arrow.down").frame(minHeight: 44) }
                    if !fileMessage.isEmpty { Text(fileMessage).font(.subheadline).foregroundStyle(Color.primary.opacity(0.7)) }
                } header: { Text("Deine Daten gehören dir") } footer: { Text("Sichere dein Journal als Datei. Beim Import entscheidest du, ob die lokalen Daten ersetzt werden.") }
                Section("Über Zuerst") {
                    Text("Dein Begleiter für Einkauf, Vorrat und selbst gekochte Gerichte. Bonfotos werden auf diesem Gerät gelesen. Die Cloud-Sicherung ist freiwillig. Deine Anmeldung wird in der Apple Keychain gespeichert.")
                    Text("Von Vora · ein Projekt von Odkaz Labs. Version 1.5.0.").font(.footnote).foregroundStyle(Color.primary.opacity(0.7))
                    Link("Quellcode auf GitHub", destination: URL(string: "https://github.com/Myria-Jr/zuerst")!)
                }
            }.navigationTitle("Dein Zuerst").toolbar { ToolbarItem(placement: .confirmationAction) { Button("Fertig") { dismiss() } } }
        }.task { await cloud.loadSession() }
            .fileExporter(isPresented: $exporting, document: document, contentType: .json, defaultFilename: "zuerst-\(JournalDates.key(.now))") { result in
                switch result { case .success: fileMessage = "Sicherung exportiert."; case .failure: fileMessage = "Die Datei konnte nicht gespeichert werden." }
            }
            .fileImporter(isPresented: $importing, allowedContentTypes: [.json]) { result in
                do {
                    let url = try result.get(); let access = url.startAccessingSecurityScopedResource(); defer { if access { url.stopAccessingSecurityScopedResource() } }
                    let values = try url.resourceValues(forKeys: [.fileSizeKey]); guard (values.fileSize ?? 0) <= 1_000_000 else { throw CocoaError(.fileReadTooLarge) }
                    restore = try KitchenJournal.parse(Data(contentsOf: url), catalog: catalog)
                } catch { fileMessage = "Die Datei ist keine gültige Zuerst-Sicherung oder größer als 1 MB." }
            }
            .alert("Sicherung wiederherstellen?", isPresented: Binding(get: { restore != nil }, set: { if !$0 { restore = nil } })) {
                Button("Lokale Daten ersetzen", role: .destructive) { if let restore { update { $0 = restore }; fileMessage = "Sicherung wiederhergestellt." }; restore = nil }
                Button("Abbrechen", role: .cancel) { restore = nil }
            } message: { Text("Du übernimmst \(restore?.stock.count ?? 0) Vorratszutaten und \(restore?.meals.count ?? 0) Kocheinträge. Deine aktuellen lokalen Daten werden ersetzt. Exportiere sie vorher, wenn du sie behalten möchtest.") }
            .confirmationDialog("Cloud-Sicherung löschen?", isPresented: $removeBackup, titleVisibility: .visible) {
                Button("Sicherung endgültig löschen", role: .destructive) { Task { await cloud.run { try await cloud.removeBackup() } } }
            } message: { Text("Deine lokalen Daten bleiben erhalten.") }
    }
    private func signedIn(_ account: CloudAccount) -> some View {
        Group {
            Text("Angemeldet als \(account.email)")
            Text("Sichere Vorrat, Sammlung, Plan und Verlauf. Es wird nur übertragen, wenn du auf „Jetzt sichern“ tippst.").font(.subheadline).foregroundStyle(Color.primary.opacity(0.7))
            Button { Task { await cloud.run { try await cloud.save(journal) } } } label: { Label("Jetzt sichern", systemImage: "icloud.and.arrow.up").frame(minHeight: 44) }.disabled(cloud.busy)
            Button { Task { await cloud.run { restore = try await cloud.restore(catalog: catalog) } } } label: { Label("Sicherung wiederherstellen", systemImage: "icloud.and.arrow.down").frame(minHeight: 44) }.disabled(cloud.busy)
            Button("Abmelden") { Task { await cloud.run { await cloud.signOut() } } }.frame(minHeight: 44).disabled(cloud.busy)
            Button("Cloud-Sicherung löschen", role: .destructive) { removeBackup = true }.frame(minHeight: 44).disabled(cloud.busy)
        }
    }
    private var signIn: some View {
        Group {
            Text("Freiwillig. Dein Journal funktioniert auch ohne Anmeldung. Mit einem Konto kannst du es sichern und auf einem anderen Gerät wiederherstellen.").font(.subheadline).foregroundStyle(Color.primary.opacity(0.7))
            Picker("Konto", selection: $register) { Text("Anmelden").tag(false); Text("Konto erstellen").tag(true) }.pickerStyle(.segmented)
            TextField("E-Mail", text: $email).textContentType(.emailAddress).keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled()
            SecureField("Passwort · mindestens 8 Zeichen", text: $password).textContentType(register ? .newPassword : .password)
            Button(register ? "Konto erstellen" : "Anmelden") { Task { await cloud.run { try await cloud.signIn(email: email, password: password, register: register, name: journal.name); password = "" } } }.frame(minHeight: 44).disabled(cloud.busy || !email.contains("@") || password.count < 8)
            Button("Passwort vergessen?") { Task { await cloud.run { try await cloud.reset(email: email) } } }.frame(minHeight: 44).disabled(cloud.busy || !email.contains("@"))
        }
    }
}
