import SwiftUI
import UserNotifications
import WatchKit

extension Color {
    static let vitalisTeal = Color(red: 0x14 / 255, green: 0xA8 / 255, blue: 0x97 / 255)
    static let vitalisGreen = Color(red: 0x0C / 255, green: 0x5D / 255, blue: 0x57 / 255)
    static let sos = Color(red: 0xE1 / 255, green: 0x45 / 255, blue: 0x45 / 255)
    static let vitalisDeep = Color(red: 0x08 / 255, green: 0x45 / 255, blue: 0x40 / 255)
    static let paper = Color(red: 0xF7 / 255, green: 0xF5 / 255, blue: 0xF0 / 255)
    static let ink = Color(red: 0x13 / 255, green: 0x20 / 255, blue: 0x1F / 255)
    static let inkMuted = Color(red: 0x55 / 255, green: 0x63 / 255, blue: 0x62 / 255)
}

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
