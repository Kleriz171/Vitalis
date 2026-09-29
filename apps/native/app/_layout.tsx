import { useCallback, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import '@/lib/dutyLocation'; // registers the background task at startup
import { registerForPush, routeForNotification } from '@/lib/push';
import { useFallDetection, useFallDetectionEnabled } from '@/lib/fallDetection';
import { useWakeWord, useWakeWordEnabled, wakeWordSupported } from '@/lib/wakeWord';
import { MicIndicator } from '@/components/MicIndicator';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Provider, useSelector } from 'react-redux';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Toaster, toast } from 'sonner-native';
import { t } from '@/lib/i18n';
import 'react-native-reanimated';

import { colors } from '@/lib/theme';
import { loadSession, RootState, store } from '@/lib/store';

export default function RootLayout() {
  useEffect(() => { void loadSession(); }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Provider store={store}>
          <AuthGate>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="login" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="sos" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
              {/* No swipe-to-dismiss: leaving a live SOS must be a deliberate choice. */}
              <Stack.Screen name="emergency" options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }} />
              <Stack.Screen name="responder-inbox" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="aeds" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="handover/[id]" options={{ presentation: 'modal' }} />
              <Stack.Screen name="assistant" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="checkin" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="fall" options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }} />
              <Stack.Screen name="training" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="doctor-application" options={{ animation: 'slide_from_right' }} />
            </Stack>
          </AuthGate>
          <Toaster position="top-center" />
          <StatusBar style="dark" />
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const token = useSelector((s: RootState) => s.auth.accessToken);
  const hydrated = useSelector((s: RootState) => s.auth.hydrated);
  const segments = useSegments();
  const router = useRouter();

  // Fall detection (Profile switch): never on top of an SOS that is already running.
  const fallOn = useFallDetectionEnabled();
  const where = useRef(segments[0]);
  where.current = segments[0]; // a ref, so navigating does not restart the sensor
  const onFall = useCallback(() => {
    if (!['emergency', 'fall'].includes(where.current as string)) router.push('/fall');
  }, [router]);
  useFallDetection(hydrated && !!token && fallOn, onFall);

  // "Hey Vitalis" (Profile switch). Paused where the screen itself uses the mic or an SOS runs.
  const wakeOn = useWakeWordEnabled();
  const listening = wakeWordSupported && hydrated && !!token && wakeOn && !['assistant', 'emergency', 'fall'].includes(segments[0] as string);
  const onWake = useCallback(() => router.push({ pathname: '/assistant', params: { listen: '1' } } as never), [router]);
  const onVoiceSos = useCallback(() => router.push({ pathname: '/emergency', params: { start: '1', reason: 'voice' } } as never), [router]);
  const onWakeError = useCallback(() => toast.error(t('“Hey Vitalis” was switched off: the microphone is not available.')), []);
  useWakeWord(listening, onWake, onVoiceSos, onWakeError);

  // Register for push once signed in; follow taps on notifications (also from a cold start).
  useEffect(() => {
    if (!hydrated || !token) return;
    registerForPush().catch(() => {});
    const open = (r: Notifications.NotificationResponse | null) => {
      const to = routeForNotification(r?.notification.request.content.data as Record<string, unknown>);
      if (to) router.push(to as never);
    };
    Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [hydrated, token, router]);

  useEffect(() => {
    if (!hydrated) return;
    const inProtected = ['(tabs)', 'emergency', 'responder-inbox', 'aeds', 'handover', 'assistant', 'training', 'doctor-application', 'checkin', 'fall'].includes(segments[0] as string);
    if (!token && inProtected) router.replace('/');
  }, [hydrated, token, segments, router]);

  // Rendering routes before the stored session loads fires unauthenticated requests,
  // and the 401 handler would then wipe the saved session.
  if (!hydrated) return null;
  return <>{children}{listening ? <MicIndicator /> : null}</>;
}
