package dev.vitalis.watch.heart

import android.os.SystemClock
import androidx.health.services.client.PassiveListenerService
import androidx.health.services.client.data.DataPointContainer
import androidx.health.services.client.data.DataType
import androidx.health.services.client.data.HeartRateAccuracy
import androidx.health.services.client.data.UserActivityInfo
import androidx.health.services.client.data.UserActivityState
import dev.vitalis.watch.core.Store
import java.time.Instant
import kotlin.math.roundToInt

/** Receives the watch's background heart-rate readings (Health Services passive monitoring). */
class HeartService : PassiveListenerService() {
    override fun onNewDataPointsReceived(dataPoints: DataPointContainer) {
        val store = Store(this)
        if (store.key == null || !store.heartOn) return
        val boot = Instant.ofEpochMilli(System.currentTimeMillis() - SystemClock.elapsedRealtime())
        val fresh = dataPoints.getData(DataType.HEART_RATE_BPM)
            .filter { goodContact(it.accuracy) }
            .map { it.getTimeInstant(boot).toEpochMilli() to it.value.roundToInt() }
        if (fresh.isEmpty()) return
        Heart.evaluate(this, fresh)
    }

    override fun onUserActivityInfoReceived(info: UserActivityInfo) {
        Store(this).activity = when (info.userActivityState) {
            UserActivityState.USER_ACTIVITY_EXERCISE -> HeartCheck.Activity.EXERCISE
            UserActivityState.USER_ACTIVITY_ASLEEP -> HeartCheck.Activity.ASLEEP
            else -> HeartCheck.Activity.RESTING
        }
    }

    private fun goodContact(accuracy: Any?): Boolean {
        val status = (accuracy as? HeartRateAccuracy)?.sensorStatus ?: return true
        return status == HeartRateAccuracy.SensorStatus.ACCURACY_HIGH || status == HeartRateAccuracy.SensorStatus.ACCURACY_MEDIUM
    }
}
