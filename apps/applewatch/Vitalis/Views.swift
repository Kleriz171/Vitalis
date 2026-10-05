import SwiftUI
import WatchKit

struct RootView: View {
    @EnvironmentObject var model: AppModel

    var body: some View {
        switch model.screen {
        case .pair: PairView()
        case .home: HomeView()
        case .countdown: CountdownView()
        case .areYouOk: AreYouOkView()
        case let .sending(reason, bpm): SendingView(reason: reason, bpm: bpm)
        case .status: StatusView()
        case .medical: MedicalView()
        case .noLocation: NoLocationView()
        }
    }
}

// MARK: Pairing

struct PairView: View {
    @EnvironmentObject var model: AppModel
    @State private var code: String?
    @State private var offline = false

    var body: some View {
        VStack(spacing: 6) {
            Text("VITALIS").font(.system(size: 12, weight: .bold)).tracking(2).foregroundStyle(Color.vitalisTeal)
            Text(code.map { "\($0.prefix(3)) \($0.suffix(3))" } ?? "··· ···")
                .font(.system(size: 34, weight: .bold, design: .rounded)).monospacedDigit()
                .accessibilityLabel(code.map { $0.map(String.init).joined(separator: " ") } ?? "")
            Text(offline ? "No connection. Trying again…" : "Type this code in Vitalis on your phone: Profile → Watch.")
                .font(.footnote).multilineTextAlignment(.center).foregroundStyle(.secondary)
        }
        .padding(.horizontal, 6)
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

// MARK: Home

struct HomeView: View {
    @EnvironmentObject var model: AppModel
    @State private var heartOn = Store.shared.heartOn
    @State private var bpm: Int?

    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                HoldSosButton { model.screen = .countdown }
                    .padding(.top, 4)
                Toggle(isOn: $heartOn) {
                    VStack(alignment: .leading, spacing: 1) {
                        Label("Heart check", systemImage: "heart.text.square").font(.headline)
                        Text(heartOn ? (bpm.map { "\($0) bpm" } ?? String(localized: "On")) : String(localized: "Off"))
                            .font(.footnote).foregroundStyle(.secondary)
                    }
                }
                .onChange(of: heartOn) { _, on in
                    Store.shared.heartOn = on
                    if on { Task { _ = await Heart.shared.requestAccess(); Heart.shared.start() } } else { Heart.shared.stop() }
                }
                Button { model.screen = .medical } label: { Label("Medical ID", systemImage: "staroflife.fill") }
                Call127Button()
                #if DEBUG
                Button("Test: high heart rate") { Task { await Heart.shared.simulate(bpm: 172) } }
                    .font(.footnote).foregroundStyle(.secondary)
                #endif
                if let name = Store.shared.name { Text(name).font(.footnote).foregroundStyle(.secondary) }
            }
        }
        .task {
            Locator.shared.requestPermission()
            if heartOn, await Heart.shared.requestAccess() { Heart.shared.start() }
            bpm = await Heart.shared.latestBpm()
            _ = await Locator.shared.locate() // keep a recent position for an SOS sent while closed
            // An SOS already running (from here or the phone)? Go straight to its status.
            do {
                let res = try await Api.call("GET", "/watch/sos", key: Store.shared.key)
                if res["emergency"] is [String: Any] { model.screen = .status }
            } catch let e as Api.HTTPError where e.code == 401 { model.unpaired() } catch {}
        }
    }
}

/// Press and hold for 3 s while a ring fills; letting go early cancels.
struct HoldSosButton: View {
    let onSos: () -> Void
    @State private var progress: CGFloat = 0

