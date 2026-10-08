package dev.vitalis.watch

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.togetherWith
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.wear.compose.material.Scaffold
import androidx.wear.compose.material.TimeText
import dev.vitalis.watch.core.Store
import dev.vitalis.watch.heart.Heart
import dev.vitalis.watch.heart.HeartAlert
import dev.vitalis.watch.heart.HeartCheck
import dev.vitalis.watch.ui.design.VitalisTheme
import dev.vitalis.watch.ui.screens.AreYouOkScreen
import dev.vitalis.watch.ui.screens.CountdownScreen
import dev.vitalis.watch.ui.screens.HomeScreen
import dev.vitalis.watch.ui.screens.MedicalScreen
import dev.vitalis.watch.ui.screens.NoLocationScreen
import dev.vitalis.watch.ui.screens.PairScreen
import dev.vitalis.watch.ui.screens.SendingScreen
import dev.vitalis.watch.ui.screens.StatusScreen
import kotlinx.coroutines.launch

/** Where the watch is. One screen at a time; no navigation stack to get lost in during an emergency. */
sealed interface Screen {
    data object Pair : Screen
    data object Home : Screen
    data object Countdown : Screen
    data object AreYouOk : Screen
    data class Sending(val reason: String, val bpm: Int?) : Screen
    data object Status : Screen
    data object Medical : Screen
    data object NoLocation : Screen
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Screenshots (debug builds only): `adb shell am start -n dev.vitalis.app/dev.vitalis.watch.MainActivity
        // --es screen countdown|areYouOk|status|medical [--es demoStatus pending|en_route|on_scene]`.
        val demo = if (BuildConfig.DEBUG) intent.getStringExtra("screen") else null
        val demoStatus = if (BuildConfig.DEBUG) intent.getStringExtra("demoStatus") else null
        if (demo == "areYouOk") Store(this).alert = "${HeartCheck.Verdict.HIGH.name}:162:${System.currentTimeMillis()}"
        setContent { VitalisTheme { App(demo, demoStatus) } }
    }
}

@Composable
private fun App(demo: String?, demoStatus: String?) {
    val context = LocalContext.current
    val store = remember { Store(context) }
    val scope = rememberCoroutineScope()
    var screen by remember {
        mutableStateOf(
            when {
                demo == "countdown" -> Screen.Countdown
                demo == "areYouOk" -> Screen.AreYouOk
                demo == "status" -> Screen.Status
                demo == "medical" -> Screen.Medical
                store.key == null -> Screen.Pair
                HeartAlert.pending(context) != null -> Screen.AreYouOk
                else -> Screen.Home
            },
        )
    }
    // The SOS that found no location, so Try again resends the same one.
    var lastSending by remember { mutableStateOf<Screen.Sending?>(null) }
    // A revoked key (unpaired from the phone) sends the watch back to pairing.
    val unpaired = {
        HeartAlert.clear(context)
        store.forget()
        scope.launch { Heart.stop(context) }
        screen = Screen.Pair
    }
    // A heart alert raised while the app is open shows at once.
    DisposableEffect(Unit) {
        val stop = store.onAlertChange { raised -> if (raised && store.key != null) screen = Screen.AreYouOk }
        onDispose { stop() }
    }

    Scaffold(timeText = { TimeText() }) {
        AnimatedContent(
            targetState = screen,
            transitionSpec = { (fadeIn(tween(350)) + scaleIn(tween(350), initialScale = 0.94f)) togetherWith fadeOut(tween(200)) },
            label = "screen",
        ) { s ->
            when (s) {
                Screen.Pair -> PairScreen(onPaired = { screen = Screen.Home })
                Screen.Home -> HomeScreen(
                    onSos = { screen = Screen.Countdown },
                    onMedical = { screen = Screen.Medical },
                    onActiveSos = { screen = Screen.Status },
                    onUnpaired = unpaired,
                )
                Screen.Countdown -> CountdownScreen(onDone = { screen = Screen.Sending("button", null) }, onCancel = { screen = Screen.Home })
                Screen.AreYouOk -> AreYouOkScreen(
                    onOk = { HeartAlert.clear(context, quietMs = 30 * 60_000); screen = Screen.Home },
                    onTimeout = { verdict, bpm -> screen = Screen.Sending(HeartAlert.reason(verdict), bpm) },
                )
                is Screen.Sending -> SendingScreen(
                    s.reason, s.bpm,
                    onStart = { lastSending = s },
                    onSent = { screen = Screen.Status },
                    onNoLocation = { screen = Screen.NoLocation },
                    onUnpaired = unpaired,
                )
                Screen.Status -> StatusScreen(demoStatus, onClosed = { screen = Screen.Home }, onUnpaired = unpaired)
                Screen.Medical -> MedicalScreen(onBack = { screen = Screen.Home }, onUnpaired = unpaired)
                Screen.NoLocation -> NoLocationScreen(onRetry = { screen = lastSending ?: Screen.Home })
            }
        }
    }
}
