import SwiftUI

enum Screen: Hashable {
    case pair, home, countdown, areYouOk, sending(reason: String, bpm: Int?), status, medical, noLocation
}

/// One screen at a time; no navigation stack to get lost in during an emergency.
@MainActor
final class AppModel: ObservableObject {
    @Published var screen: Screen
    var lastSending: Screen?

    init() {
        let store = Store.shared
        screen = store.key == nil ? .pair : store.alert != nil ? .areYouOk : .home
        HeartAlert.onRaise = { [weak self] in self?.screen = .areYouOk }
        #if DEBUG
        // Screenshots: `-screen countdown|areYouOk|status|medical` opens that screen at launch.
        let demo = UserDefaults.standard.string(forKey: "screen")
        if demo != nil { store.alert = nil }
        switch demo {
        case "countdown": screen = .countdown
        case "areYouOk": store.alert = PendingAlert(verdict: .high, bpm: 162, at: .now); screen = .areYouOk
        case "status": screen = .status
        case "medical": screen = .medical
        default: break
        }
        #endif
    }

    /// A revoked key (unpaired from the phone) sends the watch back to pairing.
    func unpaired() {
        Store.shared.forget()
        Heart.shared.stop()
        screen = .pair
    }
}

@main
struct VitalisApp: App {
    @StateObject private var model = AppModel()
    @Environment(\.scenePhase) private var phase

    var body: some Scene {
        WindowGroup {
            RootView().environmentObject(model)
                .tint(.vitalisTeal)
        }
        .onChange(of: phase) { _, now in
            guard now == .active else { return }
            if Store.shared.alert != nil { model.screen = .areYouOk }
            Task { await Heart.shared.evaluate() }
        }
        // Woken after an unanswered "Are you OK?" deadline: send the SOS if still nobody answered.
        .backgroundTask(.appRefresh) { _ in
            await Heart.shared.evaluate()
        }
    }
}
