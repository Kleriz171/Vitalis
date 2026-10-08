import SwiftUI
import WatchKit

// The SOS flow: countdown → sending → live status (or no location).

struct CountdownView: View {
    @EnvironmentObject var model: AppModel
    @State private var left = 3

    var body: some View {
        ZStack {
            Color.sos.ignoresSafeArea()
            VStack(spacing: 8) {
                ZStack {
                    Circle().stroke(.white.opacity(0.25), lineWidth: 6)
                    Circle().trim(from: 0, to: CGFloat(left) / 3)
                        .stroke(.white, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                        .animation(.linear(duration: 1), value: left)
                    Text("\(left)").font(.system(size: 48, weight: .black, design: .rounded)).contentTransition(.numericText())
                }
                .frame(width: 96, height: 96)
                Text("Sending SOS").font(.system(size: 14, weight: .semibold))
                Button("Cancel") { model.screen = .home }.buttonStyle(SolidStyle(fill: .white, text: .sos))
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 8)
        }
        .task {
            while left > 0 {
                try? await Task.sleep(for: .seconds(1))
                guard !Task.isCancelled else { return }
                WKInterfaceDevice.current().play(.click)
                withAnimation { left -= 1 }
            }
            model.screen = .sending(reason: "button", bpm: nil)
        }
    }
}

struct SendingView: View {
    @EnvironmentObject var model: AppModel
    let reason: String
    let bpm: Int?
    @State private var failed = false

    var body: some View {
        VStack(spacing: 8) {
            ProgressView().tint(.sos)
            Text(failed ? "No connection. Retrying…" : "Sending SOS…")
            if failed { Call127Button() }
        }
        .task {
            model.lastSending = .sending(reason: reason, bpm: bpm)
            // Keep trying: an SOS that fails once on a flaky connection must not just give up.
            while !Task.isCancelled {
                do {
                    try await Sos.send(reason: reason, heartRate: bpm)
                    HeartAlert.clear()
                    WKInterfaceDevice.current().play(.success)
                    model.screen = .status
                    return
                } catch is Sos.NoLocation {
                    model.screen = .noLocation
                    return
                } catch let e as Api.HTTPError where e.code == 401 {
                    model.unpaired()
                    return
                } catch {
                    failed = true
                }
                try? await Task.sleep(for: .seconds(3))
            }
        }
    }
}

struct StatusView: View {
    @EnvironmentObject var model: AppModel
    @State private var emergency: [String: Any]?
    @State private var confirmCancel = false

    var body: some View {
        let status = emergency?["status"] as? String
        let responder = (emergency?["responder"] as? [String: Any])?["name"] as? String
        let eta = (emergency?["etaSeconds"] as? NSNumber)?.intValue
        let step = ["pending", "assigned", "en_route", "on_scene"].firstIndex(of: status ?? "pending") ?? 0
        ScrollView {
            VStack(spacing: 8) {
                IconTile(symbol: step == 0 ? "antenna.radiowaves.left.and.right" : step == 3 ? "cross.case.fill" : "figure.run", tint: step == 0 ? .sos : .vitalisTeal)
                Text(step == 3 ? "Help is with you" : step >= 1 ? "Help is coming" : "SOS sent. Finding help.")
                    .font(.system(size: 17, weight: .heavy)).multilineTextAlignment(.center)
                // Received, accepted, on the way, on scene.
                HStack(spacing: 3) {
                    ForEach(0..<4) { i in
                        Capsule().fill(i <= step ? (step == 0 ? Color.sos : Color.vitalisTeal) : Color.white.opacity(0.15)).frame(height: 4)
                    }
                }
                .padding(.horizontal, 12)
                .animation(.easeOut(duration: 0.4), value: step)
                if let eta, eta > 0, step == 1 || step == 2 {
                    Text("~\((eta + 59) / 60) min").font(.system(size: 30, weight: .heavy, design: .rounded)).foregroundStyle(.white)
                }
                if let responder, step >= 1 { Text(responder).font(.system(size: 13)).foregroundStyle(.white.opacity(0.75)) }
                if step == 0 {
                    Text("Stay where you are if it is safe.").font(.system(size: 12)).foregroundStyle(.secondary).multilineTextAlignment(.center)
                }
                Call127Button()
                Button {
                    guard confirmCancel, let id = emergency?["_id"] as? String else { confirmCancel = true; return }
                    Task {
                        if (try? await Api.call("POST", "/watch/sos/\(id)/cancel", key: Store.shared.key)) != nil { model.screen = .home }
                    }
                } label: {
                    CardRow(symbol: "xmark", tint: confirmCancel ? .sos : .gray, title: confirmCancel ? "Tap again to cancel" : "I'm OK, cancel SOS") { EmptyView() }
                }
                .buttonStyle(CardStyle())
            }
            .padding(.horizontal, 2)
        }
        .task {
            #if DEBUG
            // Screenshots: `-demoStatus en_route` shows that step with a sample responder, no API.
            if let s = UserDefaults.standard.string(forKey: "demoStatus") {
                emergency = ["_id": "demo", "status": s, "etaSeconds": 240, "responder": ["name": "Arben K."]]
                return
            }
            #endif
            while !Task.isCancelled {
                do {
                    let res = try await Api.call("GET", "/watch/sos", key: Store.shared.key)
                    guard let e = res["emergency"] as? [String: Any] else { model.screen = .home; return }
                    emergency = e
                } catch let e as Api.HTTPError where e.code == 401 {
                    model.unpaired(); return
                } catch {} // offline: keep the last state and try again
                try? await Task.sleep(for: .seconds(5))
            }
        }
    }
}

struct NoLocationView: View {
    @EnvironmentObject var model: AppModel
    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                Text("Could not find your location. Call 127 and say where you are.").font(.system(size: 14)).multilineTextAlignment(.center)
                Call127Button()
                Button("Try again") { model.screen = model.lastSending ?? .home }.buttonStyle(SolidStyle(fill: .white.opacity(0.15)))
            }
        }
    }
}
