import SwiftUI
import WatchKit

struct RootView: View {
    @EnvironmentObject var model: AppModel

    var body: some View {
        ZStack {
            // The phone app's deep-green screen colour, darkening toward the bottom.
            LinearGradient(colors: [.vitalisGreen, .vitalisDeep], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
            screen
                .id(model.screen)
                .transition(.asymmetric(insertion: .opacity.combined(with: .scale(scale: 0.94)), removal: .opacity))
        }
        .animation(.easeOut(duration: 0.35), value: model.screen)
    }

    @ViewBuilder private var screen: some View {
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


// MARK: Design kit — the phone app's language, made for the wrist: dark Vitalis-green chips,
// round tinted icon tiles, teal for live and selected, red only for SOS.

extension Color {
    // Cards are the phone app's off-white on the green screen.
    static let chip = Color.paper
    static let chipPressed = Color(red: 0xE6 / 255, green: 0xE2 / 255, blue: 0xD8 / 255)
    static let tealSoft = Color(red: 0x14 / 255, green: 0xA8 / 255, blue: 0x97 / 255).opacity(0.18)
    static let sosSoft = Color(red: 0xE1 / 255, green: 0x45 / 255, blue: 0x45 / 255).opacity(0.2)
}

/// Round icon tile, like the phone app's row icons.
struct IconTile: View {
    let symbol: String
    var tint: Color = .vitalisTeal
    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(tint)
            .frame(width: 32, height: 32)
            .background(Circle().fill(tint.opacity(0.14)))
    }
}

/// A full-width row: icon tile, title, one line under it, and whatever sits on the right.
struct ChipRow<Trailing: View>: View {
    let symbol: String
    var tint: Color = .vitalisTeal
    let title: LocalizedStringKey
    var subtitle: String?
    @ViewBuilder var trailing: () -> Trailing
    var body: some View {
        HStack(spacing: 10) {
            IconTile(symbol: symbol, tint: tint)
            VStack(alignment: .leading, spacing: 1) {
                Text(title).font(.system(size: 15, weight: .semibold)).foregroundStyle(Color.ink).lineLimit(1).minimumScaleFactor(0.8)
                if let subtitle { Text(subtitle).font(.system(size: 12)).foregroundStyle(Color.inkMuted).lineLimit(1) }
            }
            Spacer(minLength: 0)
            trailing()
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity, minHeight: 52, alignment: .leading)
    }
}

/// Chip look for buttons: dark green capsule that brightens while pressed.
struct ChipStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(RoundedRectangle(cornerRadius: 22, style: .continuous).fill(configuration.isPressed ? Color.chipPressed : Color.chip))
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
    }
}

/// Big filled action (I'm OK, Cancel): solid colour, white text.
struct SolidStyle: ButtonStyle {
    var fill: Color = .vitalisTeal
    var text: Color = .white
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 16, weight: .bold))
            .foregroundStyle(text)
            .frame(maxWidth: .infinity, minHeight: 46)
            .background(Capsule().fill(fill))
            .opacity(configuration.isPressed ? 0.85 : 1)
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
    }
}

/// Items rise in one after another when a screen opens.
struct Rise: ViewModifier {
    let shown: Bool
    let order: Int
    func body(content: Content) -> some View {
        content
            .opacity(shown ? 1 : 0)
            .offset(y: shown ? 0 : 14)
            .animation(.easeOut(duration: 0.5).delay(Double(order) * 0.08), value: shown)
    }
}
extension View { func rise(_ shown: Bool, _ order: Int) -> some View { modifier(Rise(shown: shown, order: order)) } }

/// The heart card: the latest resting rate, a heart beating at that rate, and the last hours.
struct HeartCard: View {
    @Binding var on: Bool
    let readings: [(at: Date, bpm: Int)]

