sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01 (int8), Apache-2.0,
https://github.com/k2-fsa/sherpa-onnx/releases/tag/kws-models

keywords.txt is generated from BPE tokens (bpe.model in that release):
"<tokens> @<kind>:<name>". <kind> is wake (open the assistant) or sos (SOS countdown).
Only multi-token English phrases work well; single words like HELP and
Albanian words never fired in tests, so Albanian cries go through the
full recogniser after the wake word (lib/voicePhrases.ts).
