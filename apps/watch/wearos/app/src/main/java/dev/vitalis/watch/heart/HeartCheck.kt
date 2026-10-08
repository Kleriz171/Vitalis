package dev.vitalis.watch.heart

/**
 * Decides whether a heart rate is worth asking "Are you OK?". Deliberately conservative: a
 * single spike never counts, exercise never counts, and readings without skin contact are
 * dropped before they get here (a watch on the table must not look like a stopped heart).
 * Limits are a starting point pending medical review, not a diagnosis.
 */
object HeartCheck {
    enum class Activity { RESTING, ASLEEP, EXERCISE }
    enum class Verdict { HIGH, LOW }

    const val HIGH = 150          // bpm at rest
    const val LOW = 40            // bpm awake
    const val LOW_ASLEEP = 35     // fit sleepers go below 40 normally
    const val WINDOW_MS = 15 * 60_000L
    const val MIN_READINGS = 3
    const val MIN_SPAN_MS = 4 * 60_000L // sustained, not a spike

    fun check(readings: List<Pair<Long, Int>>, now: Long, activity: Activity): Verdict? {
        if (activity == Activity.EXERCISE) return null
        val recent = readings.filter { now - it.first in 0..WINDOW_MS && it.second > 0 }
        if (recent.size < MIN_READINGS) return null
        if (recent.last().first - recent.first().first < MIN_SPAN_MS) return null
        val low = if (activity == Activity.ASLEEP) LOW_ASLEEP else LOW
        return when {
            recent.all { it.second >= HIGH } -> Verdict.HIGH
            recent.all { it.second <= low } -> Verdict.LOW
            else -> null
        }
    }
}
