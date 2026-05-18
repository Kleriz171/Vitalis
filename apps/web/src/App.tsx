import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from './store';
import { Landing } from './features/landing/Landing';
import { Login } from './features/auth/Login';
import { CommandShell } from './components/layout/CommandShell';
import { Logistics } from './features/command/pages/Logistics';
import { Drones } from './features/command/pages/Drones';
import { Ledger } from './features/command/pages/Ledger';
import { Analytics } from './features/command/pages/Analytics';
import { AdminUsers } from './features/command/pages/admin/AdminUsers';
import { AdminUserDetail } from './features/command/pages/admin/AdminUserDetail';
import { AdminDoctorApplications } from './features/command/pages/admin/AdminDoctorApplications';
import { Verify } from './features/verify/Verify';
import { ToastHost } from './components/toast/ToastHost';
import { Toaster } from './components/ui/sonner';
import { Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';

const Protected = ({ children }: { children: JSX.Element }) => {
  const t = useSelector((s: RootState) => s.auth.accessToken);
  return t ? children : <Navigate to="/login" replace />;
};

// Soft device guard — recommend the mobile app on small screens.
const useMobileNotice = () => {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (isMobile && !shown && !sessionStorage.getItem('mobile-dismissed')) setShown(true);
  }, [shown]);
  return [shown, () => { sessionStorage.setItem('mobile-dismissed', '1'); setShown(false); }] as const;
};

const MobileBanner = () => {
  const [shown, dismiss] = useMobileNotice();
  if (!shown) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 p-3">
      <div className="p-4 max-w-md mx-auto text-sm bg-card border border-border rounded-2xl shadow-lg">
        <div className="flex items-center gap-2 font-semibold mb-1">
          <Smartphone size={16} className="text-primary" /> You're on a phone
        </div>
        <p className="text-muted-foreground text-xs mb-3">
          This portal is built for desktop. Citizens & responders should use the Vitalis mobile app.
        </p>
        <div className="flex gap-2">
          <a
            href={import.meta.env.VITE_MOBILE_URL ?? 'http://localhost:5174'}
            className="flex-1 text-center bg-primary text-primary-foreground font-medium py-2 rounded-lg hover:bg-primary/90 transition"
          >
            Open mobile app
          </a>
          <button onClick={dismiss} className="px-3 text-muted-foreground hover:text-foreground">Dismiss</button>
        </div>
      </div>
    </div>
  );
};

export const App = () => (
  <>
    <ToastHost />
    <Toaster position="top-center" />
    <MobileBanner />
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/verify/:token" element={<Verify />} />
      <Route path="/command" element={<Protected><CommandShell /></Protected>}>
        <Route index element={<Logistics />} />
        <Route path="drones" element={<Drones />} />
        <Route path="ledger" element={<Ledger />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="admin/users" element={<AdminUsers />} />
        <Route path="admin/users/:id" element={<AdminUserDetail />} />
        <Route path="admin/doctor-applications" element={<AdminDoctorApplications />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  </>
);