    var body: some View {
        ZStack {
            Circle().fill(Color.sos)
            Circle().trim(from: 0, to: progress)
                .stroke(.white, style: StrokeStyle(lineWidth: 5, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .padding(4)
            VStack(spacing: 0) {
                Text("SOS").font(.system(size: 28, weight: .black, design: .rounded))
                Text("hold").font(.caption2).opacity(0.85)
            }
            .foregroundStyle(.white)
        }
        .frame(width: 110, height: 110)
        .accessibilityLabel(Text("Hold for 3 seconds to send an SOS"))
        .onLongPressGesture(minimumDuration: 3, maximumDistance: 30) {
            WKInterfaceDevice.current().play(.start)
            onSos()
        } onPressingChanged: { pressing in
            if pressing {
                withAnimation(.linear(duration: 3)) { progress = 1 }
            } else {
                withAnimation(.easeOut(duration: 0.2)) { progress = 0 }
            }
        }
    }
}

struct Call127Button: View {
    var body: some View {
        // Dial, not call: the person confirms. Watches without their own SIM hand it to the iPhone.
        Button { WKApplication.shared().openSystemURL(URL(string: "tel:127")!) } label: {
            Label("Call 127", systemImage: "phone.fill")
        }
    }
}

// MARK: SOS

struct CountdownView: View {
    @EnvironmentObject var model: AppModel
    @State private var left = 3

    var body: some View {
        ZStack {
            Color.sos.ignoresSafeArea()
            VStack(spacing: 4) {
                Text("Sending SOS in").font(.footnote)
                Text("\(left)").font(.system(size: 56, weight: .black, design: .rounded)).contentTransition(.numericText())
                Button("Cancel") { model.screen = .home }
                    .foregroundStyle(Color.sos).buttonStyle(.borderedProminent).tint(.white)
            }
            .foregroundStyle(.white)
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

struct AreYouOkView: View {
    @EnvironmentObject var model: AppModel
    @State private var left = 30

    var body: some View {
        let pending = Store.shared.alert
        VStack(spacing: 6) {
            Text("Are you OK?").font(.title3.bold())
            if let pending {
                Text("Your heart rate is \(pending.bpm) bpm while resting.").font(.footnote).multilineTextAlignment(.center).foregroundStyle(.secondary)
            }
            Button("I'm OK") {
                HeartAlert.clear(quiet: 30 * 60)
                model.screen = .home
            }
            .buttonStyle(.borderedProminent).tint(.vitalisTeal)
            Text("SOS in \(left) s").font(.footnote.bold()).foregroundStyle(Color.sos).monospacedDigit()
        }
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
        ScrollView {
            VStack(spacing: 8) {
                Text(status == "on_scene" ? "Help is with you" : status == "assigned" || status == "en_route" ? "Help is coming" : "SOS sent. Finding help.")
                    .font(.headline).multilineTextAlignment(.center)
                    .foregroundStyle(status == nil || status == "pending" ? Color.primary : Color.vitalisTeal)
                if let responder, status != "pending" { Text(responder).font(.footnote).foregroundStyle(.secondary) }
                if let eta, eta > 0, status == "assigned" || status == "en_route" {
                    Text("~\((eta + 59) / 60) min").font(.system(size: 30, weight: .bold, design: .rounded))
                }
                if status == nil || status == "pending" {
                    Text("Stay where you are if it is safe.").font(.footnote).foregroundStyle(.secondary).multilineTextAlignment(.center)
                }
                Call127Button()
                Button(confirmCancel ? "Tap again to cancel" : "I'm OK, cancel SOS") {
                    guard confirmCancel, let id = emergency?["_id"] as? String else { confirmCancel = true; return }
                    Task {
                        if (try? await Api.call("POST", "/watch/sos/\(id)/cancel", key: Store.shared.key)) != nil { model.screen = .home }
                    }
                }
                .foregroundStyle(.secondary)
            }
        }
        .task {
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
                Text("Could not find your location. Call 127 and say where you are.").multilineTextAlignment(.center)
                Call127Button()
                Button("Try again") { model.screen = model.lastSending ?? .home }
            }
        }
    }
}

// MARK: Medical ID

struct MedicalView: View {
    @EnvironmentObject var model: AppModel
    @State private var lines = Store.shared.medical

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 6) {
                Label("Medical ID", systemImage: "staroflife.fill").font(.footnote.bold()).foregroundStyle(Color.sos)
                if lines.isEmpty { Text("Loading…").foregroundStyle(.secondary) }
                ForEach(Array(lines.enumerated()), id: \.offset) { i, line in
                    Text(i == 0 ? line.replacingOccurrences(of: "VITALIS · ", with: "") : line)
                        .font(i == 0 ? .headline : .body)
                }
                Button("Back") { model.screen = .home }.padding(.top, 6)
            }
        }
        .task {
            // The cached copy shows at once and works offline; refresh it when we can.
            do {
                let res = try await Api.call("GET", "/watch/medical-id", key: Store.shared.key)
                if let fresh = res["lines"] as? [String] { lines = fresh; Store.shared.medical = fresh }
            } catch let e as Api.HTTPError where e.code == 401 { model.unpaired() } catch {}
        }
    }
}
