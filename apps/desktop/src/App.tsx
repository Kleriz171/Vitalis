import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from './store';
import { Login } from './features/auth/Login';
import { CommandShell } from './components/layout/CommandShell';
import { LiveCalls } from './features/live-calls/LiveCalls';
import { Defibrillators } from './features/equipment/Defibrillators';
import { Drones } from './features/equipment/Drones';
import { CallLog } from './features/reports/CallLog';
import { ReportsOverview } from './features/reports/Overview';
import { Users } from './features/people/Users';
import { UserDetail } from './features/people/UserDetail';
import { DoctorApplications } from './features/people/DoctorApplications';
import { Toaster } from './components/ui/sonner';

const Protected = ({ children }: { children: JSX.Element }) => {
  const t = useSelector((s: RootState) => s.auth.accessToken);
  return t ? children : <Navigate to="/login" replace />;
};

// Operator console only. Marketing and certificate verification live on the public website.
export const App = () => (
  <>
    <Toaster position="top-center" />
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/command" element={<Protected><CommandShell /></Protected>}>
        <Route index element={<LiveCalls />} />
        <Route path="aeds" element={<Defibrillators />} />
        <Route path="drones" element={<Drones />} />
        <Route path="ledger" element={<CallLog />} />
        <Route path="analytics" element={<ReportsOverview />} />
        <Route path="admin/users" element={<Users />} />
        <Route path="admin/users/:id" element={<UserDetail />} />
        <Route path="admin/doctor-applications" element={<DoctorApplications />} />
      </Route>
      <Route path="*" element={<Navigate to="/command" replace />} />
    </Routes>
  </>
);
