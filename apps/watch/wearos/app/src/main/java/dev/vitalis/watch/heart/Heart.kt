package dev.vitalis.watch.heart

import android.content.Context
import androidx.health.services.client.HealthServices
import androidx.health.services.client.data.DataType
import androidx.health.services.client.data.PassiveListenerConfig
import dev.vitalis.watch.BuildConfig
import dev.vitalis.watch.core.Store
import kotlinx.coroutines.guava.await

/** The background heart check: turns the heart-rate feed on or off and judges new readings. */
object Heart {
    suspend fun start(context: Context): Boolean = runCatching {
        val client = HealthServices.getClient(context).passiveMonitoringClient
        val caps = client.getCapabilitiesAsync().await()
        if (DataType.HEART_RATE_BPM !in caps.supportedDataTypesPassiveMonitoring) return false
        client.setPassiveListenerServiceAsync(
            HeartService::class.java,
            PassiveListenerConfig.builder()
                .setDataTypes(setOf(DataType.HEART_RATE_BPM))
                .setShouldUserActivityInfoBeRequested(true)
                .build(),
        ).await()
        true
    }.getOrDefault(false)

    suspend fun stop(context: Context) {
        runCatching { HealthServices.getClient(context).passiveMonitoringClient.clearPassiveListenerServiceAsync().await() }
    }

    /** New good-contact readings arrived: keep them, and ask "Are you OK?" if the rate stays out of range. */
    fun evaluate(context: Context, fresh: List<Pair<Long, Int>>) {
        val store = Store(context)
        val now = System.currentTimeMillis()
        val all = store.addReadings(fresh, now)
        val verdict = HeartCheck.check(all, now, store.activity) ?: return
        if (store.alert != null || now < store.quietUntil) return
        HeartAlert.raise(context, verdict, all.last().second)
    }

    /** Development only: three resting readings so the whole alert path can be tried. */
    fun simulate(context: Context, bpm: Int) {
        check(BuildConfig.DEBUG)
        val now = System.currentTimeMillis()
        evaluate(context, listOf(8, 4, 0).map { now - it * 60_000L to bpm })
    }
}
