export const formatEta = (sec?: number | null) => {
  if (sec == null) return '—';
  if (sec < 60) return `${Math.max(1, Math.round(sec))}s`;
  if (sec < 3600) return `${Math.round(sec / 60)} min`;
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return `${h}h ${m}m`;
};

export const timeAgo = (iso: string) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  // Same day-month style as the rest of the console, whatever the computer's locale.
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: diff > 300 * 86400 ? 'numeric' : undefined });
};

export const shortId = (id: string) => id?.slice(-6).toUpperCase();
