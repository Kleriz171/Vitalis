import SwiftUI
import WatchKit

struct AreYouOkView: View {
    @EnvironmentObject var model: AppModel
    @State private var left = 30

    var body: some View {
        let pending = Store.shared.alert
        VStack(spacing: 6) {
            // Beats at the rate that raised the alert.
            BeatingHeart(bpm: pending?.bpm ?? 60).scaleEffect(1.25)
            Text("Are you OK?").font(.system(size: 20, weight: .heavy))
            if let pending {
                Text("Resting heart rate \(pending.bpm) bpm").font(.system(size: 12)).multilineTextAlignment(.center)
                    .foregroundStyle(.white.opacity(0.75)).fixedSize(horizontal: false, vertical: true)
            }
            Button("I'm OK") {
                HeartAlert.clear(quiet: 30 * 60)
                model.screen = .home
            }
            .buttonStyle(SolidStyle())
            Text("SOS in \(left) s").font(.system(size: 13, weight: .bold)).foregroundStyle(Color.sos).monospacedDigit().contentTransition(.numericText())
        }
        .padding(.horizontal, 6)
        .task {
            guard let pending else { model.screen = .home; return }
            while !Task.isCancelled {
                left = max(0, Int(pending.deadline.timeIntervalSinceNow.rounded(.up)))
                if left == 0 {
                    model.screen = .sending(reason: HeartAlert.reason(pending.verdict), bpm: pending.bpm)
                    return
                }
                if left % 5 == 0 { WKInterfaceDevice.current().play(.notification) }
                try? await Task.sleep(for: .milliseconds(500))
            }
        }
    }
}
