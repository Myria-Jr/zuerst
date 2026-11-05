import Foundation
import Security
import Combine

struct CloudAccount: Decodable { let id: String; let email: String }

@MainActor
final class CloudAccountStore: ObservableObject {
    @Published var account: CloudAccount?
    @Published var busy = false
    @Published var message = ""
    private let auth = "https://ep-rapid-tooth-bav9j8t9.neonauth.c-8.eu-central-1.aws.neon.tech/zuerst/auth"
    private let api = "https://ep-rapid-tooth-bav9j8t9.apirest.c-8.eu-central-1.aws.neon.tech/zuerst/rest/v1/kitchen_backups"
    private let service = "labs.odkaz.zuerst.session"
    private let session: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.httpCookieStorage = nil; config.httpShouldSetCookies = false; config.timeoutIntervalForRequest = 20
        return URLSession(configuration: config)
    }()
    private var keyQuery: [String: Any] { [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: "session"] }
    private func cookie() -> String? {
        var query = keyQuery; query[kSecReturnData as String] = true; query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }
    private func saveCookie(_ value: String) throws {
        let update: [String:Any] = [kSecValueData as String: Data(value.utf8)]
        var status = SecItemUpdate(keyQuery as CFDictionary, update as CFDictionary)
        if status == errSecItemNotFound {
            var query = keyQuery; query[kSecValueData as String] = Data(value.utf8); query[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
            status = SecItemAdd(query as CFDictionary, nil)
        }
        guard status == errSecSuccess else { throw failure("Die Anmeldung konnte nicht sicher gespeichert werden.") }
    }
    private func failure(_ message: String) -> NSError { NSError(domain: "Zuerst", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
    private func request(_ url: String, method: String = "GET", body: [String:Any]? = nil, jwt: String? = nil) async throws -> Data {
        guard let target = URL(string: url) else { throw URLError(.badURL) }
        var request = URLRequest(url: target); request.httpMethod = method; request.cachePolicy = .reloadIgnoringLocalCacheData
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let jwt { request.setValue("Bearer \(jwt)", forHTTPHeaderField: "Authorization"); request.setValue("resolution=merge-duplicates,return=representation", forHTTPHeaderField: "Prefer") }
        else { request.setValue("https://zuerst.vercel.app", forHTTPHeaderField: "Origin"); request.setValue(cookie(), forHTTPHeaderField: "Cookie") }
        if let body { request.httpBody = try JSONSerialization.data(withJSONObject: body); request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        let (data,response) = try await session.data(for: request)
        guard let response = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
        guard (200...299).contains(response.statusCode) else {
            let code = (try? JSONSerialization.jsonObject(with: data) as? [String:Any])?["code"] as? String ?? ""
            if code == "INVALID_EMAIL_OR_PASSWORD" { throw failure("E-Mail oder Passwort stimmt nicht.") }
            if code.hasPrefix("USER_ALREADY_EXISTS") { throw failure("Für diese E-Mail gibt es bereits ein Konto. Melde dich an.") }
            throw failure(response.statusCode == 429 ? "Zu viele Versuche. Bitte warte kurz." : response.statusCode == 401 ? "Bitte melde dich erneut an." : "Die Anfrage konnte nicht abgeschlossen werden. Bitte prüfe deine Verbindung.")
        }
        if jwt == nil {
            let headers = response.allHeaderFields.reduce(into: [String:String]()) { result,pair in if let key = pair.key as? String, let value = pair.value as? String { result[key] = value } }
            if let cookie = HTTPCookie.cookies(withResponseHeaderFields: headers, for: target).first(where: { $0.name == "__Secure-neonauth.session_token" && !$0.value.isEmpty }) { try saveCookie("\(cookie.name)=\(cookie.value)") }
        }
        return data
    }
    func loadSession() async {
        guard cookie() != nil else { return }
        do { struct Response: Decodable { let user: CloudAccount? }; let data = try await request("\(auth)/get-session"); account = try JSONDecoder().decode(Response?.self, from: data)?.user }
        catch { message = "Die Anmeldung ist gerade nicht erreichbar. Dein lokales Journal ist verfügbar." }
    }
    func signIn(email: String, password: String, register: Bool, name: String) async throws {
        var body = ["email":email.trimmingCharacters(in: .whitespacesAndNewlines), "password":password]
        if register { body["name"] = name.isEmpty ? "Zuerst" : name }
        _ = try await request("\(auth)/\(register ? "sign-up" : "sign-in")/email", method: "POST", body: body)
        await loadSession()
        guard account != nil else { throw failure("Die Anmeldung konnte nicht abgeschlossen werden. Versuche es erneut.") }
        message = "Du bist angemeldet. Deine Daten bleiben lokal, bis du sie sicherst."
    }
    func signOut() async {
        _ = try? await request("\(auth)/sign-out", method: "POST", body: [:])
        SecItemDelete(keyQuery as CFDictionary); account = nil; message = "Abgemeldet. Deine lokalen Daten bleiben erhalten."
    }
    func reset(email: String) async throws {
        _ = try await request("\(auth)/request-password-reset", method: "POST", body: ["email":email, "redirectTo":"https://zuerst.vercel.app/reset/"])
        message = "Falls ein Konto besteht, erhältst du eine E-Mail zum Zurücksetzen."
    }
    private func jwt() async throws -> String {
        struct Token: Decodable { let token: String }
        let data = try await request("\(auth)/token")
        return try JSONDecoder().decode(Token.self, from: data).token
    }
    func save(_ journal: KitchenJournal) async throws {
        let token = try await jwt(); let payload = try JSONSerialization.jsonObject(with: JSONEncoder().encode(journal))
        _ = try await request("\(api)?on_conflict=user_id", method: "POST", body: ["payload":payload, "updated_at":Date.now.ISO8601Format()], jwt: token)
        message = "Deine Sicherung wurde gespeichert."
    }
    func restore(catalog: Catalog) async throws -> KitchenJournal {
        let token = try await jwt(); let data = try await request("\(api)?select=payload", jwt: token)
        guard let rows = try JSONSerialization.jsonObject(with: data) as? [[String:Any]], let payload = rows.first?["payload"] else { throw failure("Für dieses Konto ist noch keine Sicherung vorhanden.") }
        return try KitchenJournal.parse(JSONSerialization.data(withJSONObject: payload), catalog: catalog)
    }
    func removeBackup() async throws { let token = try await jwt(); _ = try await request(api, method: "DELETE", jwt: token); message = "Cloud-Sicherung gelöscht." }
    func run(_ work: () async throws -> Void) async {
        guard !busy else { return }; busy = true; message = ""
        defer { busy = false }
        do { try await work() } catch { message = (error as NSError).domain == "Zuerst" ? error.localizedDescription : "Bitte prüfe deine Verbindung und versuche es erneut." }
    }
}
