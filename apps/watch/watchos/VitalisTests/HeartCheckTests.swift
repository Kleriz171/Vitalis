import XCTest
@testable import Vitalis

final class HeartCheckTests: XCTestCase {
    private let now = Date()
    private func every(_ minutesAgo: [Int], _ bpm: Int) -> [(at: Date, bpm: Int)] {
        minutesAgo.map { (now.addingTimeInterval(TimeInterval(-$0 * 60)), bpm) }
    }

    func testSustainedHighAlerts() { XCTAssertEqual(HeartCheck.check(every([8, 4, 0], 170), now: now), .high) }
    func testSustainedLowAlerts() { XCTAssertEqual(HeartCheck.check(every([10, 5, 0], 36), now: now), .low) }
    func testSingleSpikeDoesNot() { XCTAssertNil(HeartCheck.check(every([8, 4], 80) + every([0], 190), now: now)) }
    func testTooFewReadingsDoNot() { XCTAssertNil(HeartCheck.check(every([4, 0], 170), now: now)) }
    func testBurstWithinAMinuteDoesNot() {
        XCTAssertNil(HeartCheck.check([(now.addingTimeInterval(-50), 170), (now.addingTimeInterval(-20), 170), (now, 170)], now: now))
    }
    func testOldReadingsIgnored() { XCTAssertNil(HeartCheck.check(every([30, 25, 20], 170), now: now)) }
    func testZeroReadingsIgnored() { XCTAssertNil(HeartCheck.check(every([8, 4, 0], 0), now: now)) }
}
