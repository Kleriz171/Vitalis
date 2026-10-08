import Foundation
import Security

/// What the watch remembers. The key lives in the Keychain; everything else in UserDefaults.
final class Store {
    static let shared = Store()
    private let d = UserDefaults.standard

    var key: String? {
        get { Keychain.read("watch-key") }
        set { Keychain.write("watch-key", newValue) }
    }
    var name: String? {
        get { d.string(forKey: "name") }
        set { d.set(newValue, forKey: "name") }
    }
    var heartOn: Bool {
        get { d.object(forKey: "heartOn") as? Bool ?? true }
        set { d.set(newValue, forKey: "heartOn") }
    }
    var medical: [String] {
        get { d.stringArray(forKey: "medical") ?? [] }
        set { d.set(newValue, forKey: "medical") }
    }
    /// Last known position as (longitude, latitude), refreshed whenever the watch gets a fix.
    var lastFix: (Double, Double)? {
        get { (d.array(forKey: "fix") as? [Double]).flatMap { $0.count == 2 ? ($0[0], $0[1]) : nil } }
        set { d.set(newValue.map { [$0.0, $0.1] }, forKey: "fix") }
    }
    /// An unanswered "Are you OK?".
    var alert: PendingAlert? {
        get { d.data(forKey: "alert").flatMap { try? JSONDecoder().decode(PendingAlert.self, from: $0) } }
        set { d.set(newValue.flatMap { try? JSONEncoder().encode($0) }, forKey: "alert") }
    }
    /// No new heart alert before this time (after "I'm OK").
    var quietUntil: Date {
        get { d.object(forKey: "quietUntil") as? Date ?? .distantPast }
        set { d.set(newValue, forKey: "quietUntil") }
    }

    func forget() {
        key = nil
        for k in ["name", "medical", "fix", "alert", "quietUntil"] { d.removeObject(forKey: k) }
    }
}

struct PendingAlert: Codable {
    let verdict: HeartVerdict
    let bpm: Int
    let at: Date
    var deadline: Date { at.addingTimeInterval(HeartAlert.answerSeconds) }
}

enum Keychain {
    private static let service = "dev.vitalis.watch"

    static func read(_ account: String) -> String? {
        let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
                                kSecAttrAccount as String: account, kSecReturnData as String: true]
        var out: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let data = out as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func write(_ account: String, _ value: String?) {
        let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
                                kSecAttrAccount as String: account]
        SecItemDelete(q as CFDictionary)
        guard let value else { return }
        var add = q
        add[kSecValueData as String] = Data(value.utf8)
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(add as CFDictionary, nil)
    }
}
