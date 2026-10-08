import { toast as sonner } from 'sonner';

export type ToastTone = 'info' | 'success' | 'warn' | 'error';

interface ToastInput {
  tone?: ToastTone;
  title: string;
  body?: string;
  ttl?: number;
}

/**
 * Lightweight adapter — keeps the existing pushToast call sites working
 * while routing notifications through sonner (mounted in App.tsx).
 */
export const pushToast = ({ tone = 'info', title, body, ttl }: ToastInput) => {
  const opts = { description: body, duration: ttl };
  switch (tone) {
    case 'success': sonner.success(title, opts); return;
    case 'error':   sonner.error(title, opts);   return;
    case 'warn':    sonner.warning(title, opts); return;
    default:        sonner(title, opts);
  }
};
