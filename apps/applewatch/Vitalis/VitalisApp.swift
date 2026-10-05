import SwiftUI
import UserNotifications
import WatchKit

extension Color {
    static let vitalisTeal = Color(red: 0x14 / 255, green: 0xA8 / 255, blue: 0x97 / 255)
    static let vitalisGreen = Color(red: 0x0C / 255, green: 0x5D / 255, blue: 0x57 / 255)
    static let sos = Color(red: 0xE1 / 255, green: 0x45 / 255, blue: 0x45 / 255)
}

enum Screen: Equatable {
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
