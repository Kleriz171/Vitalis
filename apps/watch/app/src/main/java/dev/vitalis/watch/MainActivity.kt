package dev.vitalis.watch

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.AutoCenteringParams
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.Button
import androidx.wear.compose.material.ButtonDefaults
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.CircularProgressIndicator
import androidx.wear.compose.material.Colors
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Scaffold
import androidx.wear.compose.material.Switch
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.TimeText
import androidx.wear.compose.material.ToggleChip
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONObject

private val Teal = Color(0xFF14A897)
private val Red = Color(0xFFE14545)
private val Surface = Color(0xFF1B2A2E)
private val Muted = Color(0xFFA8B5BC)

private const val HOLD_MS = 3_000
private const val COUNTDOWN_S = 3

/** Where the watch is. One screen at a time, no navigation stack to get lost in. */
private sealed interface Screen {
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
        setContent {
            MaterialTheme(colors = Colors(primary = Teal, secondary = Teal, error = Red, surface = Surface, onSurfaceVariant = Muted)) {
                App()
            }
        }
    }
}

@Composable
private fun App() {
    val context = LocalContext.current
    val store = remember { Store(context) }
    var screen by remember {
        mutableStateOf(
            when {
                store.key == null -> Screen.Pair
                Alert.pending(context) != null -> Screen.AreYouOk
                else -> Screen.Home
            },
        )
    }
    // The SOS that found no location, so Try again resends the same one.
    var lastSos by remember { mutableStateOf<Screen.Sending?>(null) }
    // A revoked key (unpaired from the phone) sends the watch back to pairing.
    val onUnpaired = { store.forget(); screen = Screen.Pair }

    Scaffold(timeText = { TimeText() }, modifier = Modifier.background(Color.Black)) {
        when (val s = screen) {
            Screen.Pair -> PairScreen(onPaired = { screen = Screen.Home })
            Screen.Home -> HomeScreen(
                onSos = { screen = Screen.Countdown },
                onMedical = { screen = Screen.Medical },
                onActiveSos = { screen = Screen.Status },
                onUnpaired = onUnpaired,
            )
            Screen.Countdown -> CountdownScreen(onDone = { screen = Screen.Sending("button", null) }, onCancel = { screen = Screen.Home })
            Screen.AreYouOk -> AreYouOkScreen(
                onOk = { Alert.clear(context, quietMs = 30 * 60_000); screen = Screen.Home },
                onTimeout = { v, bpm -> screen = Screen.Sending(Alert.reason(v), bpm) },
            )
            is Screen.Sending -> SendingScreen(s.reason, s.bpm, onStart = { lastSos = s }, onSent = { screen = Screen.Status }, onNoLocation = { screen = Screen.NoLocation }, onUnpaired = onUnpaired)
            Screen.Status -> StatusScreen(onClosed = { screen = Screen.Home }, onUnpaired = onUnpaired)
            Screen.Medical -> MedicalScreen(onBack = { screen = Screen.Home }, onUnpaired = onUnpaired)
            Screen.NoLocation -> NoLocationScreen(onRetry = { screen = lastSos ?: Screen.Home })
        }
    }
}

// ---- Pairing ------------------------------------------------------------------------------------

@Composable
private fun PairScreen(onPaired: () -> Unit) {
    val context = LocalContext.current
    var code by remember { mutableStateOf<String?>(null) }
    var failed by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        while (true) {
            try {
                failed = false
                val start = Api.call("POST", "/watch/pair/start", JSONObject().put("name", Build.MODEL.take(60)))
                code = start.getString("code")
                val pairId = start.getString("pairId")
                while (true) {
                    delay(3_000)
                    val poll = Api.call("POST", "/watch/pair/poll", JSONObject().put("pairId", pairId))
                    if (poll.getString("status") == "paired") {
                        Store(context).apply { key = poll.getString("token"); name = poll.optString("name") }
                        onPaired()
                        return@LaunchedEffect
                    }
                }
            } catch (e: Exception) {
                // Expired (404) or offline: show it briefly, then start over with a new code.
                failed = e !is Api.HttpError
                delay(if (failed) 5_000 else 0)
            }
        }
    }
    Column(Modifier.fillMaxSize().padding(horizontal = 18.dp), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
        Text("VITALIS", color = Teal, fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = 2.sp)
        Text(
            code?.chunked(3)?.joinToString(" ") ?: "··· ···",
            fontSize = 34.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(vertical = 6.dp)
                .semantics { contentDescription = code?.toList()?.joinToString(" ") ?: "" },
        )
        Text(
            stringResource(if (failed) R.string.pair_offline else R.string.pair_hint),
            color = Muted, fontSize = 13.sp, textAlign = TextAlign.Center,
        )
    }
}

