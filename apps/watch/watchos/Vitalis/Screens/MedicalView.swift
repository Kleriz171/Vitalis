import SwiftUI

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
                    .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color.paper))
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
