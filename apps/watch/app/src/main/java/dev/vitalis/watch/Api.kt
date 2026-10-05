package dev.vitalis.watch

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/** The Vitalis API. Paired calls carry the watch key ("Authorization: Watch <key>"). */
object Api {
    class HttpError(val code: Int, message: String) : Exception(message)

    suspend fun call(method: String, path: String, body: JSONObject? = null, key: String? = null): JSONObject =
        withContext(Dispatchers.IO) {
            val c = URL(BuildConfig.API_URL + path).openConnection() as HttpURLConnection
            try {
                c.requestMethod = method
                c.connectTimeout = 10_000
                c.readTimeout = 15_000
                c.setRequestProperty("Content-Type", "application/json")
                if (key != null) c.setRequestProperty("Authorization", "Watch $key")
                if (body != null) {
                    c.doOutput = true
                    c.outputStream.use { it.write(body.toString().toByteArray()) }
                }
                val code = c.responseCode
                val text = (if (code < 400) c.inputStream else c.errorStream)?.bufferedReader()?.use { it.readText() }.orEmpty()
                if (code >= 400) throw HttpError(code, runCatching { JSONObject(text).getString("error") }.getOrDefault("HTTP $code"))
                if (text.isBlank()) JSONObject() else JSONObject(text)
            } finally {
                c.disconnect()
            }
        }
}
