package expo.modules.keywordspotter

import android.Manifest
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Log
import androidx.core.content.ContextCompat
import com.k2fsa.sherpa.onnx.KeywordSpotter
import com.k2fsa.sherpa.onnx.KeywordSpotterConfig
import com.k2fsa.sherpa.onnx.OnlineModelConfig
import com.k2fsa.sherpa.onnx.OnlineTransducerModelConfig
import com.k2fsa.sherpa.onnx.getFeatureConfig
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val RATE = 16000

/** Listens to the microphone on a background thread and reports keywords from assets/kws/keywords.txt. */
class KeywordSpotterModule : Module() {
  @Volatile private var running = false
  private var worker: Thread? = null

  override fun definition() = ModuleDefinition {
    Name("KeywordSpotter")
    Events("onKeyword", "onError")

    // threshold: higher = fewer false alarms, more misses. The calibration knob for real phones.
    Function("start") { threshold: Double -> start(threshold.toFloat()) }
    Function("stop") { stop() }
    OnDestroy { stop() }
  }

  private fun start(threshold: Float) {
    if (running) return
    val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
      throw CodedException("ERR_NO_MIC", "Microphone permission is not granted", null)
    }
    running = true
    worker = Thread({
      var recorder: AudioRecord? = null
      var spotter: KeywordSpotter? = null
      try {
        spotter = KeywordSpotter(
          context.assets,
          KeywordSpotterConfig(
            featConfig = getFeatureConfig(RATE, 80),
            modelConfig = OnlineModelConfig(
              transducer = OnlineTransducerModelConfig(encoder = "kws/encoder.onnx", decoder = "kws/decoder.onnx", joiner = "kws/joiner.onnx"),
              tokens = "kws/tokens.txt",
              modelType = "zipformer2",
              numThreads = 1,
            ),
            keywordsFile = "kws/keywords.txt",
            keywordsThreshold = threshold,
          ),
        )
        val stream = spotter.createStream()
        val minBuffer = AudioRecord.getMinBufferSize(RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
        recorder = AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, maxOf(minBuffer, 6400))
        recorder.startRecording()
        val chunk = ShortArray(RATE / 10) // 100 ms
        while (running) {
          val n = recorder.read(chunk, 0, chunk.size)
          if (n <= 0) continue
          stream.acceptWaveform(FloatArray(n) { chunk[it] / 32768f }, RATE)
          while (spotter.isReady(stream)) {
            spotter.decode(stream)
            val keyword = spotter.getResult(stream).keyword
            if (keyword.isNotEmpty()) {
              spotter.reset(stream)
              sendEvent("onKeyword", mapOf("keyword" to keyword))
            }
          }
        }
        stream.release()
      } catch (e: Throwable) {
        Log.e("KeywordSpotter", "stopped", e)
        running = false
        sendEvent("onError", mapOf("message" to (e.message ?: e.toString())))
      } finally {
        recorder?.run { runCatching { stop() }; release() }
        spotter?.release()
      }
    }, "keyword-spotter").apply { start() }
  }

  private fun stop() {
    running = false
    worker?.join(1000)
    worker = null
  }
}