    var body: some View {
        let last = readings.last
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .center, spacing: 8) {
                BeatingHeart(bpm: on ? last?.bpm : nil)
                VStack(alignment: .leading, spacing: 0) {
                    HStack(alignment: .firstTextBaseline, spacing: 3) {
                        Text(on ? (last.map { "\($0.bpm)" } ?? "--") : "Off")
                            .font(.system(size: 28, weight: .heavy, design: .rounded)).monospacedDigit()
                            .contentTransition(.numericText())
                        if on, last != nil { Text("bpm").font(.system(size: 12, weight: .semibold)).foregroundStyle(Color.inkMuted) }
                    }
                    .foregroundStyle(Color.ink)
                    Text(on ? (last.map { String(localized: "Resting · \($0.at.formatted(.relative(presentation: .named)))") } ?? String(localized: "Waiting for a reading")) : String(localized: "Heart check is off"))
                        .font(.system(size: 11)).foregroundStyle(Color.inkMuted).lineLimit(1)
                }
                Spacer(minLength: 0)
                Toggle("", isOn: $on).labelsHidden().tint(.vitalisTeal).fixedSize().scaleEffect(0.8)
            }
            if on, readings.count >= 2 { Sparkline(points: readings.map(\.bpm)).frame(height: 30) }
        }
        .padding(10)
        .background(RoundedRectangle(cornerRadius: 22, style: .continuous).fill(Color.chip))
    }
}

/// A heart that beats at the given rate (a calm idle pulse when there is none).
struct BeatingHeart: View {
    let bpm: Int?
    var body: some View {
        TimelineView(.animation) { ctx in
            let period = 60.0 / Double(max(40, min(bpm ?? 60, 180)))
            let t = ctx.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: period) / period
            // Two quick beats per cycle, like a real pulse ("lub-dub").
            let beat = max(0, sin(t * .pi * 2 * 2)) * (t < 0.5 ? 1 : 0.5)
            Image(systemName: "heart.fill")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(bpm == nil ? Color.inkMuted : Color.sos)
                .scaleEffect(1 + (bpm == nil ? 0 : beat * 0.18))
                .frame(width: 34, height: 34)
                .background(Circle().fill((bpm == nil ? Color.inkMuted : Color.sos).opacity(0.13)))
        }
    }
}

/// Resting heart rate over the last hours: a smooth teal line ending in a dot.
struct Sparkline: View {
    let points: [Int]
    @State private var drawn: CGFloat = 0
    var body: some View {
        GeometryReader { g in
            let lo = Double(points.min() ?? 0) - 3, hi = Double(points.max() ?? 1) + 3
            let xy: [CGPoint] = points.enumerated().map { i, v in
                CGPoint(x: g.size.width * CGFloat(i) / CGFloat(max(points.count - 1, 1)),
                        y: g.size.height * (1 - CGFloat((Double(v) - lo) / max(hi - lo, 1))))
            }
            ZStack(alignment: .topLeading) {
                Path { p in
                    guard let first = xy.first else { return }
                    p.move(to: first)
                    for (a, b) in zip(xy, xy.dropFirst()) {
                        let mid = CGPoint(x: (a.x + b.x) / 2, y: (a.y + b.y) / 2)
                        p.addQuadCurve(to: mid, control: a)
                    }
                    if let last = xy.last { p.addLine(to: last) }
                }
                .trim(from: 0, to: drawn)
                .stroke(Color.vitalisTeal, style: StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round))
                if let last = xy.last {
                    Circle().fill(Color.vitalisTeal).frame(width: 7, height: 7).position(last).opacity(drawn)
                }
            }
        }
        .onAppear { withAnimation(.easeOut(duration: 0.9).delay(0.3)) { drawn = 1 } }
    }
}

struct BrandMark: View {
    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "heart.fill").font(.system(size: 11, weight: .bold)).foregroundStyle(.white)
                .frame(width: 20, height: 20).background(RoundedRectangle(cornerRadius: 6).fill(Color.vitalisTeal))
            Text("Vitalis").font(.system(size: 14, weight: .heavy))
        }
    }
}

// MARK: Pairing

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

// MARK: Home

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
                    ChipRow(symbol: "staroflife.fill", tint: .sos, title: "Medical ID", subtitle: Store.shared.medical.dropFirst().first) { chevron }
                }
                .buttonStyle(ChipStyle())
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

/// Press and hold for 3 s while a ring fills; letting go early cancels.
struct HoldSosButton: View {
    let onSos: () -> Void
    @State private var progress: CGFloat = 0
    @State private var breathe = false
    @State private var ticker: Task<Void, Never>?

