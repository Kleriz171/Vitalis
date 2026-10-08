package dev.vitalis.watch.ui.screens

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.DirectionsRun
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.MedicalServices
import androidx.compose.material.icons.filled.Sensors
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.CircularProgressIndicator
import androidx.wear.compose.material.Text
import dev.vitalis.watch.R
import dev.vitalis.watch.core.Api
import dev.vitalis.watch.core.Store
import dev.vitalis.watch.heart.HeartAlert
import dev.vitalis.watch.sos.Sos
import dev.vitalis.watch.ui.design.CardRow
import dev.vitalis.watch.ui.design.Call127Card
import dev.vitalis.watch.ui.design.Haptics
import dev.vitalis.watch.ui.design.IconTile
import dev.vitalis.watch.ui.design.Note
import dev.vitalis.watch.ui.design.SolidButton
import dev.vitalis.watch.ui.design.VitalisColors
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONObject

// The SOS flow: countdown → sending → live status (or no location).

private const val COUNTDOWN_S = 3

@Composable
fun CountdownScreen(onDone: () -> Unit, onCancel: () -> Unit) {
    val view = LocalView.current
    var left by remember { mutableIntStateOf(COUNTDOWN_S) }
    val ring by animateFloatAsState(left / COUNTDOWN_S.toFloat(), tween(1_000, easing = LinearEasing), label = "ring")
    LaunchedEffect(Unit) {
        while (left > 0) { delay(1_000); Haptics.tick(view); left-- }
        onDone()
    }
    Column(
        Modifier.fillMaxSize().background(VitalisColors.Sos).padding(horizontal = 24.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(Modifier.size(96.dp), contentAlignment = Alignment.Center) {
            Canvas(Modifier.fillMaxSize()) {
                val stroke = Stroke(6.dp.toPx(), cap = StrokeCap.Round)
                drawArc(Color.White.copy(alpha = 0.25f), 0f, 360f, useCenter = false, style = stroke)
                drawArc(Color.White, -90f, 360f * ring, useCenter = false, style = stroke)
            }
            Text("$left", color = Color.White, fontSize = 48.sp, fontWeight = FontWeight.Black)
        }
        Text(stringResource(R.string.sending_sos), color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
        SolidButton(stringResource(R.string.cancel), onCancel, fill = Color.White, textColor = VitalisColors.Sos)
    }
}

@Composable
fun SendingScreen(reason: String, bpm: Int?, onStart: () -> Unit, onSent: () -> Unit, onNoLocation: () -> Unit, onUnpaired: () -> Unit) {
    val context = LocalContext.current
    val view = LocalView.current
    var failed by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        onStart()
        // Keep trying: an SOS that fails once on a flaky connection must not just give up.
        while (true) {
            try {
                Sos.send(context, reason, bpm)
                HeartAlert.clear(context)
                Haptics.confirm(view)
                onSent()
                return@LaunchedEffect
            } catch (e: Sos.NoLocation) {
                onNoLocation(); return@LaunchedEffect
            } catch (e: Api.HttpError) {
                if (e.code == 401) { onUnpaired(); return@LaunchedEffect }
                failed = true
            } catch (e: Exception) {
                failed = true
            }
            delay(3_000)
        }
    }
    Column(
        Modifier.fillMaxSize().padding(horizontal = 22.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        CircularProgressIndicator(indicatorColor = VitalisColors.Sos, modifier = Modifier.size(28.dp))
        Text(stringResource(if (failed) R.string.retrying else R.string.sending), color = Color.White, fontSize = 15.sp, textAlign = TextAlign.Center)
        if (failed) Call127Card()
    }
}

/** Received, accepted, on the way, on scene. */
private val STEPS = listOf("pending", "assigned", "en_route", "on_scene")

@Composable
fun StatusScreen(demoStatus: String?, onClosed: () -> Unit, onUnpaired: () -> Unit) {
    val context = LocalContext.current
    val store = remember { Store(context) }
    val scope = rememberCoroutineScope()
    var emergency by remember { mutableStateOf<JSONObject?>(null) }
    var confirmCancel by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        if (demoStatus != null) {
            emergency = JSONObject().put("_id", "demo").put("status", demoStatus).put("etaSeconds", 240)
                .put("responder", JSONObject().put("name", "Arben K."))
            return@LaunchedEffect
        }
        while (true) {
            try {
                val res = Api.call("GET", "/watch/sos", key = store.key)
                if (res.isNull("emergency")) { onClosed(); return@LaunchedEffect }
                emergency = res.getJSONObject("emergency")
            } catch (e: Api.HttpError) {
                if (e.code == 401) { onUnpaired(); return@LaunchedEffect }
            } catch (_: Exception) { /* offline: keep the last state and try again */ }
            delay(5_000)
        }
    }
    val e = emergency
    val step = STEPS.indexOf(e?.optString("status")).coerceAtLeast(0)
    val responder = e?.optJSONObject("responder")?.optString("name")?.takeIf { it.isNotBlank() }
    val etaMin = e?.optInt("etaSeconds", 0)?.takeIf { it > 0 }?.let { (it + 59) / 60 }
    val accent = if (step == 0) VitalisColors.Sos else VitalisColors.Teal

    val list = rememberScalingLazyListState(initialCenterItemIndex = 0)
    ScalingLazyColumn(state = list, modifier = Modifier.fillMaxSize().padding(horizontal = 10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        item {
            IconTile(
                when (step) { 0 -> Icons.Filled.Sensors; 3 -> Icons.Filled.MedicalServices; else -> Icons.AutoMirrored.Filled.DirectionsRun },
                accent,
            )
        }
        item {
            Text(
                stringResource(when (step) { 3 -> R.string.help_here; 0 -> R.string.finding_help; else -> R.string.help_coming }),
                color = Color.White, fontSize = 17.sp, fontWeight = FontWeight.ExtraBold, textAlign = TextAlign.Center,
            )
        }
        item {
            Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp), horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                STEPS.indices.forEach { i ->
                    Box(Modifier.weight(1f).height(4.dp).background(if (i <= step) accent else Color.White.copy(alpha = 0.15f), CircleShape))
                }
            }
        }
        if (etaMin != null && step in 1..2) item {
            Text(stringResource(R.string.eta_min, etaMin), color = Color.White, fontSize = 30.sp, fontWeight = FontWeight.ExtraBold)
        }
        if (responder != null && step >= 1) item { Text(responder, color = VitalisColors.OnGreenMuted, fontSize = 13.sp) }
        if (step == 0) item { Note(stringResource(R.string.stay_calm)) }
        item { Call127Card() }
        item {
            CardRow(
                icon = Icons.Filled.Close,
                tint = if (confirmCancel) VitalisColors.Sos else VitalisColors.InkMuted,
                title = stringResource(if (confirmCancel) R.string.tap_again_to_cancel else R.string.im_ok_cancel),
                onClick = {
                    val id = e?.optString("_id")
                    if (!confirmCancel || id == null) { confirmCancel = true; return@CardRow }
                    scope.launch {
                        runCatching { Api.call("POST", "/watch/sos/$id/cancel", key = store.key) }.onSuccess { onClosed() }
                    }
                },
            )
        }
    }
}

@Composable
fun NoLocationScreen(onRetry: () -> Unit) {
    val list = rememberScalingLazyListState(initialCenterItemIndex = 0)
    ScalingLazyColumn(state = list, modifier = Modifier.fillMaxSize().padding(horizontal = 10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        item { Text(stringResource(R.string.no_location), color = Color.White, fontSize = 14.sp, textAlign = TextAlign.Center) }
        item { Call127Card() }
        item { SolidButton(stringResource(R.string.try_again), onRetry, fill = Color.White.copy(alpha = 0.15f)) }
    }
}
