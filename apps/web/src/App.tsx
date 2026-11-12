import { Link, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useMe, MeProvider } from './lib/me';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { HomePage } from './pages/HomePage';
import { UiKitPreviewPage } from './pages/UiKitPreviewPage';

function AppShell() {
  const { user } = useMe();
  const menu = user?.role === 'ADMIN' ? [['/', 'Trang chủ'], ['/admin', 'Quản trị']] : [['/', 'Trang chủ']];
  return <><nav style={{ display: 'flex', gap: 12, padding: 12 }}>{menu.map(([to, label]) => <Link key={to} to={to}>{label}</Link>)}</nav><Outlet /></>;
}

function Guard() {
  const { user, loading } = useMe();
  if (loading) return <p>Đang tải...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.profile) return <Navigate to="/onboarding" replace />;
  return <AppShell />;
}

export function App() {
  return <MeProvider><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/ui-kit" element={<UiKitPreviewPage />} />
    <Route element={<Guard />}><Route path="/" element={<HomePage />} /></Route>
  </Routes></MeProvider>;
}
