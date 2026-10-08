package dev.vitalis.watch.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.Text
import dev.vitalis.watch.R
import dev.vitalis.watch.heart.HeartAlert
import dev.vitalis.watch.heart.HeartCheck
import dev.vitalis.watch.ui.design.BeatingHeart
import dev.vitalis.watch.ui.design.Haptics
import dev.vitalis.watch.ui.design.SolidButton
import dev.vitalis.watch.ui.design.VitalisColors
import kotlinx.coroutines.delay

/** "Are you OK?" after a worrying resting heart rate: 30 s to answer, then the SOS goes out. */
@Composable
fun AreYouOkScreen(onOk: () -> Unit, onTimeout: (HeartCheck.Verdict, Int) -> Unit) {
    val context = LocalContext.current
    val pending = remember { HeartAlert.pending(context) }
    if (pending == null) { LaunchedEffect(Unit) { onOk() }; return }
    val (verdict, bpm, startedAt) = pending
    var left by remember { mutableIntStateOf(30) }
    LaunchedEffect(Unit) {
        while (true) {
            left = ((startedAt + HeartAlert.ANSWER_MS - System.currentTimeMillis() + 999) / 1000).toInt().coerceAtLeast(0)
            if (left == 0) { onTimeout(verdict, bpm); return@LaunchedEffect }
            if (left % 5 == 0) Haptics.alert(context)
            delay(1_000)
        }
    }
    Column(
        Modifier.fillMaxSize().padding(horizontal = 22.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // Beats at the rate that raised the alert.
        BeatingHeart(bpm, Modifier.scale(1.25f))
        Text(stringResource(R.string.are_you_ok), color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.ExtraBold)
        Text(stringResource(R.string.resting_rate, bpm), color = VitalisColors.OnGreenMuted, fontSize = 12.sp, textAlign = TextAlign.Center)
        SolidButton(stringResource(R.string.im_ok), onOk)
        Text(stringResource(R.string.sos_in_s, left), color = VitalisColors.Sos, fontSize = 13.sp, fontWeight = FontWeight.Bold)
    }
}
