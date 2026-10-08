package dev.vitalis.watch.ui.design

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.VibrationEffect
import android.os.Vibrator
import android.view.HapticFeedbackConstants
import android.view.View
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.LinearOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Phone
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.Icon
import androidx.wear.compose.material.Text
import dev.vitalis.watch.R
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

// The phone app's language, made for the wrist: off-white cards on the Vitalis green, round
// tinted icon tiles, teal for live and selected, red only for SOS. Mirrors the Apple Watch's
// Design/Components.swift; keep the two in step.

/** Round icon tile, like the phone app's row icons. */
@Composable
fun IconTile(icon: ImageVector, tint: Color = VitalisColors.Teal) {
    Box(Modifier.size(32.dp).background(tint.copy(alpha = 0.14f), CircleShape), contentAlignment = Alignment.Center) {
        Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(17.dp))
    }
}

/** An off-white card that dims slightly while pressed. The base for every tappable row. */
@Composable
fun PaperCard(onClick: () -> Unit, modifier: Modifier = Modifier, content: @Composable RowScope.() -> Unit) {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val scale by animateFloatAsState(if (pressed) 0.97f else 1f, tween(150), label = "press")
    Row(
        modifier
            .fillMaxWidth()
            .graphicsLayer { scaleX = scale; scaleY = scale }
            .background(if (pressed) VitalisColors.PaperPressed else VitalisColors.Paper, RoundedCornerShape(22.dp))
            .clickable(interaction, indication = null, onClick = onClick)
            .defaultMinSize(minHeight = 52.dp)
            .padding(horizontal = 10.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
        content = content,
    )
}

/** A full-width row: icon tile, title, one line under it, and whatever sits on the right. */
@Composable
fun CardRow(
    icon: ImageVector,
    title: String,
    onClick: () -> Unit,
    tint: Color = VitalisColors.Teal,
    subtitle: String? = null,
    modifier: Modifier = Modifier,
    trailing: @Composable () -> Unit = {},
) {
    PaperCard(onClick, modifier) {
        IconTile(icon, tint)
        Column(Modifier.weight(1f)) {
            Text(title, color = VitalisColors.Ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, lineHeight = 17.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            if (subtitle != null) Text(subtitle, color = VitalisColors.InkMuted, fontSize = 12.sp, maxLines = 1)
        }
        trailing()
    }
}

/** Big filled action (I'm OK, Cancel): solid colour, bold text. */
@Composable
fun SolidButton(text: String, onClick: () -> Unit, fill: Color = VitalisColors.Teal, textColor: Color = Color.White) {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val scale by animateFloatAsState(if (pressed) 0.97f else 1f, tween(150), label = "press")
    Box(
        Modifier
            .fillMaxWidth()
            .graphicsLayer { scaleX = scale; scaleY = scale; alpha = if (pressed) 0.85f else 1f }
            .background(fill, CircleShape)
            .clickable(interaction, indication = null, role = Role.Button, onClick = onClick)
            .defaultMinSize(minHeight = 46.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(text, color = textColor, fontSize = 16.sp, fontWeight = FontWeight.Bold)
    }
}

/** Items rise in one after another when a screen opens. */
@Composable
fun Modifier.rise(order: Int): Modifier {
    val shown = remember { Animatable(0f) }
    LaunchedEffect(Unit) { shown.animateTo(1f, tween(500, delayMillis = order * 80, easing = LinearOutSlowInEasing)) }
    return graphicsLayer { alpha = shown.value; translationY = (1 - shown.value) * 14.dp.toPx() }
}

@Composable
fun BrandMark() {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Box(Modifier.size(20.dp).background(VitalisColors.Teal, RoundedCornerShape(6.dp)), contentAlignment = Alignment.Center) {
            Icon(Icons.Filled.Favorite, contentDescription = null, tint = Color.White, modifier = Modifier.size(12.dp))
        }
        Text("Vitalis", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold)
    }
}

const val HOLD_MS = 3_000

/** Press and hold for 3 s while a ring fills; letting go early cancels. */
@Composable
fun HoldSosButton(onSos: () -> Unit, modifier: Modifier = Modifier) {
    val progress = remember { Animatable(0f) }
    var pressing by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val view = LocalView.current
    val label = stringResource(R.string.hold_for_sos)
    val glow by rememberInfiniteTransition(label = "breathe")
        .animateFloat(0f, 1f, infiniteRepeatable(tween(1_600, easing = FastOutSlowInEasing), RepeatMode.Reverse), label = "glow")
    val scale by animateFloatAsState(if (pressing) 0.95f else 1f, tween(200), label = "press")

    Box(
        modifier
            .size(120.dp)
            .graphicsLayer { scaleX = scale; scaleY = scale }
            // Screen readers can't hold; a double tap opens the countdown, which can still be cancelled.
            .semantics { contentDescription = label; role = Role.Button; onClick(label) { onSos(); true } }
            .pointerInput(Unit) {
                detectTapGestures(onPress = {
                    pressing = true
                    val hold = scope.launch {
                        // A tick each second while the ring fills, so you feel it without looking.
                        launch { repeat(HOLD_MS / 1_000 - 1) { delay(1_000); Haptics.tick(view) } }
                        progress.animateTo(1f, tween(HOLD_MS, easing = LinearEasing))
                        Haptics.confirm(view)
                        onSos()
                    }
                    tryAwaitRelease()
                    pressing = false
                    if (progress.value < 1f) {
                        hold.cancel()
                        scope.launch { progress.animateTo(0f, tween(250)) }
                    }
                })
            },
        contentAlignment = Alignment.Center,
    ) {
        Box(
            Modifier.size(118.dp)
                .graphicsLayer { val s = 0.92f + 0.12f * glow; scaleX = s; scaleY = s; alpha = 1f - 0.4f * glow }
                .background(VitalisColors.Sos.copy(alpha = 0.22f), CircleShape),
        )
        Box(
            Modifier.size(98.dp)
                .shadow(10.dp, CircleShape, ambientColor = VitalisColors.Sos, spotColor = VitalisColors.Sos)
                .background(Brush.verticalGradient(listOf(Color(0xFFED5454), VitalisColors.Sos)), CircleShape),
        )
        Canvas(Modifier.size(110.dp)) {
            drawArc(Color.White, -90f, 360f * progress.value, useCenter = false, style = Stroke(4.dp.toPx(), cap = StrokeCap.Round))
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy((-2).dp)) {
            Text("SOS", color = Color.White, fontSize = 30.sp, fontWeight = FontWeight.Black)
            Text(stringResource(R.string.hold), color = Color.White.copy(alpha = 0.85f), fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
fun Call127Card(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    CardRow(
        icon = Icons.Filled.Phone,
        title = stringResource(R.string.call_127),
        subtitle = stringResource(R.string.ambulance),
        modifier = modifier,
        onClick = {
            // Dial, not call: the person confirms. Watches without their own SIM hand it to the phone.
            runCatching { context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:127")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
        },
    )
}

/** Muted text on the green screen. */
@Composable
fun Note(text: String, modifier: Modifier = Modifier) {
    Text(text, color = VitalisColors.OnGreenMuted, fontSize = 12.sp, textAlign = TextAlign.Center, modifier = modifier)
}

object Haptics {
    fun tick(view: View) { view.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK) }
    fun confirm(view: View) { view.performHapticFeedback(HapticFeedbackConstants.CONFIRM) }

    /** A strong buzz that ignores the touch-feedback setting: for "Are you OK?". */
    fun alert(context: Context) {
        context.getSystemService(Vibrator::class.java)?.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 300, 150, 300), -1))
    }
}
