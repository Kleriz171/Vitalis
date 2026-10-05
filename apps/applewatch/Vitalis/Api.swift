import Foundation

/// The Vitalis API. Paired calls carry the watch key ("Authorization: Watch <key>").
enum Api {
    static let base = (Bundle.main.object(forInfoDictionaryKey: "VitalisAPIURL") as? String) ?? "http://localhost:4000/api"

    struct HTTPError: Error { let code: Int; let message: String }

    static func call(_ method: String, _ path: String, body: [String: Any]? = nil, key: String? = nil) async throws -> [String: Any] {
        var req = URLRequest(url: URL(string: base + path)!)
        req.httpMethod = method
        req.timeoutInterval = 15
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let key { req.setValue("Watch \(key)", forHTTPHeaderField: "Authorization") }
        if let body { req.httpBody = try JSONSerialization.data(withJSONObject: body) }
        let (data, response) = try await URLSession.shared.data(for: req)
        let code = (response as? HTTPURLResponse)?.statusCode ?? 0
        let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        if code >= 400 { throw HTTPError(code: code, message: json["error"] as? String ?? "HTTP \(code)") }
        return json
    }
}
