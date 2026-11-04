import SwiftUI
import PhotosUI
import Vision
import VisionKit

struct ReceiptView: View {
    let catalog: Catalog
    let save: ([String]) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var photo: PhotosPickerItem?
    @State private var camera = false
    @State private var busy = false
    @State private var error: String?
    @State private var draft = ""
    @State private var selected: [String] = []
    @FocusState private var editing: Bool

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 13) {
                    Text("Zuerst liest das Foto lokal. Prüfe vor dem Speichern, welche Zutaten wirklich in deinen Vorrat gehören.")
                        .foregroundStyle(.secondary)
                    JournalPanel(tint: .indigo) {
                        if VNDocumentCameraViewController.isSupported {
                            Button { camera = true } label: { Label("Bon fotografieren", systemImage: "document.viewfinder").frame(maxWidth: .infinity, minHeight: 44) }
                                .buttonStyle(.borderedProminent).buttonBorderShape(.capsule).disabled(busy)
                        }
                        PhotosPicker(selection: $photo, matching: .images) {
                            Label("Foto auswählen", systemImage: "photo").frame(maxWidth: .infinity, minHeight: 44)
                        }.buttonStyle(.bordered).buttonBorderShape(.capsule).disabled(busy)
                        if busy { ProgressView("Bon wird gelesen …") }
                        if let error { Text(error).foregroundStyle(.secondary) }
                    }
                    JournalPanel {
                        Text("Bontext einfügen").font(.headline)
                        TextField("Text vom Kassenbon", text: $draft, axis: .vertical)
                            .textFieldStyle(.roundedBorder).lineLimit(2...5).focused($editing)
                        Button("Text prüfen") { editing = false; analyze(draft); draft = "" }
                            .frame(minHeight: 44).disabled(busy || draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                    JournalPanel {
                        Text("Zutaten prüfen · \(selected.count)").font(.headline)
                        if selected.isEmpty { Text("Erkannte Zutaten erscheinen hier. Fehlende Produkte kannst du ergänzen.").foregroundStyle(.secondary) }
                        ForEach(selected, id: \.self) { id in
                            HStack {
                                Text(catalog.name(id)); Spacer()
                                Button { selected.removeAll { $0 == id } } label: {
                                    Label("\(catalog.name(id)) aus Entwurf entfernen", systemImage: "xmark.circle")
                                        .labelStyle(.iconOnly).frame(minWidth: 44, minHeight: 44)
                                }.buttonStyle(.plain)
                            }
                        }
                        IngredientLookup(catalog: catalog, excluded: selected) { selected.append($0) }
                        Button { save(selected) } label: { Text("In Vorrat übernehmen").frame(maxWidth: .infinity, minHeight: 44) }
                            .buttonStyle(.borderedProminent).buttonBorderShape(.capsule).disabled(selected.isEmpty || busy)
                    }
                }.padding(17)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(Color(uiColor: .systemGroupedBackground))
            .navigationTitle("Kassenbon")
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Schließen") { dismiss() } } }
        }
        .onChange(of: photo) { _, item in
            guard let item else { return }
            scan {
                guard let bytes = try await item.loadTransferable(type: Data.self) else { throw CocoaError(.fileReadCorruptFile) }
                return [bytes]
            }
        }
        .fullScreenCover(isPresented: $camera) {
            DocumentCamera { result in
                camera = false
                switch result {
                case .success(let images): if !images.isEmpty { scan { images } }
                case .failure: error = "Die Kamera konnte den Bon nicht erfassen. Du kannst ein Foto auswählen."
                }
            }.ignoresSafeArea()
        }
    }

    private func analyze(_ text: String) {
        let found = catalog.receipt(text)
        var present = Set(selected)
        selected += found.filter { present.insert($0).inserted }
        error = found.isEmpty ? "Keine Katalog-Zutaten erkannt. Du kannst sie unten einzeln ergänzen." : nil
    }

    private func scan(_ load: @escaping () async throws -> [Data]) {
        busy = true
        error = nil
        Task { @MainActor in
            defer { busy = false; photo = nil }
            do {
                let images = try await load()
                let text = try await Task.detached(priority: .userInitiated) { try Self.recognize(images) }.value
                analyze(text)
            } catch {
                self.error = "Das Foto konnte nicht gelesen werden. Versuche ein schärferes Foto oder füge Bontext ein."
            }
        }
    }

    nonisolated private static func recognize(_ images: [Data]) throws -> String {
        try images.map { bytes in
            let request = VNRecognizeTextRequest()
            request.recognitionLevel = .accurate
            request.recognitionLanguages = ["de-DE", "en-US"]
            request.usesLanguageCorrection = false
            try VNImageRequestHandler(data: bytes, options: [:]).perform([request])
            return (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
        }.joined(separator: "\n")
    }
}

private struct DocumentCamera: UIViewControllerRepresentable {
    let finish: (Result<[Data], Error>) -> Void

    func makeUIViewController(context: Context) -> VNDocumentCameraViewController {
        let controller = VNDocumentCameraViewController()
        controller.delegate = context.coordinator
        return controller
    }

    func updateUIViewController(_ controller: VNDocumentCameraViewController, context: Context) {}
    func makeCoordinator() -> Coordinator { Coordinator(finish: finish) }

    final class Coordinator: NSObject, VNDocumentCameraViewControllerDelegate {
        let finish: (Result<[Data], Error>) -> Void
        init(finish: @escaping (Result<[Data], Error>) -> Void) { self.finish = finish }
        func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) { finish(.success([])) }
        func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFailWithError error: Error) { finish(.failure(error)) }
        func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFinishWith scan: VNDocumentCameraScan) {
            let images = (0..<min(3, scan.pageCount)).compactMap { scan.imageOfPage(at: $0).jpegData(compressionQuality: 0.85) }
            finish(.success(images))
        }
    }
}
