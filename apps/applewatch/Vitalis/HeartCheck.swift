import Foundation

enum HeartVerdict: String, Codable { case high, low }

/**
 Decides whether a heart rate is worth asking "Are you OK?". Same rule as the Wear OS app:
 a single spike never counts, only readings Apple marks as taken at rest count, and the
 rate must stay out of range for minutes. Limits are a starting point pending medical review.
 */
enum HeartCheck {
    static let high = 150
    static let low = 40
    static let window: TimeInterval = 15 * 60
    static let minReadings = 3
    static let minSpan: TimeInterval = 4 * 60

    static func check(_ readings: [(at: Date, bpm: Int)], now: Date) -> HeartVerdict? {
        let recent = readings
            .filter { now.timeIntervalSince($0.at) >= 0 && now.timeIntervalSince($0.at) <= window && $0.bpm > 0 }
            .sorted { $0.at < $1.at }
        guard recent.count >= minReadings,
              let first = recent.first, let last = recent.last,
              last.at.timeIntervalSince(first.at) >= minSpan else { return nil }
        if recent.allSatisfy({ $0.bpm >= high }) { return .high }
        if recent.allSatisfy({ $0.bpm <= low }) { return .low }
        return nil
    }
}
