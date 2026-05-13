import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Provider, useSelector } from 'react-redux';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Toaster } from 'sonner-native';
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
              <Stack.Screen name="assistant" options={{ animation: 'slide_from_right' }} />
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

  useEffect(() => {
    if (!hydrated) return;
    const inProtected = segments[0] === '(tabs)';
    if (!token && inProtected) router.replace('/');
  }, [hydrated, token, segments, router]);

  return <>{children}</>;
}
