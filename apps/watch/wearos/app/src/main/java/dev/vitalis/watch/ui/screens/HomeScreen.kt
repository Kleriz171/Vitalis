package dev.vitalis.watch.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Emergency
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.AutoCenteringParams
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.ScalingLazyListAnchorType
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.Icon
import androidx.wear.compose.material.Text
import dev.vitalis.watch.BuildConfig
import dev.vitalis.watch.R
import dev.vitalis.watch.core.Api
import dev.vitalis.watch.core.Store
import dev.vitalis.watch.heart.Heart
import dev.vitalis.watch.sos.Sos
import dev.vitalis.watch.ui.design.CardRow
import dev.vitalis.watch.ui.design.Call127Card
import dev.vitalis.watch.ui.design.HeartCard
import dev.vitalis.watch.ui.design.HoldSosButton
import dev.vitalis.watch.ui.design.VitalisColors
import dev.vitalis.watch.ui.design.rise
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** SOS in the middle of the screen; the heart card, Medical ID and Call 127 a scroll away. */
@Composable
fun HomeScreen(onSos: () -> Unit, onMedical: () -> Unit, onActiveSos: () -> Unit, onUnpaired: () -> Unit) {
    val context = LocalContext.current
    val store = remember { Store(context) }
    val scope = rememberCoroutineScope()
    var heartOn by remember { mutableStateOf(store.heartOn) }
    var readings by remember { mutableStateOf(store.readings()) }

    // Ask once for what the app needs: sensors and activity for the heart check, location for
    // the SOS, notifications for "Are you OK?". Background sensors come in a second request.
    val background = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
        if (heartOn) scope.launch { Heart.start(context) }
    }
    val permissions = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { granted ->
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
        if (wanted.isNotEmpty()) permissions.launch(wanted.toTypedArray()) else if (heartOn) Heart.start(context)
        // Keep a recent position for an SOS sent while the app is closed.
        Sos.locate(context)
        // An SOS already running (sent from here or the phone)? Go straight to its status.
        runCatching { Api.call("GET", "/watch/sos", key = store.key) }
            .onSuccess { if (!it.isNull("emergency")) onActiveSos() }
            .onFailure { if ((it as? Api.HttpError)?.code == 401) onUnpaired() }
        while (true) { readings = store.readings(); delay(10_000) }
    }

    val list = rememberScalingLazyListState(initialCenterItemIndex = 0)
    ScalingLazyColumn(
        state = list,
        anchorType = ScalingLazyListAnchorType.ItemCenter,
        autoCentering = AutoCenteringParams(itemIndex = 0),
        modifier = Modifier.fillMaxSize().padding(horizontal = 10.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        item { HoldSosButton(onSos, Modifier.padding(vertical = 6.dp).rise(0)) }
        item {
            HeartCard(
                on = heartOn,
                onToggle = { on ->
                    heartOn = on
                    store.heartOn = on
                    scope.launch { if (on) Heart.start(context) else Heart.stop(context) }
                },
                readings = readings,
                modifier = Modifier.rise(1),
            )
        }
        item {
            CardRow(
                icon = Icons.Filled.Emergency, tint = VitalisColors.Sos,
                title = stringResource(R.string.medical_id),
                subtitle = store.medical.getOrNull(1),
                onClick = onMedical,
                modifier = Modifier.rise(2),
                trailing = { Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, null, tint = VitalisColors.InkMuted, modifier = Modifier.size(16.dp)) },
            )
        }
        item { Call127Card(Modifier.rise(3)) }
        if (BuildConfig.DEBUG) item {
            Text(
                "Test: high heart rate", color = VitalisColors.OnGreenMuted, fontSize = 12.sp,
                modifier = Modifier.padding(top = 4.dp).clickable { Heart.simulate(context, 172); readings = store.readings() },
            )
        }
        store.name?.let { item { Text(it, color = VitalisColors.OnGreenMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 2.dp).rise(4)) } }
    }
}
