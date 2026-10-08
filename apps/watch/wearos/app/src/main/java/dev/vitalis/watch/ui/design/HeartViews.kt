package dev.vitalis.watch.ui.design

import android.text.format.DateUtils
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.withFrameMillis
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathMeasure
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.Icon
import androidx.wear.compose.material.Switch
import androidx.wear.compose.material.SwitchDefaults
import androidx.wear.compose.material.Text
import dev.vitalis.watch.R
import kotlin.math.PI
import kotlin.math.max
import kotlin.math.sin

/** The heart card: the latest resting rate, a heart beating at that rate, and the last hours. */
@Composable
fun HeartCard(on: Boolean, onToggle: (Boolean) -> Unit, readings: List<Pair<Long, Int>>, modifier: Modifier = Modifier) {
    val last = readings.lastOrNull()
    Column(
        modifier
            .fillMaxWidth()
            .background(VitalisColors.Paper, RoundedCornerShape(20.dp))
            .toggleable(on, role = Role.Switch, onValueChange = onToggle)
            .padding(horizontal = 10.dp, vertical = 7.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
            BeatingHeart(if (on) last?.second else null)
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text(
                        if (on) last?.second?.toString() ?: "--" else stringResource(R.string.off),
                        color = VitalisColors.Ink, fontSize = 22.sp, fontWeight = FontWeight.ExtraBold,
                    )
                    if (on && last != null) {
                        Text("bpm", color = VitalisColors.InkMuted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(bottom = 3.dp))
                    }
                }
                Text(
                    when {
                        !on -> stringResource(R.string.heart_off)
                        last == null -> stringResource(R.string.waiting)
                        System.currentTimeMillis() - last.first < DateUtils.MINUTE_IN_MILLIS -> stringResource(R.string.now)
                        else -> DateUtils.getRelativeTimeSpanString(last.first, System.currentTimeMillis(), DateUtils.MINUTE_IN_MILLIS, DateUtils.FORMAT_ABBREV_RELATIVE).toString()
                    },
                    color = VitalisColors.InkMuted, fontSize = 10.sp, maxLines = 1,
                )
            }
            Switch(
                checked = on,
                colors = SwitchDefaults.colors(
                    checkedThumbColor = VitalisColors.Teal, checkedTrackColor = VitalisColors.Teal.copy(alpha = 0.5f),
                    uncheckedThumbColor = VitalisColors.InkMuted, uncheckedTrackColor = VitalisColors.InkMuted.copy(alpha = 0.3f),
                ),
            )
        }
        if (on && readings.size >= 2) Sparkline(downsample(readings.map { it.second }), Modifier.fillMaxWidth().height(16.dp))
    }
}

/** A heart that beats at the given rate ("lub-dub"); still and grey when there is none. */
@Composable
fun BeatingHeart(bpm: Int?, modifier: Modifier = Modifier) {
    val tint = if (bpm == null) VitalisColors.InkMuted else VitalisColors.Sos
    val now by produceState(0L, bpm) { if (bpm != null) while (true) withFrameMillis { value = it } }
    Box(modifier.size(28.dp).background(tint.copy(alpha = 0.13f), CircleShape), contentAlignment = Alignment.Center) {
        Icon(
            Icons.Filled.Favorite, contentDescription = null, tint = tint,
            modifier = Modifier.size(16.dp).graphicsLayer {
                if (bpm == null) return@graphicsLayer
                val period = 60_000.0 / bpm.coerceIn(40, 180)
                val t = (now % period) / period
                // Two quick beats per cycle, like a real pulse.
                val beat = max(0.0, sin(t * PI * 4)) * (if (t < 0.5) 1.0 else 0.5)
                scaleX = 1 + beat.toFloat() * 0.18f
                scaleY = scaleX
            },
        )
    }
}

/** Resting heart rate over the last hours: a smooth teal line that draws itself, ending in a dot. */
@Composable
fun Sparkline(points: List<Int>, modifier: Modifier = Modifier) {
    val drawn = remember { Animatable(0f) }
    LaunchedEffect(Unit) { drawn.animateTo(1f, tween(900, delayMillis = 300, easing = LinearOutSlowInEasing)) }
    Canvas(modifier) {
        val lo = points.min() - 3f
        val hi = points.max() + 3f
        val xy = points.mapIndexed { i, v ->
            Offset(size.width * i / max(points.size - 1, 1), size.height * (1 - (v - lo) / max(hi - lo, 1f)))
        }
        val line = Path().apply {
            moveTo(xy.first().x, xy.first().y)
            xy.zipWithNext { a, b -> quadraticTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2) }
            lineTo(xy.last().x, xy.last().y)
        }
        val measure = PathMeasure().apply { setPath(line, false) }
        val part = Path().also { measure.getSegment(0f, measure.length * drawn.value, it, true) }
        drawPath(part, VitalisColors.Teal, style = Stroke(2.5.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round))
        drawCircle(VitalisColors.Teal, 3.5.dp.toPx(), xy.last(), alpha = drawn.value)
    }
}

/** Wear OS reports far more readings than fit 120 px; average them into at most [max] points. */
private fun downsample(values: List<Int>, max: Int = 60): List<Int> =
    if (values.size <= max) values else values.chunked((values.size + max - 1) / max) { it.average().toInt() }
