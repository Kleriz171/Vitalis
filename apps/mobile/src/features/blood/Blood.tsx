import { useEffect, useState } from 'react';
import { Droplets, MapPin, Clock, Heart, Activity, Info, AlertCircle } from 'lucide-react';
import { api } from '../../api/client';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { cn } from '@/lib/utils';

type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
type Urgency = 'critical' | 'urgent' | 'normal';

interface Request {
  id: string;
  bloodType: BloodType;
  urgency: Urgency;
  unitsNeeded: number;
  patientName: string;
  reason?: string;
  hospitalName?: string | null;
  createdAt: string;
}

interface Inventory {
  id: string;
  bloodType: BloodType;
  unitsAvailable: number;
  unitsNeeded: number;
  hospitalName?: string | null;
}

const BLOOD_TYPES: BloodType[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const COMPATIBILITY: Record<BloodType, { canReceive: BloodType[]; canDonate: BloodType[] }> = {
  'A+': { canReceive: ['A+', 'A-', 'O+', 'O-'], canDonate: ['A+', 'AB+'] },
  'A-': { canReceive: ['A-', 'O-'], canDonate: ['A+', 'A-', 'AB+', 'AB-'] },
  'B+': { canReceive: ['B+', 'B-', 'O+', 'O-'], canDonate: ['B+', 'AB+'] },
  'B-': { canReceive: ['B-', 'O-'], canDonate: ['B+', 'B-', 'AB+', 'AB-'] },
  'AB+': { canReceive: BLOOD_TYPES, canDonate: ['AB+'] },
  'AB-': { canReceive: ['A-', 'B-', 'AB-', 'O-'], canDonate: ['AB+', 'AB-'] },
  'O+': { canReceive: ['O+', 'O-'], canDonate: ['A+', 'B+', 'AB+', 'O+'] },
  'O-': { canReceive: ['O-'], canDonate: BLOOD_TYPES },
};

const urgencyStyle = (u: Urgency) =>
  u === 'critical' ? 'bg-destructive/10 text-destructive border-destructive/30' :
  u === 'urgent' ? 'bg-orange-50 text-orange-700 border-orange-200' :
  'bg-blue-50 text-blue-700 border-blue-200';

const stockColor = (avail: number, needed: number) =>
  avail < needed ? 'bg-destructive' : avail < 10 ? 'bg-orange-500' : 'bg-emerald-500';

export const Blood = () => {
  const [tab, setTab] = useState<'requests' | 'inventory' | 'compat'>('requests');
  const [selectedType, setSelectedType] = useState<BloodType>('A+');
  const [requests, setRequests] = useState<Request[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [loadingInventory, setLoadingInventory] = useState(true);

  useEffect(() => {
    api.get('/blood/requests').then(r => setRequests(r.data ?? [])).catch(() => {}).finally(() => setLoadingRequests(false));
    api.get('/blood/inventory').then(r => setInventory(r.data ?? [])).catch(() => {}).finally(() => setLoadingInventory(false));
  }, []);

  return (
    <div className="min-h-full bg-background">
      <header className="bg-gradient-to-br from-destructive to-red-700 text-white px-5 pt-6 pb-8">
        <h1 className="text-2xl font-bold">Blood & emergency</h1>
        <p className="text-white/80 text-sm mt-1">Donate blood, save lives.</p>
      </header>

      <div className="px-4 -mt-4 pb-8 space-y-4">
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground mb-3">YOUR BLOOD TYPE</p>
          <div className="grid grid-cols-4 gap-2">
            {BLOOD_TYPES.map(t => (
              <button
                key={t}
                onClick={() => setSelectedType(t)}
                className={cn(
                  'py-2.5 rounded-xl text-sm font-bold transition-all',
                  selectedType === t
                    ? 'bg-destructive text-white shadow-md'
                    : 'bg-muted text-foreground hover:bg-muted/70'
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Info size={14} /> Compatibility for {selectedType}
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-red-50 to-card">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-destructive rounded-2xl grid place-items-center">
              <Heart size={28} className="text-white" fill="currentColor" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold">Donor card</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Type: <span className="font-bold text-destructive">{selectedType}</span>
              </p>
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                <Activity size={12} /> Can donate to: {COMPATIBILITY[selectedType].canDonate.join(', ')}
              </div>
            </div>
          </div>
          <Button variant="destructive" className="w-full mt-3">Register as donor</Button>
        </Card>

        <div className="flex bg-muted rounded-2xl p-1 text-sm">
          {([
            ['requests', 'Requests'],
            ['inventory', 'Stock'],
            ['compat', 'Compatibility'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex-1 py-2.5 font-medium rounded-xl transition',
                tab === id ? 'bg-destructive text-white shadow-sm' : 'text-muted-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'requests' && (
          <div className="space-y-3">
            {requests.map(req => (
              <Card key={req.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn('w-10 h-10 grid place-items-center rounded-full text-xs font-bold text-white', stockColor(0, 1))}>{req.bloodType}</span>
                    <Badge variant="outline" className={cn('text-[10px] font-bold', urgencyStyle(req.urgency))}>
                      {req.urgency.toUpperCase()}
                    </Badge>
                  </div>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock size={10} /> Today
                  </span>
                </div>
                <h3 className="font-semibold text-sm mt-2">{req.patientName}</h3>
                {req.reason && <p className="text-xs text-muted-foreground mt-1">{req.reason}</p>}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin size={14} /> {req.hospitalName ?? '—'}
                  </div>
                  <span className="text-xs font-bold text-destructive">{req.unitsNeeded} units</span>
                </div>
              </Card>
            ))}
            {loadingRequests && (
              <>
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Skeleton className="w-10 h-10 rounded-full" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-full" />
                  </Card>
                ))}
              </>
            )}
            {!loadingRequests && !requests.length && (
              <div className="text-center py-10 text-muted-foreground">
                <Droplets size={48} className="mx-auto mb-3 opacity-40" />
                <p>No active requests.</p>
                <p className="text-xs mt-1">Stock levels are healthy.</p>
              </div>
            )}
          </div>
        )}

        {tab === 'inventory' && (
          <div className="space-y-3">
            {Object.values(
              inventory.reduce<Record<string, { hospitalName?: string | null; items: Inventory[] }>>((acc, it) => {
                const key = it.hospitalName ?? 'Unknown';
                if (!acc[key]) acc[key] = { hospitalName: it.hospitalName, items: [] };
                acc[key].items.push(it);
                return acc;
              }, {})
            ).map(group => (
              <Card key={group.hospitalName ?? 'u'} className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin size={16} className="text-destructive" />
                  <h3 className="font-semibold text-sm">{group.hospitalName ?? 'Unknown'}</h3>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {group.items.map(item => (
                    <div key={item.id} className="text-center">
                      <div className={cn('w-11 h-11 grid place-items-center rounded-full text-xs font-bold text-white mx-auto mb-1', stockColor(item.unitsAvailable, item.unitsNeeded))}>
                        {item.bloodType}
                      </div>
                      <p className="text-[10px] text-muted-foreground">{item.unitsAvailable} u</p>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
            {loadingInventory && (
              <>
                {Array.from({ length: 2 }).map((_, i) => (
                  <Card key={i} className="p-4 space-y-3">
                    <Skeleton className="h-4 w-40" />
                    <div className="grid grid-cols-4 gap-2">
                      {Array.from({ length: 8 }).map((__, j) => (
                        <Skeleton key={j} className="w-11 h-11 rounded-full mx-auto" />
                      ))}
                    </div>
                  </Card>
                ))}
              </>
            )}
            {!loadingInventory && !inventory.length && (
              <div className="text-center py-10 text-muted-foreground">
                <Activity size={48} className="mx-auto mb-3 opacity-40" />
                <p>No inventory data yet.</p>
              </div>
            )}
          </div>
        )}

        {tab === 'compat' && (
          <>
            <Card className="p-4">
              <h3 className="font-bold mb-3">Compatibility for {selectedType}</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-2">CAN RECEIVE FROM</p>
                  <div className="flex flex-wrap gap-2">
                    {COMPATIBILITY[selectedType].canReceive.map(t => (
                      <Badge key={t} variant="outline" className="text-sm font-bold bg-destructive/10 text-destructive border-destructive/30">{t}</Badge>
                    ))}
                  </div>
                </div>
                <div className="border-t border-border pt-3">
                  <p className="text-xs text-muted-foreground mb-2">CAN DONATE TO</p>
                  <div className="flex flex-wrap gap-2">
                    {COMPATIBILITY[selectedType].canDonate.map(t => (
                      <Badge key={t} variant="outline" className="text-sm font-bold bg-emerald-50 text-emerald-700 border-emerald-200">{t}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-sm">Universal donor/recipient</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Type <strong>O-</strong> is the universal donor — can give to any group.
                    Type <strong>AB+</strong> is the universal recipient — can receive from any group.
                  </p>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};
