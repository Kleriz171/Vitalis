import SwiftUI

struct HomeView: View {
    @EnvironmentObject var model: AppModel
    private var chevron: some View { Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(.secondary) }
    @State private var heartOn = Store.shared.heartOn
    @State private var readings: [(at: Date, bpm: Int)] = []
    @State private var shown = false

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                HoldSosButton { model.screen = .countdown }
                    .padding(.vertical, 6)
                    .rise(shown, 0)
                HeartCard(on: $heartOn, readings: readings).rise(shown, 1)
                Button { model.screen = .medical } label: {
                    CardRow(symbol: "staroflife.fill", tint: .sos, title: "Medical ID", subtitle: Store.shared.medical.dropFirst().first) { chevron }
                }
                .buttonStyle(CardStyle())
                .rise(shown, 2)
                Call127Button().rise(shown, 3)
                #if DEBUG
                Button("Test: high heart rate") { Task { await Heart.shared.simulate(bpm: 172); readings = await Heart.shared.recent() } }
                    .font(.system(size: 12)).foregroundStyle(.white.opacity(0.7)).buttonStyle(.plain).padding(.top, 4)
                #endif
                if let name = Store.shared.name {
                    Text(name).font(.system(size: 12)).foregroundStyle(.white.opacity(0.7)).padding(.top, 2).rise(shown, 4)
                }
            }
            .padding(.horizontal, 2)
        }
        .onAppear { shown = true }
        .onChange(of: heartOn) { _, on in
            Store.shared.heartOn = on
            if on { Task { _ = await Heart.shared.requestAccess(); Heart.shared.start() } } else { Heart.shared.stop() }
        }
        .task {
            Locator.shared.requestPermission()
            if heartOn, await Heart.shared.requestAccess() { Heart.shared.start() }
            readings = await Heart.shared.recent()
            _ = await Locator.shared.locate() // keep a recent position for an SOS sent while closed
            // An SOS already running (from here or the phone)? Go straight to its status.
            do {
                let res = try await Api.call("GET", "/watch/sos", key: Store.shared.key)
                if res["emergency"] is [String: Any] { model.screen = .status }
            } catch let e as Api.HTTPError where e.code == 401 { model.unpaired() } catch {}
        }
    }
}
