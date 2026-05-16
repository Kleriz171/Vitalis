import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Bot, Send, Sparkles, User } from 'lucide-react-native';
import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { colors, radius } from '@/lib/theme';

interface Message {
  id: string;
  role: 'user' | 'bot';
  content: string;
}

const QUICK = [
  'How does the SOS button work?',
  'CPR basics',
  'How do I update my Bio Passport?',
  'When should I see a doctor?',
];

export default function Assistant() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'bot',
      content: 'Hi — I can help with general wellness questions. For emergencies, use the SOS controls on your home screen.',
    },
  ]);

  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(timer);
  }, [messages.length]);

  const send = async (raw?: string) => {
    const content = (raw ?? input).trim();
    if (!content) return;

    setMessages((current) => [...current, { id: `u-${Date.now()}`, role: 'user', content }]);
    setInput('');

    try {
      const { data } = await api.post<{ reply: string }>('/ai/chat', { message: content });
      setMessages((current) => [...current, { id: `b-${Date.now()}`, role: 'bot', content: data.reply }]);
    } catch (e: any) {
      setMessages((current) => [...current, {
        id: `b-${Date.now()}`,
        role: 'bot',
        content: e.response?.data?.error ?? 'I could not reach the assistant. Please try again.',
      }]);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppScreen
        tone="success"
        eyebrow="Wellness guidance"
        title="Health assistant"
        subtitle="A calmer space for quick health questions and everyday guidance."
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
            <View style={styles.composerRow}>
              <View style={styles.inputWrap}>
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  placeholder="Ask a health question…"
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
            <Text style={styles.disclaimer}>Not a substitute for a real doctor or emergency service.</Text>
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
              <Text style={styles.quickTitle}>Try a quick question</Text>
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
