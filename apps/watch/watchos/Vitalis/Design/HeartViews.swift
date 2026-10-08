import SwiftUI

/// The heart card: the latest resting rate, a heart beating at that rate, and the last hours.
struct HeartCard: View {
    @Binding var on: Bool
    let readings: [(at: Date, bpm: Int)]

    var body: some View {
        let last = readings.last
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .center, spacing: 7) {
                BeatingHeart(bpm: on ? last?.bpm : nil)
                VStack(alignment: .leading, spacing: 0) {
                    HStack(alignment: .firstTextBaseline, spacing: 3) {
                        Text(on ? (last.map { "\($0.bpm)" } ?? "--") : String(localized: "Off"))
                            .font(.system(size: 22, weight: .heavy, design: .rounded)).monospacedDigit()
                            .contentTransition(.numericText())
                        if on, last != nil { Text("bpm").font(.system(size: 12, weight: .semibold)).foregroundStyle(Color.inkMuted) }
                    }
                    .foregroundStyle(Color.ink)
                    Text(on ? (last.map { $0.at.formatted(.relative(presentation: .named, unitsStyle: .abbreviated)) } ?? String(localized: "Waiting")) : String(localized: "Heart check is off"))
                        .font(.system(size: 10)).foregroundStyle(Color.inkMuted).lineLimit(1)
                }
                Spacer(minLength: 0)
                Toggle("Heart check", isOn: $on).labelsHidden().tint(.vitalisTeal).fixedSize().scaleEffect(0.8)
            }
            if on, readings.count >= 2 { Sparkline(points: readings.map(\.bpm)).frame(height: 16) }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 7)
        .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(Color.paper))
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
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(bpm == nil ? Color.inkMuted : Color.sos)
                .scaleEffect(1 + (bpm == nil ? 0 : beat * 0.18))
                .frame(width: 28, height: 28)
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
