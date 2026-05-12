import { useSyncExternalStore } from 'react';

export type ToastTone = 'info' | 'success' | 'warn' | 'error';
export interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  body?: string;
  ttl: number;
}

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

export const pushToast = (t: Omit<Toast, 'id' | 'ttl'> & { ttl?: number }) => {
  const toast: Toast = { id: nextId++, ttl: t.ttl ?? 4500, ...t };
  toasts = [toast, ...toasts].slice(0, 6);
  emit();
  setTimeout(() => dismissToast(toast.id), toast.ttl);
};

export const dismissToast = (id: number) => {
  toasts = toasts.filter(t => t.id !== id);
  emit();
};

export const useToasts = () =>
  useSyncExternalStore(
    cb => { listeners.add(cb); return () => listeners.delete(cb); },
    () => toasts,
    () => toasts
  );
