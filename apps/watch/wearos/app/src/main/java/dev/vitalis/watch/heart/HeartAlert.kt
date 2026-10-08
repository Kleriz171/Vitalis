package dev.vitalis.watch.heart

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import dev.vitalis.watch.MainActivity
import dev.vitalis.watch.R
import dev.vitalis.watch.core.Store
import dev.vitalis.watch.sos.Sos
import java.util.concurrent.TimeUnit

/**
 * "Are you OK?" after a worrying heart rate. The screen counts 30 s down and sends the SOS;
 * if the screen never shows (watch asleep, app killed), a background job sends it at 40 s.
 */
object HeartAlert {
    const val ANSWER_MS = 30_000L
    private const val CHANNEL = "alert"
    private const val NOTIFICATION = 1
    private const val WORK = "heart-alert"

    fun raise(context: Context, verdict: HeartCheck.Verdict, bpm: Int) {
        Store(context).alert = "${verdict.name}:$bpm:${System.currentTimeMillis()}"
        WorkManager.getInstance(context).enqueueUniqueWork(
            WORK, ExistingWorkPolicy.REPLACE,
            OneTimeWorkRequestBuilder<Fallback>().setInitialDelay(ANSWER_MS + 10_000, TimeUnit.MILLISECONDS).build(),
        )
        val nm = context.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CHANNEL, context.getString(R.string.alert_channel), NotificationManager.IMPORTANCE_HIGH).apply {
            vibrationPattern = longArrayOf(0, 600, 300, 600, 300, 600)
        })
        val open = PendingIntent.getActivity(
            context, 0, Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        nm.notify(NOTIFICATION, Notification.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(context.getString(R.string.are_you_ok))
            .setContentText(context.getString(R.string.alert_text, bpm))
            .setStyle(Notification.BigTextStyle().bigText(context.getString(R.string.alert_text, bpm)))
            .setCategory(Notification.CATEGORY_ALARM)
            .setFullScreenIntent(open, true)
            .setContentIntent(open)
            .setOngoing(true)
            .build())
    }

    /** "I'm OK", or the SOS went out: stand everything down. */
    fun clear(context: Context, quietMs: Long = 0) {
        val store = Store(context)
        store.alert = null
        if (quietMs > 0) store.quietUntil = System.currentTimeMillis() + quietMs
        WorkManager.getInstance(context).cancelUniqueWork(WORK)
        context.getSystemService(NotificationManager::class.java).cancel(NOTIFICATION)
    }

    /** Parses Store.alert into (verdict, bpm, startedAt). */
    fun pending(context: Context): Triple<HeartCheck.Verdict, Int, Long>? =
        Store(context).alert?.split(':')?.let { (v, b, t) -> Triple(HeartCheck.Verdict.valueOf(v), b.toInt(), t.toLong()) }

    fun reason(v: HeartCheck.Verdict) = if (v == HeartCheck.Verdict.HIGH) "heart_high" else "heart_low"

    class Fallback(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
        override suspend fun doWork(): Result {
            val (verdict, bpm, _) = pending(applicationContext) ?: return Result.success()
            return try {
                Sos.send(applicationContext, reason(verdict), bpm, Store(applicationContext).lastFix)
                clear(applicationContext)
                Result.success()
            } catch (e: Exception) {
                if (runAttemptCount < 5) Result.retry() else Result.failure()
            }
        }
    }
}
