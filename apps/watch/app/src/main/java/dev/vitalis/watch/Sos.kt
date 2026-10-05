package dev.vitalis.watch

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.LocationManager
import android.os.CancellationSignal
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONArray
import org.json.JSONObject
import kotlin.coroutines.resume

object Sos {
    class NoLocation : Exception("No location")

    /** A fresh fix if one comes within 8 s, else the last one we saw. Remembers what it finds. */
    @SuppressLint("MissingPermission")
    suspend fun locate(context: Context): Pair<Double, Double>? {
        val store = Store(context)
        if (context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) return store.lastFix
        val lm = context.getSystemService(LocationManager::class.java)
        // Ask every working source at once (fused, the watch's GPS, network); the first fix wins.
        // Fused alone can stay silent on a watch with no phone nearby.
        val providers = lm.getProviders(true).filter { it != LocationManager.PASSIVE_PROVIDER }
        val fix = withTimeoutOrNull(8_000) {
            suspendCancellableCoroutine { cont ->
                val cancels = providers.map { CancellationSignal() }
                cont.invokeOnCancellation { cancels.forEach(CancellationSignal::cancel) }
                var waiting = providers.size
                if (waiting == 0) cont.resume(null)
                providers.forEachIndexed { i, provider ->
                    runCatching {
                        lm.getCurrentLocation(provider, cancels[i], context.mainExecutor) { loc ->
                            waiting--
                            if (cont.isActive && (loc != null || waiting == 0)) {
                                cancels.forEach(CancellationSignal::cancel)
                                cont.resume(loc)
                            }
                        }
                    }.onFailure { waiting--; if (cont.isActive && waiting == 0) cont.resume(null) }
                }
            }
        } ?: providers.firstNotNullOfOrNull { runCatching { lm.getLastKnownLocation(it) }.getOrNull() }
        fix?.let { store.lastFix = it.longitude to it.latitude }
        return store.lastFix
    }

    /** Sends the SOS. reason: "button", "heart_high" or "heart_low". Returns the emergency id. */
    suspend fun send(context: Context, reason: String, heartRate: Int? = null, fix: Pair<Double, Double>? = null): String {
        val store = Store(context)
        val at = fix ?: locate(context) ?: throw NoLocation()
        val body = JSONObject()
            .put("reason", reason)
            .put("coordinates", JSONArray().put(at.first).put(at.second))
        if (heartRate != null) body.put("heartRate", heartRate)
        val res = Api.call("POST", "/watch/sos", body, store.key)
        return res.getJSONObject("emergency").getString("_id")
    }
}
