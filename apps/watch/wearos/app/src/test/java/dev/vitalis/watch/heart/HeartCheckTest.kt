package dev.vitalis.watch.heart

import dev.vitalis.watch.heart.HeartCheck.Activity
import dev.vitalis.watch.heart.HeartCheck.Verdict
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class HeartCheckTest {
    private val now = 10_000_000L
    private fun every(minutes: List<Int>, bpm: Int) = minutes.map { now - it * 60_000L to bpm }

    @Test fun sustainedHighAtRestAlerts() = assertEquals(Verdict.HIGH, HeartCheck.check(every(listOf(8, 4, 0), 170), now, Activity.RESTING))
    @Test fun exerciseNeverAlerts() = assertNull(HeartCheck.check(every(listOf(8, 4, 0), 170), now, Activity.EXERCISE))
    @Test fun singleSpikeDoesNot() = assertNull(HeartCheck.check(every(listOf(8, 4), 80) + every(listOf(0), 190), now, Activity.RESTING))
    @Test fun tooFewReadingsDoNot() = assertNull(HeartCheck.check(every(listOf(4, 0), 170), now, Activity.RESTING))
    @Test fun burstWithinAMinuteDoesNot() = assertNull(HeartCheck.check(listOf(now - 50_000 to 170, now - 20_000 to 170, now to 170), now, Activity.RESTING))
    @Test fun oldReadingsIgnored() = assertNull(HeartCheck.check(every(listOf(30, 25, 20), 170), now, Activity.RESTING))
    @Test fun lowAwakeAlerts() = assertEquals(Verdict.LOW, HeartCheck.check(every(listOf(10, 5, 0), 38), now, Activity.RESTING))
    @Test fun lowAsleepUsesLowerLimit() {
        assertNull(HeartCheck.check(every(listOf(10, 5, 0), 38), now, Activity.ASLEEP))
        assertEquals(Verdict.LOW, HeartCheck.check(every(listOf(10, 5, 0), 30), now, Activity.ASLEEP))
    }
    @Test fun zeroReadingsIgnored() = assertNull(HeartCheck.check(every(listOf(8, 4, 0), 0), now, Activity.RESTING))
}
