import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from './store';
import { Login } from './features/auth/Login';
import { CommandShell } from './components/layout/CommandShell';
import { Logistics } from './features/command/pages/Logistics';
import { Aeds } from './features/command/pages/Aeds';
import { Drones } from './features/command/pages/Drones';
import { Ledger } from './features/command/pages/Ledger';
import { Analytics } from './features/command/pages/Analytics';
import { AdminUsers } from './features/command/pages/admin/AdminUsers';
import { AdminUserDetail } from './features/command/pages/admin/AdminUserDetail';
import { AdminDoctorApplications } from './features/command/pages/admin/AdminDoctorApplications';
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
        <Route index element={<Logistics />} />
        <Route path="aeds" element={<Aeds />} />
        <Route path="drones" element={<Drones />} />
        <Route path="ledger" element={<Ledger />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="admin/users" element={<AdminUsers />} />
        <Route path="admin/users/:id" element={<AdminUserDetail />} />
        <Route path="admin/doctor-applications" element={<AdminDoctorApplications />} />
      </Route>
      <Route path="*" element={<Navigate to="/command" replace />} />
    </Routes>
  </>
);
