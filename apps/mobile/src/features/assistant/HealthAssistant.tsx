import { useEffect, useRef, useState } from 'react';
import { Sparkles, Send, User, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestions?: string[];
}

const quickQuestions = [
  'I have a headache and a fever',
  'Where can I do thyroid tests?',
  'What should I eat for high blood sugar?',
  'How urgent is anemia?',
];

const responses: Record<string, { content: string; suggestions: string[] }> = {
  default: {
    content: `I'm your VITALIS health assistant. I'm not a doctor, but I can help you with:

• **Where to go** based on symptoms
• **Which specialist** is most appropriate
• **What tests** are common for your symptoms
• **How urgent** something looks
• **Which hospitals** handle each condition

⚠️ **For emergencies, call 112 or go to the nearest hospital.**

What symptoms do you have?`,
    suggestions: ['Headache', 'Fever', 'Stomach pain', 'Heart issues'],
  },
  headache: {
    content: `**Headaches** have many causes. Here's what to know:

**Urgency**: 🟡 Moderate if recurrent

**Where to go**:
• Neurologist — chronic headaches
• GP — initial check
• ER if accompanied by loss of consciousness, paralysis, or slurred speech

**Common tests**: MRI or CT, blood count, blood pressure, glucose`,
    suggestions: ['Fever', 'Dizziness', 'Eye pain'],
  },
  fever: {
    content: `**Fever** is a natural defense.

**Urgency**: 🟢 Low (< 39°C), 🟡 Moderate (39–40°C), 🔴 High (> 40°C)

**What to do**: rest, drink fluids, take paracetamol > 38°C, cool the body with damp cloths.

**See a doctor if**: > 39°C for > 3 days, child < 3 months with > 38°C, accompanied by stiff neck/rash/vomiting.`,
    suggestions: ['Cough', 'Sore throat', 'Vomiting'],
  },
  anemia: {
    content: `**Anemia** is low red blood cells or hemoglobin.

**Urgency**: 🟡 Moderate (mild), 🔴 High (severe, Hb < 7)

**Where**: hematologist, GP for initial check.

**Tests**: full blood count, ferritin, B12, folic acid, peripheral smear.

**Symptoms**: fatigue, pallor, dizziness, palpitations.`,
    suggestions: ['Fatigue', 'Dizziness', 'Palpitations'],
  },
  thyroid: {
    content: `**Thyroid tests** are routine endocrinology lab work.

**Tests**: TSH, T3, T4, anti-TPO, thyroid ultrasound.

**Turnaround**: 24–48h.

Ask your GP for a referral.`,
    suggestions: ['Fatigue', 'Weight gain', 'Hand tremor'],
  },
  sugar: {
    content: `**Diet for high blood sugar** is essential for diabetes management.

**Eat**: leafy greens, whole grains, fatty fish, nuts/seeds (unsalted), legumes, low-GI fruits.

**Avoid**: refined sugar, sugary drinks, white bread, sweets, processed foods.

**Habits**: 5 small meals/day, 8 glasses of water, 30 min walking, regular glucose checks.`,
    suggestions: ['Diabetes', 'Diet', 'Exercise'],
  },
};

function lookup(input: string): { content: string; suggestions: string[] } {
  const q = input.toLowerCase();
  for (const [key, r] of Object.entries(responses)) {
    if (key !== 'default' && q.includes(key)) return r;
  }
  return responses.default;
}

export const HealthAssistant = () => {
  const [messages, setMessages] = useState<Message[]>([
    { id: 'welcome', role: 'assistant', content: responses.default.content, suggestions: responses.default.suggestions },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(m => [...m, userMsg]);
    setInput('');
    setLoading(true);
    setTimeout(() => {
      const r = lookup(text);
      setMessages(m => [...m, { id: (Date.now() + 1).toString(), role: 'assistant', content: r.content, suggestions: r.suggestions }]);
      setLoading(false);
    }, 600);
  };

  return (
    <div className="min-h-full bg-background flex flex-col">
      <header className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white px-5 pt-6 pb-6 rounded-2xl mx-4 mt-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-2xl grid place-items-center backdrop-blur">
            <Sparkles size={24} aria-hidden />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Health assistant</h1>
            <p className="text-white/80 text-xs">AI · not a doctor, but a helper</p>
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn('max-w-[85%]', msg.role === 'user' && 'order-2')}>
              <div className={cn('flex items-start gap-2', msg.role === 'user' && 'flex-row-reverse')}>
                <div className={cn('w-8 h-8 rounded-full grid place-items-center flex-shrink-0',
                  msg.role === 'user' ? 'bg-blue-500' : 'bg-emerald-500'
                )}>
                  {msg.role === 'user' ? <User size={14} className="text-white" /> : <Sparkles size={14} className="text-white" />}
                </div>
                <div className={cn(
                  'rounded-2xl p-3.5 text-sm leading-relaxed whitespace-pre-line',
                  msg.role === 'user' ? 'bg-blue-500 text-white rounded-tr-md' : 'bg-card shadow-sm rounded-tl-md border border-border'
                )}>
                  {msg.content.split('**').map((part, i) =>
                    i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                  )}
                </div>
              </div>
              {msg.suggestions && msg.role === 'assistant' && (
                <div className="flex flex-wrap gap-2 mt-2 ml-10">
                  {msg.suggestions.map(s => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full border border-emerald-100 hover:bg-emerald-100 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-500 grid place-items-center">
                <Loader2 size={14} className="text-white animate-spin" />
              </div>
              <div className="bg-card rounded-2xl rounded-tl-md px-4 py-3 border border-border">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {messages.length === 1 && (
        <div className="px-4 pb-2">
          <p className="text-xs text-muted-foreground mb-2">Common questions:</p>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
            {quickQuestions.map(q => (
              <button
                key={q}
                onClick={() => send(q)}
                className="flex-shrink-0 bg-card border border-border text-muted-foreground px-3 py-2 rounded-xl text-xs"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 pb-4 pt-2 bg-card border-t border-border">
        <div className="flex items-center gap-2">
          <Input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send(input)}
            placeholder="Describe your symptoms…"
            className="flex-1 bg-muted border-0"
          />
          <Button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            size="icon"
            className="bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            <Send size={18} />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          ⚠️ This assistant does not replace a doctor. For emergencies, call 112.
        </p>
      </div>
    </div>
  );
};
