package dev.vitalis.watch

import android.content.Context
import androidx.health.services.client.HealthServices
import androidx.health.services.client.data.DataType
import androidx.health.services.client.data.PassiveListenerConfig
import kotlinx.coroutines.guava.await

/** Turns the background heart-rate feed on or off. */
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
}
