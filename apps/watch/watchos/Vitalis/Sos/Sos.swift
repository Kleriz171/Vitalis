import CoreLocation
import Foundation

enum Sos {
    struct NoLocation: Error {}

    /// Sends the SOS. reason: "button", "heart_high" or "heart_low". Returns the emergency id.
    @discardableResult
    static func send(reason: String, heartRate: Int? = nil) async throws -> String {
        let store = Store.shared
        let fix = await Locator.shared.locate() ?? store.lastFix
        guard let fix else { throw NoLocation() }
        var body: [String: Any] = ["reason": reason, "coordinates": [fix.0, fix.1]]
        if let heartRate { body["heartRate"] = heartRate }
        let res = try await Api.call("POST", "/watch/sos", body: body, key: store.key)
        return ((res["emergency"] as? [String: Any])?["_id"] as? String) ?? ""
    }
}

/// One fresh location fix (8 s at most); remembers the last one for SOS sent while offline.
@MainActor
final class Locator: NSObject, CLLocationManagerDelegate {
    static let shared = Locator()
    private let manager = CLLocationManager()
    private var waiting: CheckedContinuation<CLLocation?, Never>?

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
    }

    func requestPermission() { manager.requestWhenInUseAuthorization() }

    func locate() async -> (Double, Double)? {
        if manager.authorizationStatus == .notDetermined { manager.requestWhenInUseAuthorization() }
        let location: CLLocation? = await withCheckedContinuation { cont in
            waiting?.resume(returning: nil)
            waiting = cont
            manager.requestLocation()
            Task { @MainActor in
                try? await Task.sleep(for: .seconds(8))
                self.finish(nil)
            }
        }
        if let location {
            Store.shared.lastFix = (location.coordinate.longitude, location.coordinate.latitude)
        }
        return Store.shared.lastFix
    }

    private func finish(_ location: CLLocation?) {
        waiting?.resume(returning: location)
        waiting = nil
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        let last = locations.last
        Task { @MainActor in self.finish(last) }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in self.finish(nil) }
    }
}
