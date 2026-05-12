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

const Protected = ({ children }: { children: JSX.Element }) => {
  const t = useSelector((s: RootState) => s.auth.accessToken);
  return t ? children : <Navigate to="/login" replace />;
};

const useGlobalSocketBridge = () => {
  const token = useSelector((s: RootState) => s.auth.accessToken);
  const role = useSelector((s: RootState) => s.auth.user?.role);

  useEffect(() => {
    if (!token) return;
    const onNew = (e: any) => {
      if (role === 'doctor' || role === 'nurse' || role === 'student_responder' || role === 'blood_donor') {
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
  const role = useSelector((s: RootState) => s.auth.user?.role);

  return (
    <>
      <ToastHost />
      <Routes>
        <Route path="/" element={<Onboarding />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/app"
          element={
            <Protected>
              {role && ['doctor', 'nurse', 'student_responder', 'blood_donor'].includes(role)
                ? <ResponderInbox />
                : <Home />}
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </>
  );
};
