import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

type Events = {
  onKeyword: (e: { keyword: string }) => void; // "wake:HEY_VITALIS" or "sos:NOT_BREATHING"
  onError: (e: { message: string }) => void;
};

// ponytail: Android only for now; the iOS side (sherpa-onnx xcframework) comes with the iPhone build.
const native = Platform.OS === 'android' ? requireOptionalNativeModule<{
  start(threshold: number): void;
  stop(): void;
  addListener<K extends keyof Events>(name: K, cb: Events[K]): { remove(): void };
}>('KeywordSpotter') : null;

/** False in Expo Go, on web and on iPhone. */
export const isAvailable = !!native;

export const start = (threshold = 0.25) => native?.start(threshold);
export const stop = () => native?.stop();
export const addListener = <K extends keyof Events>(name: K, cb: Events[K]) => native?.addListener(name, cb);
