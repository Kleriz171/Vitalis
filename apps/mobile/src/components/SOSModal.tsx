import { useEffect, useState } from 'react';
import { Phone, MapPin, Heart, Shield, Flame, AlertTriangle, Navigation, X } from 'lucide-react';
import { api } from '../api/client';
import { cn } from '@/lib/utils';

interface EmergencyNumber {
  id: string;
  name: string;
  number: string;
  category: 'ambulance' | 'police' | 'fire' | 'poison' | 'hospital' | 'other';
}

interface EmergencyHospital {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  isOpen24h?: boolean;
}

const FALLBACK_NUMBERS: EmergencyNumber[] = [
  { id: 'ambulance', name: 'Ambulance', number: '112', category: 'ambulance' },
  { id: 'police', name: 'Police', number: '129', category: 'police' },
  { id: 'fire', name: 'Fire brigade', number: '128', category: 'fire' },
  { id: 'poison', name: 'Poison control', number: '127', category: 'poison' },
];

const categoryStyles: Record<EmergencyNumber['category'], { icon: typeof Phone; tint: string }> = {
  ambulance: { icon: Heart, tint: 'bg-destructive/10 text-destructive' },
  police: { icon: Shield, tint: 'bg-blue-50 text-blue-600' },
  fire: { icon: Flame, tint: 'bg-orange-50 text-orange-600' },
  poison: { icon: AlertTriangle, tint: 'bg-purple-50 text-purple-600' },
  hospital: { icon: Phone, tint: 'bg-emerald-50 text-emerald-600' },
  other: { icon: Phone, tint: 'bg-muted text-muted-foreground' },
};

interface SOSModalProps {
  open: boolean;
  onClose: () => void;
}

export const SOSModal = ({ open, onClose }: SOSModalProps) => {
  const [tab, setTab] = useState<'numbers' | 'hospitals'>('numbers');
  const [numbers, setNumbers] = useState<EmergencyNumber[]>(FALLBACK_NUMBERS);
  const [hospitals, setHospitals] = useState<EmergencyHospital[]>([]);
  const [loadingHospitals, setLoadingHospitals] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    api.get('/emergencies/numbers').then(r => { if (!cancelled && Array.isArray(r.data)) setNumbers(r.data); }).catch(() => {});
    setLoadingHospitals(true);
    api.get('/emergencies/hospitals').then(r => { if (!cancelled && Array.isArray(r.data)) setHospitals(r.data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingHospitals(false); });
    return () => { cancelled = true; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in"
        onClick={onClose}
      />
      <div className="relative w-full max-w-[430px] bg-card rounded-t-3xl max-h-[85vh] overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300">
        <header className="bg-destructive text-destructive-foreground px-5 pt-6 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur">
                <Heart size={24} fill="currentColor" />
              </div>
              <div>
                <h2 className="text-xl font-bold leading-tight">SOS Emergency</h2>
                <p className="text-white/80 text-sm">24/7 immediate help</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center backdrop-blur"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="flex border-b border-border">
          {(['numbers', 'hospitals'] as const).map(id => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex-1 py-3 text-sm font-medium transition-colors',
                tab === id
                  ? 'text-destructive border-b-2 border-destructive'
                  : 'text-muted-foreground'
              )}
            >
              {id === 'numbers' ? 'Emergency numbers' : 'Nearby hospitals'}
            </button>
          ))}
        </div>

        <div className="p-4 overflow-y-auto max-h-[55vh] space-y-3">
          {tab === 'numbers' && numbers.map(num => {
            const style = categoryStyles[num.category] ?? categoryStyles.other;
            const Icon = style.icon;
            return (
              <a
                key={num.id}
                href={`tel:${num.number}`}
                className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:bg-muted/50 transition-colors active:scale-[0.98]"
              >
                <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center', style.tint)}>
                  <Icon size={22} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">{num.name}</h3>
                  <p className="text-lg font-bold text-destructive">{num.number}</p>
                </div>
                <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white">
                  <Phone size={18} />
                </div>
              </a>
            );
          })}

          {tab === 'hospitals' && hospitals.map(h => (
            <div key={h.id} className="p-4 rounded-2xl border border-border bg-card">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-destructive/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <MapPin className="text-destructive" size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{h.name}</h3>
                  {h.address && <p className="text-sm text-muted-foreground mt-1">{h.address}</p>}
                  <div className="flex items-center gap-3 mt-2">
                    {h.phone && (
                      <a href={`tel:${h.phone}`} className="text-destructive text-sm font-medium flex items-center gap-1">
                        <Phone size={14} /> {h.phone}
                      </a>
                    )}
                    {h.isOpen24h && (
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                        24h
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button className="w-full mt-3 py-2.5 bg-destructive/10 text-destructive rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                <Navigation size={16} /> Navigate here
              </button>
            </div>
          ))}

          {tab === 'hospitals' && !hospitals.length && (
            <div className="text-center py-10 text-muted-foreground">
              <MapPin size={40} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">{loadingHospitals ? 'Loading nearby hospitals…' : 'No hospitals found nearby.'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
