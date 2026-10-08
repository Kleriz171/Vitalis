package dev.vitalis.watch.ui.screens

import android.os.Build
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.Text
import dev.vitalis.watch.R
import dev.vitalis.watch.core.Api
import dev.vitalis.watch.core.Store
import dev.vitalis.watch.ui.design.BrandMark
import dev.vitalis.watch.ui.design.VitalisColors
import kotlinx.coroutines.delay
import org.json.JSONObject

/** Shows a 6-digit code to type in the phone app, and waits until the phone confirms it. */
@Composable
fun PairScreen(onPaired: () -> Unit) {
    val context = LocalContext.current
    var code by remember { mutableStateOf<String?>(null) }
    var offline by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        while (true) {
            try {
                offline = false
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
            } catch (e: Api.HttpError) {
                if (e.code == 404) continue // code expired: start over with a new one
                offline = true
                delay(5_000)
            } catch (e: Exception) {
                offline = true
                delay(5_000)
            }
        }
    }
    Column(
        Modifier.fillMaxSize().padding(horizontal = 22.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        BrandMark()
        Text(
            code?.chunked(3)?.joinToString(" ") ?: "··· ···",
            color = Color.White, fontSize = 36.sp, fontWeight = FontWeight.ExtraBold,
            modifier = Modifier.semantics { contentDescription = code?.toList()?.joinToString(" ").orEmpty() },
        )
        Text(
            stringResource(if (offline) R.string.pair_offline else R.string.pair_hint),
            color = VitalisColors.OnGreenMuted, fontSize = 13.sp, textAlign = TextAlign.Center,
        )
    }
}