// ---- Home ---------------------------------------------------------------------------------------

@Composable
private fun HomeScreen(onSos: () -> Unit, onMedical: () -> Unit, onActiveSos: () -> Unit, onUnpaired: () -> Unit) {
    val context = LocalContext.current
    val store = remember { Store(context) }
    val scope = rememberCoroutineScope()
    var heartOn by remember { mutableStateOf(store.heartOn) }
    var lastBpm by remember { mutableStateOf(store.readings().lastOrNull()?.second) }

    // Ask once for what the app needs: sensors and activity for the heart check, location for
    // the SOS, notifications for "Are you OK?". Background sensors come in a second request.
    val background = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
        if (heartOn) scope.launch { Heart.start(context) }
    }
    val perms = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { granted ->
        if (granted[Manifest.permission.BODY_SENSORS] == true && Build.VERSION.SDK_INT >= 33) {
            background.launch(Manifest.permission.BODY_SENSORS_BACKGROUND)
        } else if (heartOn) scope.launch { Heart.start(context) }
    }
    LaunchedEffect(Unit) {
        val wanted = buildList {
            add(Manifest.permission.BODY_SENSORS)
            add(Manifest.permission.ACTIVITY_RECOGNITION)
            add(Manifest.permission.ACCESS_FINE_LOCATION)
            if (Build.VERSION.SDK_INT >= 33) add(Manifest.permission.POST_NOTIFICATIONS)
        }.filter { context.checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
        if (wanted.isNotEmpty()) perms.launch(wanted.toTypedArray()) else if (heartOn) Heart.start(context)
        // Keep a recent position for an SOS sent while the app is closed.
        Sos.locate(context)
        // An SOS already running (sent from here or the phone)? Go straight to its status.
        runCatching { Api.call("GET", "/watch/sos", key = store.key) }
            .onSuccess { if (!it.isNull("emergency")) onActiveSos() }
            .onFailure { if ((it as? Api.HttpError)?.code == 401) onUnpaired() }
        while (true) { lastBpm = store.readings().lastOrNull()?.second; delay(10_000) }
    }

    // SOS sits in the middle of the screen; everything else is a scroll away.
    val list = rememberScalingLazyListState(initialCenterItemIndex = 0)
    ScalingLazyColumn(state = list, autoCentering = AutoCenteringParams(itemIndex = 0), modifier = Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
        item { HoldSosButton(onSos) }
        item {
            ToggleChip(
                checked = heartOn,
                onCheckedChange = { on ->
                    heartOn = on
                    store.heartOn = on
                    scope.launch { if (on) Heart.start(context) else Heart.stop(context) }
                },
                label = { Text(stringResource(R.string.heart_check)) },
                secondaryLabel = { Text(if (!heartOn) stringResource(R.string.off) else lastBpm?.let { stringResource(R.string.bpm, it) } ?: stringResource(R.string.on)) },
                toggleControl = { Switch(checked = heartOn) },
                modifier = Modifier.fillMaxWidth(),
            )
        }
        item {
            Chip(
                onClick = onMedical,
                label = { Text(stringResource(R.string.medical_id)) },
                colors = ChipDefaults.secondaryChipColors(),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        item { Call127Chip() }
        store.name?.let { item { Text(it, color = Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp)) } }
    }
}

/** Press and hold for 3 s while a ring fills; letting go early cancels. */
@Composable
private fun HoldSosButton(onSos: () -> Unit) {
    val progress = remember { Animatable(0f) }
    val scope = rememberCoroutineScope()
    val label = stringResource(R.string.hold_for_sos)
    Box(
        Modifier.size(120.dp).padding(4.dp)
            .semantics { contentDescription = label }
            .pointerInput(Unit) {
                detectTapGestures(onPress = {
                    val hold = scope.launch {
                        progress.animateTo(1f, tween(HOLD_MS, easing = LinearEasing))
                        onSos()
                    }
                    tryAwaitRelease()
                    if (progress.value < 1f) {
                        hold.cancel()
                        scope.launch { progress.animateTo(0f, tween(200)) }
                    }
                })
            },
        contentAlignment = Alignment.Center,
    ) {
        Box(Modifier.size(104.dp).clip(CircleShape).background(Red), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("SOS", fontSize = 28.sp, fontWeight = FontWeight.Black, color = Color.White)
                Text(stringResource(R.string.hold), fontSize = 11.sp, color = Color.White.copy(alpha = 0.85f))
            }
        }
        CircularProgressIndicator(
            progress = progress.value, modifier = Modifier.fillMaxSize(),
            indicatorColor = Color.White, trackColor = Color.Transparent, strokeWidth = 5.dp,
        )
    }
}

