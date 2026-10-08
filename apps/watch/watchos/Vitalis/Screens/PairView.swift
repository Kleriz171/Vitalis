import SwiftUI
import WatchKit

struct PairView: View {
    @EnvironmentObject var model: AppModel
    @State private var code: String?
    @State private var offline = false

    var body: some View {
        VStack(spacing: 8) {
            BrandMark()
            Text(code.map { "\($0.prefix(3)) \($0.suffix(3))" } ?? "··· ···")
                .font(.system(size: 36, weight: .heavy, design: .rounded)).monospacedDigit()
                .foregroundStyle(.white)
                .contentTransition(.numericText())
                .accessibilityLabel(code.map { $0.map(String.init).joined(separator: " ") } ?? "")
            Text(offline ? "No connection. Trying again…" : "Type this code in Vitalis on your phone: Profile → Watch.")
                .font(.system(size: 13)).multilineTextAlignment(.center).foregroundStyle(.white.opacity(0.75))
        }
        .padding(.horizontal, 8)
        .task { await pairLoop() }
    }

    private func pairLoop() async {
        while !Task.isCancelled {
            do {
                offline = false
                let start = try await Api.call("POST", "/watch/pair/start", body: ["name": WKInterfaceDevice.current().name])
                code = start["code"] as? String
                let pairId = start["pairId"] as? String ?? ""
                while !Task.isCancelled {
                    try await Task.sleep(for: .seconds(3))
                    let poll = try await Api.call("POST", "/watch/pair/poll", body: ["pairId": pairId])
                    if poll["status"] as? String == "paired" {
                        Store.shared.key = poll["token"] as? String
                        Store.shared.name = poll["name"] as? String
                        model.screen = .home
                        return
                    }
                }
            } catch let e as Api.HTTPError where e.code == 404 {
                continue // code expired: start over with a new one
            } catch {
                offline = true
                try? await Task.sleep(for: .seconds(5))
            }
        }
    }
}
