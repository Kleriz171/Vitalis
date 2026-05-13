import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from './store';
import { socket } from './realtime/socket';
import { pushToast } from './components/toast/toast';
import { Onboarding } from './features/auth/Onboarding';
import { Login } from './features/auth/Login';
import { Home } from './features/home/Home';
import { ResponderInbox } from './features/responder/Inbox';
import { ToastHost } from './components/toast/ToastHost';
import { MobileShell } from './components/MobileShell';
import { Toaster } from './components/ui/sonner';
import { Blood } from './features/blood/Blood';
import { Doctors } from './features/doctors/Doctors';
import { Community } from './features/community/Community';
import { Profile } from './features/profile/Profile';
import { HealthAssistant } from './features/assistant/HealthAssistant';

const RESPONDER_ROLES = ['doctor', 'nurse', 'student_responder', 'blood_donor'];

const Protected = ({ children }: { children: JSX.Element }) => {
  const t = useSelector((s: RootState) => s.auth.accessToken);
  return t ? children : <Navigate to="/login" replace />;
};

const RoleGate = () => {
  const role = useSelector((s: RootState) => s.auth.user?.role);
  if (role && RESPONDER_ROLES.includes(role)) {
    return <ResponderInbox />;
  }
  return <MobileShell />;
};

const useGlobalSocketBridge = () => {
  const token = useSelector((s: RootState) => s.auth.accessToken);
  const role = useSelector((s: RootState) => s.auth.user?.role);

  useEffect(() => {
    if (!token) return;
    const onNew = (e: any) => {
      if (role && RESPONDER_ROLES.includes(role)) {
        pushToast({
          tone: 'warn',
          title: `New ${e.emergency?.type ?? 'incident'} nearby`,
          body: 'Open inbox to accept',
          ttl: 6000,
        });
      }
    };
    socket.on('emergency:new', onNew);
    return () => { socket.off('emergency:new', onNew); };
  }, [token, role]);
};

export const App = () => {
  useGlobalSocketBridge();

  return (
    <>
      <ToastHost />
      <Toaster position="top-center" />
      <Routes>
        <Route path="/" element={<Onboarding />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/app/*"
          element={
            <Protected>
              <RoleGate />
            </Protected>
          }
        >
          <Route index element={<Home />} />
          <Route path="blood" element={<Blood />} />
          <Route path="doctors" element={<Doctors />} />
          <Route path="community" element={<Community />} />
          <Route path="profile" element={<Profile />} />
          <Route path="assistant" element={<HealthAssistant />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
};
