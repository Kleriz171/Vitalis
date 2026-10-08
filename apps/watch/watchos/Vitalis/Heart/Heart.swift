import Foundation
import HealthKit

/**
 Background heart check. Apple Watch measures heart rate every few minutes on its own; Vitalis
 is woken when new readings or Apple's own high/low heart-rate alerts arrive, and checks them.
 */
final class Heart {
    static let shared = Heart()
    private let health = HKHealthStore()
    private let heartRate = HKQuantityType(.heartRate)
    private let events = [HKCategoryType(.highHeartRateEvent), HKCategoryType(.lowHeartRateEvent)]
    private var queries: [HKQuery] = []

    var available: Bool { HKHealthStore.isHealthDataAvailable() }

    func requestAccess() async -> Bool {
        guard available else { return false }
        do {
            try await health.requestAuthorization(toShare: [heartRate], read: Set([heartRate] + events))
            return true
        } catch { return false }
    }

    func start() {
        guard available, queries.isEmpty, Store.shared.heartOn else { return }
        for type in [heartRate as HKSampleType] + events {
            let q = HKObserverQuery(sampleType: type, predicate: nil) { [weak self] _, done, _ in
                Task {
                    await self?.evaluate()
                    done()
                }
            }
            health.execute(q)
            queries.append(q)
            health.enableBackgroundDelivery(for: type, frequency: .immediate) { _, _ in }
        }
    }

    func stop() {
        queries.forEach(health.stop)
        queries = []
        health.disableAllBackgroundDelivery { _, _ in }
    }

    /// Resting readings from the last hours, for the heart card's graph.
    func recent(hours: Double = 6) async -> [(at: Date, bpm: Int)] {
        await restingSamples(since: Date().addingTimeInterval(-hours * 3600))
    }

    func evaluate() async {
        let store = Store.shared
        guard store.key != nil, store.heartOn else { return }
        // An alert nobody answered in time: send the SOS now (the watch may have been asleep).
        if let pending = store.alert, Date() >= pending.deadline {
            await HeartAlert.sendOverdue(pending)
            return
        }
        guard store.alert == nil, Date() >= store.quietUntil else { return }
        let now = Date()
        let readings = await restingSamples(since: now.addingTimeInterval(-HeartCheck.window))
        var verdict = HeartCheck.check(readings, now: now)
        // Apple's own alerts already require ~10 minutes of inactivity; trust them too.
        if verdict == nil { verdict = await appleEvent(since: now.addingTimeInterval(-HeartCheck.window)) }
        if let verdict { await HeartAlert.raise(verdict, bpm: readings.last?.bpm ?? 0) }
    }

    /// Heart-rate readings Apple marks as taken at rest ("sedentary"), oldest first.
    private func restingSamples(since: Date) async -> [(at: Date, bpm: Int)] {
        await withCheckedContinuation { cont in
            let predicate = HKQuery.predicateForSamples(withStart: since, end: nil)
            let q = HKSampleQuery(sampleType: heartRate, predicate: predicate, limit: HKObjectQueryNoLimit,
                                  sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]) { _, samples, _ in
                let unit = HKUnit.count().unitDivided(by: .minute())
                let rows = (samples as? [HKQuantitySample] ?? []).filter {
                    ($0.metadata?[HKMetadataKeyHeartRateMotionContext] as? NSNumber)?.intValue == HKHeartRateMotionContext.sedentary.rawValue
                }.map { (at: $0.startDate, bpm: Int($0.quantity.doubleValue(for: unit).rounded())) }
                cont.resume(returning: rows)
            }
            health.execute(q)
        }
    }

    private func appleEvent(since: Date) async -> HeartVerdict? {
        for (i, type) in events.enumerated() {
            let found: Bool = await withCheckedContinuation { cont in
                let q = HKSampleQuery(sampleType: type, predicate: HKQuery.predicateForSamples(withStart: since, end: nil), limit: 1, sortDescriptors: nil) { _, s, _ in
                    cont.resume(returning: !(s ?? []).isEmpty)
                }
                health.execute(q)
            }
            if found { return i == 0 ? .high : .low }
        }
        return nil
    }

    #if DEBUG
    /// Development only: write three resting readings so the whole alert path can be tried.
    func simulate(bpm: Int) async {
        let unit = HKUnit.count().unitDivided(by: .minute())
        let now = Date()
        let samples = [8, 4, 0].map { minutesAgo -> HKQuantitySample in
            let at = now.addingTimeInterval(TimeInterval(-minutesAgo * 60))
            return HKQuantitySample(type: heartRate, quantity: HKQuantity(unit: unit, doubleValue: Double(bpm)), start: at, end: at,
                                    metadata: [HKMetadataKeyHeartRateMotionContext: NSNumber(value: HKHeartRateMotionContext.sedentary.rawValue)])
        }
        try? await health.save(samples)
        await evaluate()
    }
    #endif
}
