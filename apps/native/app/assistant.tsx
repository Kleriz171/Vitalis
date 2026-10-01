import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { speech, useSpeechEvent } from '@/lib/speech';
import { ArrowLeft, Bot, Mic, Send, Sparkles, User } from 'lucide-react-native';
import { AppScreen } from '@/components/AppScreen';
import { toast } from 'sonner-native';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { colors, radius } from '@/lib/theme';
import { apiError, lang, locale, t } from '@/lib/i18n';
import { isEmergencyPhrase } from '@/lib/voicePhrases';

interface Message {
  id: string;
  role: 'user' | 'bot';
  content: string;
}

const QUICK = [
  t('How does the SOS button work?'),
  t('CPR basics'),
  t('How do I update my Bio Passport?'),
  t('When should I see a doctor?'),
];

export default function Assistant() {
  const router = useRouter();
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'bot',
      content: t('Hi — I can help with general wellness questions. For emergencies, use the SOS controls on your home screen.'),
    },
  ]);

  // Voice: speak a question; an emergency phrase goes straight to the SOS countdown, never to the AI.
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState('');
  const canSpeak = useRef(false);
  const triedEnglish = useRef(false);
  const sosSent = useRef(false);
  const canListen = !!speech?.isRecognitionAvailable();
  const { listen: fromWakeWord } = useLocalSearchParams<{ listen?: string }>();

  useEffect(() => {
    // Speak replies only with a voice for the app language (no Albanian voice on most phones: text only).
    Speech.getAvailableVoicesAsync()
      .then(v => { canSpeak.current = v.some(x => x.language.toLowerCase().startsWith(lang)); })
      .catch(() => {});
    // Opened by "Hey Vitalis": listen straight away, once the wake-word listener has let go of the mic.
    const timer = fromWakeWord === '1' && canListen ? setTimeout(() => void listen(), 500) : undefined;
    return () => { clearTimeout(timer); Speech.stop(); speech?.abort(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useSpeechEvent('start', () => setListening(true));
  useSpeechEvent('end', () => { setListening(false); setHeard(''); });
  useSpeechEvent('error', (e) => {
    // iPhone has no Albanian recogniser: fall back to English once.
    if (e.error === 'language-not-supported' && !triedEnglish.current) { triedEnglish.current = true; void listen('en-US'); }
    else if (e.error !== 'no-speech' && e.error !== 'aborted') toast.error(t('Voice input is not available right now.'));
  });
  useSpeechEvent('result', (e) => {
    const text = e.results[0]?.transcript ?? '';
    setHeard(text);
    // Only final text: an interim "help" may still become "help me with CPR".
    if (!e.isFinal || !text.trim()) return;
    if (isEmergencyPhrase(text)) {
      if (sosSent.current) return;
      sosSent.current = true;
      speech?.abort();
      router.push({ pathname: '/emergency', params: { start: '1', reason: 'voice' } } as never);
    } else {
      void send(text, true);
    }
  });

  const listen = async (language = locale) => {
    Speech.stop();
    if (!speech) return;
    const perm = await speech.requestPermissionsAsync();
    if (!perm.granted) { toast.error(t('Allow the microphone to talk to Vitalis.')); return; }
    speech.start({ lang: language, interimResults: true });
  };

  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(timer);
  }, [messages.length]);

  const send = async (raw?: string, spoken = false) => { // a spoken question gets a spoken reply
    const content = (raw ?? input).trim();
    if (!content) return;

    setMessages((current) => [...current, { id: `u-${Date.now()}`, role: 'user', content }]);
    setInput('');

    try {
      const { data } = await api.post<{ reply: string }>('/ai/chat', { message: content });
      setMessages((current) => [...current, { id: `b-${Date.now()}`, role: 'bot', content: data.reply }]);
      if (spoken && canSpeak.current) Speech.speak(data.reply, { language: locale });
    } catch (e: any) {
      setMessages((current) => [...current, {
        id: `b-${Date.now()}`,
        role: 'bot',
        content: apiError(e, 'I could not reach the assistant. Please try again.'),
      }]);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppScreen
        tone="success"
        eyebrow={t('Wellness guidance')}
        title={t('Health assistant')}
        subtitle={t('A calmer space for quick health questions and everyday guidance.')}
        icon={<Sparkles size={24} color="#fff" />}
        scroll={false}
        bodyStyle={styles.screenBody}
        action={
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={16} color="#fff" />
          </Pressable>
        }
        footer={
          <>
            {listening ? (
              <Text style={styles.heard} accessibilityLiveRegion="polite">{heard || t('Listening…')}</Text>
            ) : null}
            <View style={styles.composerRow}>
              {canListen ? (
                <Pressable
                  onPress={() => (listening ? speech?.stop() : void listen())}
                  style={[styles.sendButton, styles.micButton, listening && styles.micButtonOn]}
                  accessibilityRole="button"
                  accessibilityLabel={listening ? t('Stop listening') : t('Speak your question')}
                >
                  <Mic size={20} color={listening ? '#fff' : colors.success} />
                </Pressable>
              ) : null}
              <View style={styles.inputWrap}>
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  placeholder={t('Ask a health question…')}
                  placeholderTextColor="#94A3B8"
                  multiline
                  style={styles.input}
                />
              </View>
              <Pressable
                onPress={() => void send()}
                disabled={!input.trim()}
                style={[styles.sendButton, !input.trim() && styles.sendButtonDisabled]}
              >
                <Send size={20} color="#fff" />
              </Pressable>
            </View>
            <Text style={styles.disclaimer}>{t('Not a substitute for a real doctor or emergency service.')}</Text>
          </>
        }
      >
        <ScrollView ref={scrollRef} contentContainerStyle={styles.messages} showsVerticalScrollIndicator={false}>
          {messages.map((message) => (
            <View key={message.id} style={[styles.messageRow, message.role === 'user' ? styles.messageRowUser : styles.messageRowBot]}>
              {message.role === 'bot' ? (
                <View style={styles.avatarBot}>
                  <Bot size={16} color={colors.success} />
                </View>
              ) : null}
              <View style={[styles.bubble, message.role === 'user' ? styles.bubbleUser : styles.bubbleBot]}>
                <Text style={[styles.bubbleText, message.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextBot]}>
                  {message.content}
                </Text>
              </View>
              {message.role === 'user' ? (
                <View style={styles.avatarUser}>
                  <User size={16} color={colors.primary} />
                </View>
              ) : null}
            </View>
          ))}

          {messages.length === 1 ? (
            <Card style={styles.quickCard}>
              <Text style={styles.quickTitle}>{t('Try a quick question')}</Text>
              <View style={styles.quickWrap}>
                {QUICK.map((question) => (
                  <Pressable key={question} onPress={() => void send(question)} style={styles.quickPill}>
                    <Text style={styles.quickPillText}>{question}</Text>
                  </Pressable>
                ))}
              </View>
            </Card>
          ) : null}
        </ScrollView>
      </AppScreen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenBody: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  messages: {
    gap: 12,
  },
  messageRow: {
    flexDirection: 'row',
    gap: 8,
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowBot: {
    justifyContent: 'flex-start',
  },
  avatarBot: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.successSoft,
  },
  avatarUser: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.lg,
  },
  bubbleUser: {
    backgroundColor: colors.primary,
  },
  bubbleBot: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  bubbleTextUser: {
    color: '#fff',
  },
  bubbleTextBot: {
    color: colors.foreground,
  },
  quickCard: {
    padding: 16,
    gap: 12,
  },
  quickTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: '800',
  },
  quickWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.background,
  },
  quickPillText: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: '600',
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    width: '100%',
  },
  inputWrap: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    minHeight: 34,
    maxHeight: 110,
    color: colors.foreground,
    fontSize: 14,
  },
  sendButton: {
    backgroundColor: colors.success,
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  micButton: {
    backgroundColor: colors.successSoft,
  },
  micButtonOn: {
    backgroundColor: colors.destructive,
  },
  heard: {
    color: colors.mutedForeground,
    fontSize: 13,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  sendButtonDisabled: {
    opacity: 0.65,
  },
  disclaimer: {
    color: colors.mutedForeground,
    fontSize: 11,
    marginTop: 8,
    textAlign: 'center',
  },
});
