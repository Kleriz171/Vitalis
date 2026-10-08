import { requireOptionalNativeModule } from 'expo';
import type * as SR from 'expo-speech-recognition';

// Expo Go has no speech-recognition module: importing the package there crashes the screen.
// Load it only when the native side exists, so voice input simply hides in Expo Go.
const has = !!requireOptionalNativeModule('ExpoSpeechRecognition');
const pkg: typeof SR | null = has ? require('expo-speech-recognition') : null;

export const speech = pkg?.ExpoSpeechRecognitionModule ?? null;
export const useSpeechEvent: typeof SR.useSpeechRecognitionEvent = pkg?.useSpeechRecognitionEvent ?? (() => {});
