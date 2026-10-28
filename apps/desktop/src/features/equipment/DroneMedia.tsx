import { Camera, Record, Stop, VideoCamera, X } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';
import { socket } from '../../realtime/socket';
import { Button } from '../../components/ui/button';
import { Panel, Row } from '../../components/ui/list';
import { pushToast } from '../../components/toast/toast';
import { TYPE_LABEL } from '../../components/map/MapView';
import { timeAgo } from '../../lib/format';
import { useNow } from '../../lib/useNow';

/**
 * Photos and videos from a drone's camera. The bridge captures them, the API keeps them
 * 30 days in Firebase Storage. Opening one asks the API for a link that works 10 minutes,
 * and that opening is written to the call log.
 */
export interface Media {
  _id: string;
  droneId: string;
  kind: 'photo' | 'video';
  status: 'recording' | 'uploading' | 'ready' | 'failed';
  emergency?: string;
  size?: number;
  sha256?: string;
  error?: string;
  createdAt: string;
  expiresAt: string;
}
interface ActiveEmergency { _id: string; type: string; createdAt: string }

export const useDroneMedia = () => {
  const [media, setMedia] = useState<Media[]>([]);
  useEffect(() => {
    api.get('/drones/media').then(r => setMedia(r.data)).catch(() => {});
    const onMedia = (m: Media) =>
      setMedia(prev => [m, ...prev.filter(x => x._id !== m._id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100));
    socket.on('drone:media', onMedia);
    return () => { socket.off('drone:media', onMedia); };
  }, []);
  return media;
};

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const Elapsed = ({ since }: { since: string }) => {
  const now = useNow();
  return <span className="tabular-nums">{clock(Math.max(0, Math.floor((now - Date.parse(since)) / 1000)))}</span>;
};

/** Sits on the live picture while it records. */
export const RecordingBadge = ({ recording }: { recording: Media }) => (
  <span className="absolute top-3 left-3 flex items-center gap-1.5 rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white">
    <span className="w-1.5 h-1.5 rounded-full bg-white motion-safe:animate-pulse" aria-hidden />
    Recording <Elapsed since={recording.createdAt} />
  </span>
);

/** Under the live picture: take a photo, record, and which call the footage belongs to. */
export const CaptureBar = ({ droneId, ready, recording, emergencies, initialCall = '' }: { droneId: string; ready: boolean; recording?: Media; emergencies: ActiveEmergency[]; initialCall?: string }) => {
  const [callId, setCallId] = useState(initialCall);
  const [busy, setBusy] = useState(false);

  const send = async (request: () => Promise<unknown>, failed: string) => {
    setBusy(true);
    try {
      await request();
    } catch (err: any) {
      pushToast({ tone: 'error', title: failed, body: err?.response?.data?.error ?? 'Try again' });
    } finally {
      setBusy(false);
    }
  };
  const capture = (kind: 'photo' | 'video') =>
    send(() => api.post('/drones/media', { droneId, kind, ...(callId ? { emergencyId: callId } : {}) }), kind === 'photo' ? 'Photo failed' : 'Recording failed');

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border">
      <Button size="sm" variant="outline" disabled={!ready || busy} onClick={() => capture('photo')}>
        <Camera size={16} /> Take photo
      </Button>
      {recording ? (
        <Button size="sm" variant="destructive" disabled={busy} onClick={() => send(() => api.post(`/drones/media/${recording._id}/stop`), 'Could not stop')}>
          <Stop size={16} weight="fill" /> Stop recording
        </Button>
      ) : (
        <Button size="sm" variant="outline" disabled={!ready || busy} onClick={() => capture('video')}>
          <Record size={16} weight="fill" className="text-red-600" /> Record
        </Button>
      )}
      <select
        aria-label="Call the footage belongs to"
        value={callId}
        onChange={e => setCallId(e.target.value)}
        className="ml-auto h-8 max-w-[230px] rounded-md border border-border bg-card px-2 text-sm"
      >
        <option value="">Not linked to a call</option>
        {emergencies.map(e => <option key={e._id} value={e._id}>For {TYPE_LABEL[e.type] ?? 'emergency'} · {timeAgo(e.createdAt)}</option>)}
      </select>
    </div>
  );
};