@Composable
private fun Call127Chip() {
    val context = LocalContext.current
    Chip(
        onClick = {
            // Dial, not call: the person confirms. Watches without their own SIM hand it to the phone.
            runCatching { context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:127")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
        },
        label = { Text(stringResource(R.string.call_127)) },
        colors = ChipDefaults.secondaryChipColors(),
        modifier = Modifier.fillMaxWidth(),
    )
}

// ---- SOS ----------------------------------------------------------------------------------------

@Composable
private fun CountdownScreen(onDone: () -> Unit, onCancel: () -> Unit) {
    var left by remember { mutableIntStateOf(COUNTDOWN_S) }
    LaunchedEffect(Unit) {
        while (left > 0) { delay(1_000); left-- }
        onDone()
    }
    Column(Modifier.fillMaxSize().background(Red).padding(16.dp), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(stringResource(R.string.sending_sos_in), color = Color.White, fontSize = 14.sp)
        Text("$left", color = Color.White, fontSize = 56.sp, fontWeight = FontWeight.Black)
        Button(onClick = onCancel, colors = ButtonDefaults.buttonColors(backgroundColor = Color.White), modifier = Modifier.fillMaxWidth(0.7f).padding(top = 6.dp)) {
            Text(stringResource(R.string.cancel), color = Red, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun AreYouOkScreen(onOk: () -> Unit, onTimeout: (HeartCheck.Verdict, Int) -> Unit) {
    val context = LocalContext.current
    val pending = remember { Alert.pending(context) }
    if (pending == null) { LaunchedEffect(Unit) { onOk() }; return }
    val (verdict, bpm, startedAt) = pending
    var left by remember { mutableIntStateOf(0) }
    LaunchedEffect(Unit) {
        while (true) {
            left = ((startedAt + Alert.ANSWER_MS - System.currentTimeMillis()) / 1000).toInt().coerceAtLeast(0)
            if (left == 0) { onTimeout(verdict, bpm); return@LaunchedEffect }
            delay(250)
        }
    }
    Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(stringResource(R.string.are_you_ok), fontSize = 20.sp, fontWeight = FontWeight.Bold)
        Text(stringResource(R.string.alert_text, bpm), color = Muted, fontSize = 12.sp, textAlign = TextAlign.Center)
        Button(onClick = onOk, colors = ButtonDefaults.buttonColors(backgroundColor = Teal, contentColor = Color.White), modifier = Modifier.fillMaxWidth(0.8f).padding(vertical = 8.dp)) {
            Text(stringResource(R.string.im_ok), fontWeight = FontWeight.Bold)
        }
        Text(stringResource(R.string.sos_in_s, left), color = Red, fontSize = 13.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun SendingScreen(reason: String, bpm: Int?, onStart: () -> Unit, onSent: () -> Unit, onNoLocation: () -> Unit, onUnpaired: () -> Unit) {
    val context = LocalContext.current
    var failed by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        onStart()
        // Keep trying: an SOS that fails once on a flaky connection must not just give up.
        while (true) {
            try {
                Sos.send(context, reason, bpm)
                Alert.clear(context)
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
    Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
        CircularProgressIndicator(indicatorColor = Red, modifier = Modifier.size(36.dp))
        Text(stringResource(if (failed) R.string.retrying else R.string.sending), fontSize = 15.sp, modifier = Modifier.padding(top = 8.dp))
        if (failed) Call127Chip()
    }
}

@Composable
private fun StatusScreen(onClosed: () -> Unit, onUnpaired: () -> Unit) {
    val context = LocalContext.current
    val store = remember { Store(context) }
    val scope = rememberCoroutineScope()
    var emergency by remember { mutableStateOf<JSONObject?>(null) }
    var confirmCancel by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
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
    val status = e?.optString("status")
    val responder = e?.optJSONObject("responder")?.optString("name")
    val etaMin = e?.optInt("etaSeconds", 0)?.takeIf { it > 0 }?.let { (it + 59) / 60 }
    val list = rememberScalingLazyListState(initialCenterItemIndex = 0)
    ScalingLazyColumn(state = list, modifier = Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
        item {
            Text(
                when (status) {
                    "on_scene" -> stringResource(R.string.help_here)
                    "assigned", "en_route" -> stringResource(R.string.help_coming)
                    else -> stringResource(R.string.finding_help)
                },
                fontSize = 18.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center,
                color = if (status == "pending" || status == null) Color.White else Teal,
            )
        }
        if (responder != null && status != "pending") item { Text(responder, color = Muted, fontSize = 13.sp) }
        if (etaMin != null && status in setOf("assigned", "en_route")) item { Text(stringResource(R.string.eta_min, etaMin), fontSize = 28.sp, fontWeight = FontWeight.Bold) }
        if (status == "pending" || status == null) item { Text(stringResource(R.string.stay_calm), color = Muted, fontSize = 12.sp, textAlign = TextAlign.Center) }
        item { Call127Chip() }
        item {
            Chip(
                onClick = {
                    if (!confirmCancel) { confirmCancel = true; return@Chip }
                    val id = e?.optString("_id") ?: return@Chip
                    scope.launch {
                        runCatching { Api.call("POST", "/watch/sos/$id/cancel", key = store.key) }
                            .onSuccess { onClosed() }
                    }
                },
                label = { Text(stringResource(if (confirmCancel) R.string.tap_again_to_cancel else R.string.im_ok_cancel)) },
                colors = ChipDefaults.secondaryChipColors(),
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
private fun NoLocationScreen(onRetry: () -> Unit) {
    val list = rememberScalingLazyListState(initialCenterItemIndex = 0)
    ScalingLazyColumn(state = list, modifier = Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
        item { Text(stringResource(R.string.no_location), fontSize = 14.sp, textAlign = TextAlign.Center, modifier = Modifier.padding(horizontal = 8.dp)) }
        item { Call127Chip() }
        item { Chip(onClick = onRetry, label = { Text(stringResource(R.string.try_again)) }, colors = ChipDefaults.secondaryChipColors(), modifier = Modifier.fillMaxWidth()) }
    }
}

// ---- Medical ID ---------------------------------------------------------------------------------

@Composable
private fun MedicalScreen(onBack: () -> Unit, onUnpaired: () -> Unit) {
    val context = LocalContext.current
    val store = remember { Store(context) }
    var lines by remember { mutableStateOf(store.medical) }
    LaunchedEffect(Unit) {
        // Cached copy shows at once and works offline; refresh it when we can.
        runCatching { Api.call("GET", "/watch/medical-id", key = store.key) }
            .onSuccess { res ->
                val arr = res.getJSONArray("lines")
                lines = List(arr.length()) { arr.getString(it) }
                store.medical = lines
            }
            .onFailure { if ((it as? Api.HttpError)?.code == 401) onUnpaired() }
    }
    val list = rememberScalingLazyListState(initialCenterItemIndex = 0)
    ScalingLazyColumn(state = list, modifier = Modifier.fillMaxSize()) {
        item { Text(stringResource(R.string.medical_id), color = Red, fontSize = 13.sp, fontWeight = FontWeight.Bold, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center) }
        if (lines.isEmpty()) item { Text(stringResource(R.string.loading), color = Muted, fontSize = 13.sp) }
        lines.forEachIndexed { i, line ->
            item {
                Text(
                    if (i == 0) line.removePrefix("VITALIS · ") else line,
                    fontSize = if (i == 0) 16.sp else 14.sp,
                    fontWeight = if (i == 0) FontWeight.Bold else FontWeight.Normal,
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 18.dp),
                )
            }
        }
        item { Chip(onClick = onBack, label = { Text(stringResource(R.string.back)) }, colors = ChipDefaults.secondaryChipColors(), modifier = Modifier.fillMaxWidth()) }
    }
}
