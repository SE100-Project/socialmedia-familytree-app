import { Link, NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { Button, Spinner, ToastProvider } from './components/ui';
import { isMockMode } from './lib/api';
import { formatRoleLabel, MeProvider, useMe } from './lib/me';
import { BranchesPage } from './pages/genealogy/BranchesPage';
import { ProfilesPage } from './pages/genealogy/ProfilesPage';
import { RelationshipsPage } from './pages/genealogy/RelationshipsPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { RegisterPage } from './pages/RegisterPage';
import { UiKitPreviewPage } from './pages/UiKitPreviewPage';

const NAV_ITEMS = [
  { to: '/', label: 'Tổng quan', end: true },
  { to: '/branches', label: 'Chi phái' },
  { to: '/profiles', label: 'Hồ sơ' },
  { to: '/relationships', label: 'Quan hệ & Cây' },
];

function AppShell() {
  const { user, logout } = useMe();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <Link to="/" className="app-brand">
            <span className="app-brand-crest">GP</span>
            <span>Gia Phả Số</span>
          </Link>

          <nav className="app-nav" aria-label="Điều hướng chính">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="app-user-bar">
            {isMockMode() && <span className="badge badge-accent">Mock Demo</span>}
            <span className="badge badge-brand">{formatRoleLabel(user)}</span>
            <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
              {user?.phone ?? user?.email ?? user?.accountCode}
            </span>
            <Button size="sm" variant="ghost" onClick={logout}>
              Đăng xuất
            </Button>
          </div>
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}

function MemberGuard() {
  const { user, loading } = useMe();
  if (loading) return <Spinner fullPage />;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.profileId) return <Navigate to="/onboarding" replace />;
  return <AppShell />;
}

function OnboardingGuard() {
  const { user, loading } = useMe();
  if (loading) return <Spinner fullPage />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.profileId) return <Navigate to="/" replace />;
  return <OnboardingPage />;
}

export function App() {
  return (
    <ToastProvider>
      <MeProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/ui-kit" element={<UiKitPreviewPage />} />
          <Route path="/onboarding" element={<OnboardingGuard />} />
          <Route element={<MemberGuard />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/branches" element={<BranchesPage />} />
            <Route path="/profiles" element={<ProfilesPage />} />
            <Route path="/relationships" element={<RelationshipsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </MeProvider>
    </ToastProvider>
  );
}
