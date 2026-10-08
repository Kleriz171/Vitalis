package dev.vitalis.watch.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Emergency
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.Text
import dev.vitalis.watch.R
import dev.vitalis.watch.core.Api
import dev.vitalis.watch.core.Store
import dev.vitalis.watch.ui.design.IconTile
import dev.vitalis.watch.ui.design.SolidButton
import dev.vitalis.watch.ui.design.VitalisColors

/** The Medical ID from the Bio Passport: name first, then one card per "Label: value" fact. */
@Composable
fun MedicalScreen(onBack: () -> Unit, onUnpaired: () -> Unit) {
    val context = LocalContext.current
    val store = remember { Store(context) }
    var lines by remember { mutableStateOf(store.medical) }
    LaunchedEffect(Unit) {
        // The cached copy shows at once and works offline; refresh it when we can.
        runCatching { Api.call("GET", "/watch/medical-id", key = store.key) }
            .onSuccess { res ->
                val arr = res.getJSONArray("lines")
                lines = List(arr.length()) { arr.getString(it) }
                store.medical = lines
            }
            .onFailure { if ((it as? Api.HttpError)?.code == 401) onUnpaired() }
    }
    val list = rememberScalingLazyListState(initialCenterItemIndex = 0)
    ScalingLazyColumn(state = list, modifier = Modifier.fillMaxSize().padding(horizontal = 10.dp)) {
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                IconTile(Icons.Filled.Emergency, VitalisColors.Sos)
                Column {
                    Text(stringResource(R.string.medical_id), color = VitalisColors.Sos, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    lines.firstOrNull()?.let {
                        Text(it.removePrefix("VITALIS · "), color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.ExtraBold, maxLines = 2)
                    }
                }
            }
        }
        if (lines.isEmpty()) item { Text(stringResource(R.string.loading), color = VitalisColors.OnGreenMuted, fontSize = 13.sp) }
        lines.drop(1).forEach { line ->
            val parts = line.split(':', limit = 2).map { it.trim() }
            item {
                Column(Modifier.fillMaxWidth().background(VitalisColors.Paper, RoundedCornerShape(14.dp)).padding(10.dp)) {
                    if (parts.size == 2) Text(parts[0], color = VitalisColors.InkMuted, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                    Text(parts.last(), color = VitalisColors.Ink, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                }
            }
        }
        item { SolidButton(stringResource(R.string.back), onBack, fill = Color.White.copy(alpha = 0.15f)) }
    }
}
