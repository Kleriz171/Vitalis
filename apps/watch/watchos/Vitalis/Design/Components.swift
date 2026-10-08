import SwiftUI
import WatchKit

// The phone app's language, made for the wrist: off-white cards on the Vitalis green, round
// tinted icon tiles, teal for live and selected, red only for SOS.

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
struct CardRow<Trailing: View>: View {
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

/// Card look for buttons: an off-white rounded card that dims slightly while pressed.
struct CardStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(RoundedRectangle(cornerRadius: 22, style: .continuous).fill(configuration.isPressed ? Color.paperPressed : Color.paper))
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

struct BrandMark: View {
    var body: some View {
        HStack(spacing: 7) {
            Image("Logo").resizable().frame(width: 24, height: 24).accessibilityHidden(true)
            Text("Vitalis").font(.system(size: 15, weight: .heavy))
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
            CardRow(symbol: "phone.fill", tint: .vitalisTeal, title: "Call 127", subtitle: String(localized: "Ambulance")) { EmptyView() }
        }
        .buttonStyle(CardStyle())
    }
}
