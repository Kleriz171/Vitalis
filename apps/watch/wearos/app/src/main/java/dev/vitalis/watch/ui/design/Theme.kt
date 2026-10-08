package dev.vitalis.watch.ui.design

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.wear.compose.material.Colors
import androidx.wear.compose.material.MaterialTheme

/** Vitalis colours. Same values as the phone app and the Apple Watch app (apps/watch/README.md). */
object VitalisColors {
    val Green = Color(0xFF0C5D57)        // screen background, top
    val Deep = Color(0xFF084540)         // screen background, bottom
    val Teal = Color(0xFF14A897)         // live, selected, primary actions
    val Sos = Color(0xFFE14545)          // SOS and danger only
    val Paper = Color(0xFFF7F5F0)        // cards
    val PaperPressed = Color(0xFFE6E2D8)
    val Ink = Color(0xFF13201F)          // text on cards
    val InkMuted = Color(0xFF556362)
    val OnGreenMuted = Color.White.copy(alpha = 0.75f)
}

@Composable
fun VitalisTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colors = Colors(primary = VitalisColors.Teal, secondary = VitalisColors.Teal, error = VitalisColors.Sos, background = VitalisColors.Deep),
    ) {
        // The phone app's deep-green screen colour, darkening toward the bottom.
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(VitalisColors.Green, VitalisColors.Deep)))) {
            content()
        }
    }
}
