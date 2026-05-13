import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  UserCircle, Heart, Droplets, FileText, Pill, AlertTriangle, Syringe, Calendar,
  ChevronRight, LogOut, Shield, QrCode, Plus,
} from 'lucide-react';
import { api } from '../../api/client';
import { RootState, logout } from '../../store';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Medication { id: string; name: string; dosage?: string; isActive: boolean; }
interface Allergy { id: string; allergen: string; severity: 'mild' | 'moderate' | 'severe'; }
interface Vaccination { id: string; name: string; date?: string; provider?: string; }
interface Appointment { id: string; appointmentType: string; scheduledAt: string; status: string; }

export const Profile = () => {
  const user = useSelector((s: RootState) => s.auth.user);
  const dispatch = useDispatch();
  const nav = useNavigate();

  const [showDonorCard, setShowDonorCard] = useState(false);
  const [meds, setMeds] = useState<Medication[]>([]);
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const [showAddMed, setShowAddMed] = useState(false);
  const [medName, setMedName] = useState('');
  const [medDosage, setMedDosage] = useState('');

  const [showAddAllergy, setShowAddAllergy] = useState(false);
  const [allergenName, setAllergenName] = useState('');
  const [allergenSeverity, setAllergenSeverity] = useState<Allergy['severity']>('mild');

  useEffect(() => {
    api.get('/health/medications').then(r => setMeds(r.data)).catch(() => {});
    api.get('/health/allergies').then(r => setAllergies(r.data)).catch(() => {});
    api.get('/health/vaccinations').then(r => setVaccinations(r.data)).catch(() => {});
    api.get('/health/appointments').then(r => setAppointments(r.data)).catch(() => {});
  }, []);

  const addMed = async () => {
    if (!medName.trim()) return;
    try {
      await api.post('/health/medications', { name: medName, dosage: medDosage });
      const r = await api.get('/health/medications');
      setMeds(r.data);
      setMedName(''); setMedDosage(''); setShowAddMed(false);
      toast.success('Medication added');
    } catch { toast.error('Failed to add'); }
  };

  const addAllergy = async () => {
    if (!allergenName.trim()) return;
    try {
      await api.post('/health/allergies', { allergen: allergenName, severity: allergenSeverity });
      const r = await api.get('/health/allergies');
      setAllergies(r.data);
      setAllergenName(''); setShowAddAllergy(false);
      toast.success('Allergy added');
    } catch { toast.error('Failed to add'); }
  };

  const signOut = () => { dispatch(logout()); nav('/login'); };

  const menuItems = [
    { icon: FileText, label: 'Lab results', count: 0, tint: 'bg-blue-50 text-blue-600' },
    { icon: Pill, label: 'Medications', count: meds.length, tint: 'bg-orange-50 text-orange-600' },
    { icon: AlertTriangle, label: 'Allergies', count: allergies.length, tint: 'bg-destructive/10 text-destructive' },
    { icon: Syringe, label: 'Vaccinations', count: vaccinations.length, tint: 'bg-emerald-50 text-emerald-600' },
    { icon: Calendar, label: 'Appointments', count: appointments.length, tint: 'bg-purple-50 text-purple-600' },
  ];

  return (
    <div className="min-h-full bg-background">
      <header className="bg-gradient-to-br from-slate-800 to-slate-900 text-white px-5 pt-6 pb-10 rounded-b-[2rem]">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">My profile</h1>
          <button onClick={signOut} className="w-9 h-9 bg-white/10 rounded-xl grid place-items-center">
            <LogOut size={18} />
          </button>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/10 rounded-2xl grid place-items-center overflow-hidden">
            <UserCircle size={40} className="text-white/70" />
          </div>
          <div>
            <h2 className="text-lg font-bold">{user?.name ?? 'User'}</h2>
            <p className="text-white/60 text-sm">{user?.email ?? ''}</p>
            <div className="flex items-center gap-2 mt-1">
              {user?.bloodType && (
                <span className="text-xs bg-destructive text-white px-2 py-0.5 rounded-full font-bold">{user.bloodType}</span>
              )}
              {user?.role === 'blood_donor' && (
                <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Heart size={10} className="fill-white" /> Donor
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="px-4 -mt-6 pb-6 space-y-4">
        <button onClick={() => setShowDonorCard(v => !v)} className="block w-full text-left">
          <Card className="p-4 bg-gradient-to-br from-destructive/5 to-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-destructive rounded-2xl grid place-items-center text-white">
                  <QrCode size={22} />
                </div>
                <div>
                  <h3 className="font-bold">Donor card</h3>
                  <p className="text-xs text-muted-foreground">Scan in case of emergency</p>
                </div>
              </div>
              <ChevronRight size={20} className="text-muted-foreground" />
            </div>
          </Card>
        </button>

        {showDonorCard && (
          <Card className="p-6 bg-gradient-to-br from-destructive to-red-700 text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Heart size={20} className="fill-white" />
                <span className="font-bold text-lg">VITALIS</span>
              </div>
              <Shield size={20} className="text-white/70" />
            </div>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-white/20 rounded-2xl grid place-items-center backdrop-blur">
                <Droplets size={32} />
              </div>
              <div>
                <p className="text-white/80 text-xs">BLOOD TYPE</p>
                <p className="text-4xl font-bold">{user?.bloodType ?? '?'}</p>
              </div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 backdrop-blur mb-3">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-white/80">Name</span>
                <span className="font-semibold">{user?.name ?? '?'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/80">Donor ID</span>
                <span className="font-semibold">VTL-{(user?.id ?? user?._id ?? '0000').toString().slice(-6)}</span>
              </div>
            </div>
            <div className="flex items-center justify-center py-4 bg-white/10 rounded-xl">
              <QrCode size={80} className="text-white" />
            </div>
            <p className="text-center text-xs text-white/80 mt-2">Scan in case of emergency</p>
          </Card>
        )}

        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground mb-3">MY HEALTH</p>
          <div className="space-y-1">
            {menuItems.map(item => (
              <button key={item.label} className="w-full flex items-center gap-3 py-3 text-left active:scale-[0.99]">
                <div className={cn('w-10 h-10 rounded-xl grid place-items-center', item.tint)}>
                  <item.icon size={18} />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{item.label}</p>
                </div>
                {item.count > 0 && (
                  <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full font-medium">{item.count}</span>
                )}
                <ChevronRight size={18} className="text-muted-foreground" />
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Pill size={18} className="text-orange-500" />
              <h3 className="font-bold text-sm">Current medications</h3>
            </div>
            <button onClick={() => setShowAddMed(v => !v)} className="text-xs bg-orange-50 text-orange-600 px-3 py-1.5 rounded-full font-medium flex items-center gap-1">
              <Plus size={12} /> Add
            </button>
          </div>
          {showAddMed && (
            <div className="bg-muted/40 rounded-xl p-3 mb-3 space-y-2">
              <Input value={medName} onChange={e => setMedName(e.target.value)} placeholder="Medication name" />
              <Input value={medDosage} onChange={e => setMedDosage(e.target.value)} placeholder="Dose (e.g. 500mg, 2x/day)" />
              <Button onClick={addMed} className="w-full bg-orange-500 hover:bg-orange-600 text-white">Save</Button>
            </div>
          )}
          <div className="space-y-2">
            {meds.map(m => (
              <div key={m.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-medium">{m.name}</p>
                  {m.dosage && <p className="text-xs text-muted-foreground">{m.dosage}</p>}
                </div>
                <span className={cn('text-[10px] px-2 py-0.5 rounded-full', m.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground')}>
                  {m.isActive ? 'Active' : 'Ended'}
                </span>
              </div>
            ))}
            {!meds.length && <p className="text-sm text-muted-foreground text-center py-3">No medications recorded.</p>}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-destructive" />
              <h3 className="font-bold text-sm">Allergies</h3>
            </div>
            <button onClick={() => setShowAddAllergy(v => !v)} className="text-xs bg-destructive/10 text-destructive px-3 py-1.5 rounded-full font-medium flex items-center gap-1">
              <Plus size={12} /> Add
            </button>
          </div>
          {showAddAllergy && (
            <div className="bg-muted/40 rounded-xl p-3 mb-3 space-y-2">
              <Input value={allergenName} onChange={e => setAllergenName(e.target.value)} placeholder="What are you allergic to?" />
              <div className="flex gap-2">
                {(['mild', 'moderate', 'severe'] as const).map(sev => (
                  <button
                    key={sev}
                    onClick={() => setAllergenSeverity(sev)}
                    className={cn(
                      'flex-1 py-1.5 rounded-lg text-xs font-medium capitalize',
                      allergenSeverity === sev
                        ? sev === 'mild' ? 'bg-yellow-200 text-yellow-800'
                          : sev === 'moderate' ? 'bg-orange-200 text-orange-800'
                          : 'bg-destructive/20 text-destructive'
                        : 'bg-card text-muted-foreground'
                    )}
                  >
                    {sev}
                  </button>
                ))}
              </div>
              <Button onClick={addAllergy} className="w-full bg-destructive hover:bg-destructive/90 text-white">Save</Button>
            </div>
          )}
          <div className="space-y-2">
            {allergies.map(a => (
              <div key={a.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <p className="text-sm font-medium">{a.allergen}</p>
                <span className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full capitalize',
                  a.severity === 'severe' ? 'bg-destructive/15 text-destructive' :
                  a.severity === 'moderate' ? 'bg-orange-100 text-orange-700' :
                  'bg-yellow-100 text-yellow-700'
                )}>
                  {a.severity}
                </span>
              </div>
            ))}
            {!allergies.length && <p className="text-sm text-muted-foreground text-center py-3">No allergies recorded.</p>}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={18} className="text-purple-500" />
            <h3 className="font-bold text-sm">Upcoming appointments</h3>
          </div>
          <div className="space-y-2">
            {appointments.slice(0, 3).map(apt => (
              <div key={apt.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-medium capitalize">{apt.appointmentType}</p>
                  <p className="text-xs text-muted-foreground">{new Date(apt.scheduledAt).toLocaleDateString()}</p>
                </div>
                <span className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full capitalize',
                  apt.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                  apt.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                  'bg-muted text-muted-foreground'
                )}>
                  {apt.status}
                </span>
              </div>
            ))}
            {!appointments.length && <p className="text-sm text-muted-foreground text-center py-3">No upcoming appointments.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
};
