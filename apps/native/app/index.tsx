import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Redirect, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { SvgXml } from 'react-native-svg';
import { Phone } from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { courseArt } from '@/lib/courseArt';
import { callNumber } from '@/lib/geo';
import { RootState } from '@/lib/store';
import { colors, fonts, type } from '@/lib/theme';

// Before sign-in the only emergency action is the ambulance number: SOS needs an account,
// so responders know who they are running to and paramedics get the Bio Passport.
export default function Welcome() {
  const router = useRouter();
  const token = useSelector((s: RootState) => s.auth.accessToken);
  const hydrated = useSelector((s: RootState) => s.auth.hydrated);

  if (hydrated && token) return <Redirect href="/(tabs)/home" />;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="auto" />
      <View style={styles.top}>
        <Text style={styles.wordmark}>Vitalis</Text>
      </View>

      <View style={styles.middle}>
        <SvgXml xml={courseArt('cpr-adult')!} width={168} height={168} />
        <Text style={styles.headline} accessibilityRole="header">Help arrives before the ambulance.</Text>
        <Text style={styles.body}>
          When someone near you collapses, Vitalis alerts people trained in CPR who are close by, and gives paramedics your medical ID.
        </Text>
      </View>

      <View style={styles.bottom}>
        <Button size="lg" onPress={() => router.push('/login')}>Get started</Button>
        <Button size="lg" variant="outline" onPress={() => callNumber('127')} accessibilityHint="Calls the ambulance">
          <Phone size={18} color={colors.destructive} />
          <Text style={styles.callText}>Emergency? Call 127</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 24 },
  top: { paddingTop: 12 },
  wordmark: { fontFamily: fonts.displayBold, fontSize: 22, color: colors.primaryStrong },
  middle: { flex: 1, justifyContent: 'center', gap: 16 },
  headline: { fontFamily: fonts.display, fontSize: 36, lineHeight: 40, letterSpacing: -0.6, color: colors.foreground },
  body: { ...type.body, color: colors.mutedForeground },
  bottom: { gap: 12, paddingBottom: 12 },
  callText: { ...type.headline, color: colors.destructive },
});
