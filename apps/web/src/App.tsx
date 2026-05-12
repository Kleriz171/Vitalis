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
import { ToastHost } from './components/toast/ToastHost';
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
      <div className="glass-strong p-4 max-w-md mx-auto text-sm">
        <div className="font-semibold mb-1">You're on a phone</div>
        <p className="text-slate-400 text-xs mb-3">This portal is built for desktop. Citizens & responders should use the Vitalis mobile app.</p>
        <div className="flex gap-2">
          <a
            href="http://localhost:5174"
            className="flex-1 text-center bg-neon-cyan text-ink-900 font-semibold py-2 rounded-lg"
          >
            Open mobile app
          </a>
          <button onClick={dismiss} className="px-3 text-slate-400 hover:text-slate-100">Dismiss</button>
        </div>
      </div>
    </div>
  );
};

export const App = () => (
  <>
    <ToastHost />
    <MobileBanner />
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/command" element={<Protected><CommandShell /></Protected>}>
        <Route index element={<Logistics />} />
        <Route path="drones" element={<Drones />} />
        <Route path="ledger" element={<Ledger />} />
        <Route path="analytics" element={<Analytics />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  </>
);
