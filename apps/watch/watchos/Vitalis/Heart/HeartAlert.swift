import Foundation
import UserNotifications
import WatchKit

/// "Are you OK?": a buzzing notification and a 30 s countdown on screen, then the SOS.
enum HeartAlert {
    static let answerSeconds: TimeInterval = 30
    static let notificationId = "heart-alert"

    @MainActor static var onRaise: (() -> Void)?

    static func raise(_ verdict: HeartVerdict, bpm: Int) async {
        Store.shared.alert = PendingAlert(verdict: verdict, bpm: bpm, at: Date())
        let content = UNMutableNotificationContent()
        content.title = String(localized: "Are you OK?")
        content.body = String(localized: "Your heart rate is \(bpm) bpm while resting. No answer in 30 s sends an SOS.")
        content.sound = .defaultCritical
        content.interruptionLevel = .timeSensitive
        content.categoryIdentifier = "heart"
        try? await UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: notificationId, content: content, trigger: nil))
        await MainActor.run {
            // Wake again just after the deadline in case nobody opens the app.
            WKApplication.shared().scheduleBackgroundRefresh(withPreferredDate: Date().addingTimeInterval(answerSeconds + 5), userInfo: nil) { _ in }
            WKInterfaceDevice.current().play(.notification)
            onRaise?()
        }
    }

    static func clear(quiet: TimeInterval = 0) {
        Store.shared.alert = nil
        if quiet > 0 { Store.shared.quietUntil = Date().addingTimeInterval(quiet) }
        UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: [notificationId])
    }

    static func reason(_ v: HeartVerdict) -> String { v == .high ? "heart_high" : "heart_low" }

    static func sendOverdue(_ pending: PendingAlert) async {
        if (try? await Sos.send(reason: reason(pending.verdict), heartRate: pending.bpm)) != nil { clear() }
    }
}
