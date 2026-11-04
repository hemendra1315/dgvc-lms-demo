import { Component, type ReactNode, useEffect } from 'react';
import { isStaff } from './data/demoUsers';
import { useSession } from './data/store';
import { matchPath, navigate, useLocation } from './lib/router';
import { Toaster } from './lib/toast';
import { AdminShell, StudentShell } from './components/Shells';
import { EmptyState } from './components/ui';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/student/HomePage';
import { PYQPage } from './pages/student/PYQPage';
import { ProfilePage } from './pages/student/ProfilePage';
import { SavedPage } from './pages/student/SavedPage';
import { ViewerPage } from './pages/student/ViewerPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminResources } from './pages/admin/AdminResources';
import { AuditPage } from './pages/admin/AuditPage';

function Redirect({ to }: { to: string }) {
  useEffect(() => navigate(to, { replace: true }), [to]);
  return null;
}

function Routes() {
  const { pathname } = useLocation();
  const user = useSession();

  if (pathname === '/login' || pathname === '/') return user ? <Redirect to={isStaff(user) ? '/admin' : '/home'} /> : <LoginPage />;
  if (!user) return <Redirect to="/login" />;

  // Admin area: staff only.
  if (pathname.startsWith('/admin')) {
    if (!isStaff(user)) return <Forbidden />;
    const preview = matchPath('/admin/resources/:id/preview', pathname);
    if (preview) return <ViewerPage id={preview.id} backTo="/admin/resources" />;
    const page =
      pathname === '/admin' ? <AdminDashboard /> :
      pathname === '/admin/resources' ? <AdminResources /> :
      pathname === '/admin/audit' ? <AuditPage /> : null;
    return <AdminShell>{page ?? <NotFound home="/admin" />}</AdminShell>;
  }

  // Student area. Staff are sent to the admin dashboard.
  if (isStaff(user)) return <Redirect to="/admin" />;
  const viewer = matchPath('/pyq/:id', pathname);
  if (viewer) return <ViewerPage id={viewer.id} backTo="/pyq" />;
  const page =
    pathname === '/home' ? <HomePage /> :
    pathname === '/pyq' ? <PYQPage /> :
    pathname === '/saved' ? <SavedPage /> :
    pathname === '/profile' ? <ProfilePage /> : null;
  return <StudentShell>{page ?? <NotFound home="/home" />}</StudentShell>;
}

function Forbidden() {
  return (
    <div className="p-6 max-w-lg mx-auto mt-10" data-testid="forbidden">
      <EmptyState title="Access denied" body="The admin dashboard is only available to staff accounts." action={<button className="btn-primary" onClick={() => navigate('/home')}>Go to my dashboard</button>} />
    </div>
  );
}

function NotFound({ home }: { home: string }) {
  return <EmptyState title="Page not found" body="This page does not exist." action={<button className="btn-primary" onClick={() => navigate(home)}>Go home</button>} />;
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error)
      return (
        <div className="p-6 max-w-lg mx-auto mt-10">
          <EmptyState title="Something went wrong" body={this.state.error.message} action={<button className="btn-primary" onClick={() => location.assign('/')}>Reload app</button>} />
        </div>
      );
    return this.props.children;
  }
}

export function App() {
  return (
    <ErrorBoundary>
      <Routes />
      <Toaster />
    </ErrorBoundary>
  );
}