const size = (b?: number) => (b == null ? '' : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
const STATUS: Record<Media['status'], string> = { recording: 'Recording…', uploading: 'Saving…', ready: '', failed: 'Not saved' };

const PREVIEW = 8;

export const MediaPanel = ({ media }: { media: Media[] }) => {
  const [open, setOpen] = useState<{ item: Media; url: string } | null>(null);
  const [all, setAll] = useState(false);
  const now = Date.now(); // days left: no need for a ticking clock

  const view = async (item: Media) => {
    try {
      const { data } = await api.get(`/drones/media/${item._id}/link`);
      // The disk store (development) hands out links relative to the API.
      setOpen({ item, url: new URL(data.url, api.defaults.baseURL).href });
    } catch (err: any) {
      pushToast({ tone: 'error', title: 'Could not open', body: err?.response?.data?.error ?? 'Try again' });
    }
  };

  return (
    <>
      <Panel
        title="Photos and videos"
        aside={
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-muted-foreground">Kept 30 days, then deleted</span>
            {media.length > PREVIEW && <Button size="sm" variant="ghost" onClick={() => setAll(v => !v)}>{all ? 'Show fewer' : `Show all ${media.length}`}</Button>}
          </div>
        }
      >
        {media.length === 0 && <p className="px-5 py-10 text-center text-muted-foreground">No photos or videos yet. Take them from a drone&apos;s camera above.</p>}
        {(all ? media : media.slice(0, PREVIEW)).map(m => {
          const daysLeft = Math.max(0, Math.ceil((Date.parse(m.expiresAt) - now) / 86_400_000));
          return (
            <Row
              key={m._id}
              icon={m.kind === 'photo' ? Camera : VideoCamera}
              tone={m.status === 'failed' ? 'sos' : m.status === 'ready' ? 'teal' : 'mint'}
              title={`${m.kind === 'photo' ? 'Photo' : 'Video'} from ${m.droneId}${m.emergency ? ' · for an SOS call' : ''}`}
              summary={m.status === 'ready'
                ? `${size(m.size)} · deleted in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`
                : `${STATUS[m.status]}${m.error ? `: ${m.error}` : ''}`}
              onClick={m.status === 'ready' ? () => view(m) : undefined}
              right={<span className="num text-[13px] text-muted-foreground w-20 text-right">{timeAgo(m.createdAt)}</span>}
            />
          );
        })}
      </Panel>
      {open && <Viewer item={open.item} url={open.url} onClose={() => setOpen(null)} />}
    </>
  );
};

// Native <dialog>: focus trap, Escape to close and the backdrop come with it.
const Viewer = ({ item, url, onClose }: { item: Media; url: string; onClose: () => void }) => {
  const ref = useRef<HTMLDialogElement>(null);
  const [broken, setBroken] = useState(false);
  useEffect(() => { ref.current?.showModal(); }, []);
  const title = `${item.kind === 'photo' ? 'Photo' : 'Video'} from ${item.droneId}`;
  return (
    <dialog ref={ref} onClose={onClose} aria-label={title} className="m-auto w-[min(960px,92vw)] rounded-2xl border border-border bg-card p-0 text-foreground backdrop:bg-black/60">
      <div className="flex items-center justify-between gap-3 px-5 h-14 border-b border-border">
        <h2 className="text-[16px] font-extrabold">{title}</h2>
        <Button size="icon-sm" variant="ghost" aria-label="Close" onClick={() => ref.current?.close()}><X size={18} /></Button>
      </div>
      <div className="aspect-video bg-[hsl(193_47%_10%)] grid place-items-center">
        {broken ? (
          <p className="text-sm text-white/75 px-6 text-center">This file couldn&apos;t be loaded. The link may have expired: close this and open it again.</p>
        ) : item.kind === 'photo'
          ? <img src={url} alt={title} onError={() => setBroken(true)} className="max-w-full max-h-full object-contain" />
          : <video src={url} controls autoPlay onError={() => setBroken(true)} className="w-full h-full" />}
      </div>
      <p className="px-5 py-3 text-[13px] text-muted-foreground">
        {new Date(item.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        {item.sha256 && <> · fingerprint <span className="font-mono">{item.sha256.slice(0, 12)}</span></>}
        {' · '}Opening this is recorded in the call log.
      </p>
    </dialog>
  );
};
