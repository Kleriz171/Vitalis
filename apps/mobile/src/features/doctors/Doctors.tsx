import { useEffect, useMemo, useState } from 'react';
import { Stethoscope, Search, Star, Video, Clock, Filter } from 'lucide-react';
import { api } from '../../api/client';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { cn } from '@/lib/utils';

const SPECIALTIES = [
  'All', 'Cardiology', 'Neurology', 'Orthopedics', 'Pediatrics',
  'Dermatology', 'Endocrinology', 'Gastroenterology', 'Allergy',
  'Ophthalmology', 'Psychology', 'Oncology', 'Obstetrics',
];

interface Doctor {
  id: string;
  name: string;
  specialty: string;
  imageUrl?: string;
  biography?: string;
  experience?: number;
  rating?: number;
  reviewCount?: number;
  priceConsultation?: number;
  availableOnline?: boolean;
}

export const Doctors = () => {
  const [search, setSearch] = useState('');
  const [specialty, setSpecialty] = useState('All');
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (specialty !== 'All') params.set('specialty', specialty);
    if (onlineOnly) params.set('availableOnline', 'true');
    if (search) params.set('search', search);
    api.get(`/doctors${params.toString() ? '?' + params : ''}`)
      .then(r => setDoctors(r.data))
      .catch(() => setDoctors([]))
      .finally(() => setLoading(false));
  }, [specialty, onlineOnly, search]);

  const filtered = useMemo(() => doctors, [doctors]);

  return (
    <div className="min-h-full bg-background">
      <header className="hero-header bg-gradient-to-br from-blue-500 to-blue-600">
        <h1 className="text-2xl font-bold tracking-tight">Doctors & hospitals</h1>
        <p className="text-white/80 text-sm mt-1">Find your specialist</p>
      </header>

      <div className="px-4 mt-4 pb-6 space-y-4">
        <Card className="p-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center gap-2 bg-muted rounded-xl px-3 py-2.5">
              <Search size={18} className="text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search doctor or specialty…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 bg-transparent border-0 shadow-none focus-visible:ring-0 px-0 h-auto"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'w-10 h-10 rounded-xl grid place-items-center transition-colors',
                showFilters ? 'bg-blue-500 text-white' : 'bg-muted text-muted-foreground'
              )}
            >
              <Filter size={18} />
            </button>
          </div>
          {showFilters && (
            <div className="mt-3 pt-3 border-t border-border space-y-3">
              <button
                onClick={() => setOnlineOnly(!onlineOnly)}
                className={cn(
                  'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                  onlineOnly ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'
                )}
              >
                <Video size={12} /> Online only
              </button>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
                {SPECIALTIES.map(s => (
                  <button
                    key={s}
                    onClick={() => setSpecialty(s)}
                    className={cn(
                      'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                      specialty === s ? 'bg-blue-500 text-white' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>

        {loading && (
          <>
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="p-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="w-16 h-16 rounded-2xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-full" />
                    <div className="flex gap-2 mt-2">
                      <Skeleton className="h-8 flex-1" />
                      <Skeleton className="h-8 flex-1" />
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </>
        )}

        {!loading && filtered.map(d => (
          <Card key={d.id} className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 flex-shrink-0 grid place-items-center overflow-hidden">
                {d.imageUrl
                  ? <img src={d.imageUrl} alt={d.name} className="w-full h-full object-cover" />
                  : <Stethoscope size={26} className="text-blue-500" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{d.name}</h3>
                    <p className="text-sm text-blue-600">{d.specialty}</p>
                  </div>
                  {d.availableOnline && (
                    <span className="flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex-shrink-0">
                      <Video size={10} /> Online
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center gap-1">
                    <Star size={14} className="text-yellow-400 fill-yellow-400" />
                    <span className="text-sm font-medium">{d.rating?.toFixed(1) ?? '—'}</span>
                    {d.reviewCount != null && <span className="text-xs text-muted-foreground">({d.reviewCount})</span>}
                  </div>
                  {d.experience ? <span className="text-xs text-muted-foreground">{d.experience}y exp.</span> : null}
                </div>
                {d.biography && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{d.biography}</p>
                )}
                <div className="flex items-center gap-2 mt-3">
                  <Button size="sm" className="flex-1 bg-blue-500 hover:bg-blue-600 text-white">
                    <Clock size={14} /> Book
                  </Button>
                  {d.availableOnline && (
                    <Button size="sm" variant="outline" className="flex-1 border-emerald-200 text-emerald-600 hover:bg-emerald-50">
                      <Video size={14} /> Online consult
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}

        {!loading && !filtered.length && (
          <Card className="p-10 text-center text-muted-foreground">
            <Search size={48} className="mx-auto mb-3 opacity-40" />
            <p>No doctors found</p>
            <p className="text-xs mt-1">Try different filters.</p>
          </Card>
        )}
      </div>
    </div>
  );
};