    var body: some View {
        ZStack {
            Circle().fill(Color.sos.opacity(0.22)).frame(width: 118, height: 118)
                .scaleEffect(breathe ? 1.04 : 0.92)
                .opacity(breathe ? 0.6 : 1)
                .animation(.easeInOut(duration: 1.6).repeatForever(autoreverses: true), value: breathe)
            Circle().fill(LinearGradient(colors: [Color(red: 0.93, green: 0.33, blue: 0.33), .sos], startPoint: .top, endPoint: .bottom))
                .frame(width: 98, height: 98)
                .shadow(color: .sos.opacity(0.45), radius: 10)
            Circle().trim(from: 0, to: progress)
                .stroke(.white, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .frame(width: 110, height: 110)
            VStack(spacing: -2) {
                Text("SOS").font(.system(size: 30, weight: .black, design: .rounded))
                Text("hold").font(.system(size: 11, weight: .semibold)).opacity(0.85)
            }
            .foregroundStyle(.white)
        }
        .frame(width: 120, height: 120)
        .scaleEffect(progress > 0 ? 0.95 : 1)
        .animation(.easeOut(duration: 0.2), value: progress > 0)
        .onAppear { breathe = true }
        .accessibilityLabel(Text("Hold for 3 seconds to send an SOS"))
        .onLongPressGesture(minimumDuration: 3, maximumDistance: 30) {
            WKInterfaceDevice.current().play(.start)
            onSos()
        } onPressingChanged: { pressing in
            if pressing {
                withAnimation(.linear(duration: 3)) { progress = 1 }
                // A tick each second while the ring fills, so you feel it without looking.
                ticker = Task { for _ in 0..<2 { try? await Task.sleep(for: .seconds(1)); if Task.isCancelled { return }; WKInterfaceDevice.current().play(.click) } }
            } else {
                ticker?.cancel()
                withAnimation(.easeOut(duration: 0.25)) { progress = 0 }
            }
        }
    }
}

struct Call127Button: View {
    var body: some View {
        // Dial, not call: the person confirms. Watches without their own SIM hand it to the iPhone.
        Button { WKApplication.shared().openSystemURL(URL(string: "tel:127")!) } label: {
            ChipRow(symbol: "phone.fill", tint: .vitalisTeal, title: "Call 127", subtitle: String(localized: "Ambulance")) { EmptyView() }
        }
        .buttonStyle(ChipStyle())
    }
}

// MARK: SOS

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

struct AreYouOkView: View {
    @EnvironmentObject var model: AppModel
    @State private var left = 30

    var body: some View {
        let pending = Store.shared.alert
        VStack(spacing: 6) {
            Image(systemName: "heart.fill").font(.system(size: 30)).foregroundStyle(Color.sos)
                .symbolEffect(.pulse, options: .repeating)
            Text("Are you OK?").font(.system(size: 20, weight: .heavy))
            if let pending {
                Text("Your heart rate is \(pending.bpm) bpm while resting.").font(.system(size: 12)).multilineTextAlignment(.center).foregroundStyle(.secondary)
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
                    ChipRow(symbol: "xmark", tint: confirmCancel ? .sos : .gray, title: confirmCancel ? "Tap again to cancel" : "I'm OK, cancel SOS") { EmptyView() }
                }
                .buttonStyle(ChipStyle())
            }
            .padding(.horizontal, 2)
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
                HStack(spacing: 8) {
                    IconTile(symbol: "staroflife.fill", tint: .sos)
                    VStack(alignment: .leading, spacing: 0) {
                        Text("Medical ID").font(.system(size: 12, weight: .bold)).foregroundStyle(Color.sos)
                        if let first = lines.first {
                            Text(first.replacingOccurrences(of: "VITALIS · ", with: "")).font(.system(size: 16, weight: .heavy)).lineLimit(2)
                        }
                    }
                }
                if lines.isEmpty { Text("Loading…").foregroundStyle(.secondary) }
                // Each fact as "Label: value" from the Bio Passport.
                ForEach(Array(lines.dropFirst().enumerated()), id: \.offset) { _, line in
                    let parts = line.split(separator: ":", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespaces) }
                    VStack(alignment: .leading, spacing: 1) {
                        Text(parts.count == 2 ? parts[0] : "").font(.system(size: 11, weight: .semibold)).foregroundStyle(Color.inkMuted)
                        Text(parts.count == 2 ? parts[1] : line).font(.system(size: 14, weight: .medium)).foregroundStyle(Color.ink)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(10)
                    .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color.chip))
                }
                Button("Back") { model.screen = .home }.buttonStyle(SolidStyle(fill: .white.opacity(0.15))).padding(.top, 4)
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
