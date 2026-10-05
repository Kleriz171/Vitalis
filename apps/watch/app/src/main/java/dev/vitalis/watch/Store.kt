package dev.vitalis.watch

import android.content.Context

/**
 * Everything the watch remembers, in app-private preferences.
 * ponytail: the key sits in plain private storage (safe on a locked, unrooted watch); move it to
 * the Android Keystore if the watch app ever holds more than SOS rights.
 */
class Store(context: Context) {
    private val p = context.getSharedPreferences("vitalis", Context.MODE_PRIVATE)

    var key: String?
        get() = p.getString("key", null)
        set(v) = p.edit().putString("key", v).apply()
    var name: String?
        get() = p.getString("name", null)
        set(v) = p.edit().putString("name", v).apply()
    var heartOn: Boolean
        get() = p.getBoolean("heartOn", true)
        set(v) = p.edit().putBoolean("heartOn", v).apply()
    var activity: HeartCheck.Activity
        get() = HeartCheck.Activity.valueOf(p.getString("activity", HeartCheck.Activity.RESTING.name)!!)
        set(v) = p.edit().putString("activity", v.name).apply()
    var medical: List<String>
        get() = p.getString("medical", "")!!.split('\n').filter { it.isNotBlank() }
        set(v) = p.edit().putString("medical", v.joinToString("\n")).apply()

    /** Last known position as (longitude, latitude), refreshed whenever the app gets a fix. */
    var lastFix: Pair<Double, Double>?
        get() = p.getString("fix", null)?.split(',')?.let { it[0].toDouble() to it[1].toDouble() }
        set(v) = p.edit().putString("fix", v?.let { "${it.first},${it.second}" }).apply()

    /** An unanswered "Are you OK?": "HIGH|LOW:bpm:startedAtMs", or null. */
    var alert: String?
        get() = p.getString("alert", null)
        set(v) = p.edit().putString("alert", v).apply()
    /** No new heart alert before this time (after "I'm OK"). */
    var quietUntil: Long
        get() = p.getLong("quietUntil", 0)
        set(v) = p.edit().putLong("quietUntil", v).apply()

    /** Recent good-contact readings (time ms, bpm), newest last; kept for 20 minutes. */
    fun readings(): List<Pair<Long, Int>> =
        p.getString("readings", "")!!.split(';').filter { it.isNotBlank() }.map { it.split(':').let { (t, b) -> t.toLong() to b.toInt() } }

    fun addReadings(fresh: List<Pair<Long, Int>>, now: Long): List<Pair<Long, Int>> {
        val all = (readings() + fresh).filter { now - it.first <= 20 * 60_000 }.sortedBy { it.first }
        p.edit().putString("readings", all.joinToString(";") { "${it.first}:${it.second}" }).apply()
        return all
    }

    fun forget() = p.edit().clear().apply()
}
