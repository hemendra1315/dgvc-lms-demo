import { type ReactNode, useEffect, useState } from 'react';
import {
  LuBookmark, LuFileText, LuFolderOpen, LuHouse, LuLayoutDashboard, LuLogOut, LuMenu, LuMoon, LuScrollText, LuSun, LuUser, LuX,
} from 'react-icons/lu';
import { useSession } from '../data/store';
import { actions } from '../lib/actions';
import { cx } from '../lib/format';
import { Link, navigate, useLocation } from '../lib/router';
import { Logo } from './ui';

export function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem('dgvc-lms-theme', JSON.stringify(dark ? 'dark' : 'light')); } catch { /* ignore */ }
  }, [dark]);
  return { dark, toggle: () => setDark((d) => !d) };
}

export function ThemeToggle({ className }: { className?: string }) {
  const { dark, toggle } = useTheme();
  return (
    <button className={cx('icon-btn', className)} onClick={toggle} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
      {dark ? <LuSun /> : <LuMoon />}
    </button>
  );
}

export function DemoStrip() {
  return (
    <div className="bg-warn/10 border-b border-warn/25 text-[11px] sm:text-xs text-center px-3 py-1.5 text-ink">
      <strong>Demo mode</strong> · local sample data and demo sign-in (not production-secure) · question papers are SAMPLE / AI-generated
    </div>
  );
}

const STUDENT_NAV = [
  { to: '/home', label: 'Home', icon: LuHouse, match: (p: string) => p === '/home' },
  { to: '/pyq', label: 'Papers', icon: LuFileText, match: (p: string) => p.startsWith('/pyq') },
  { to: '/saved', label: 'Saved', icon: LuBookmark, match: (p: string) => p.startsWith('/saved') },
  { to: '/profile', label: 'Profile', icon: LuUser, match: (p: string) => p.startsWith('/profile') },
];

export function StudentShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const user = useSession();
  return (
    <div className="min-h-full flex flex-col">
      <DemoStrip />
      <header className="sticky top-0 z-30 bg-card/95 backdrop-blur border-b border-line">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-14 px-4">
          <Link to="/home" aria-label="DGVC LMS home"><Logo /></Link>
          <nav className="hidden md:flex items-center gap-1" aria-label="Main">
            {STUDENT_NAV.map((n) => (
              <Link key={n.to} to={n.to} className={cx('btn-ghost', n.match(pathname) && 'text-brand bg-brand-soft')}>
                <n.icon /> {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Link to="/profile" className="h-9 w-9 rounded-full bg-brand text-white flex items-center justify-center text-sm font-semibold" aria-label="Profile">
              {user?.name.charAt(0)}
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-5 pb-24 md:pb-10">{children}</main>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-card border-t border-line grid grid-cols-4 pb-[env(safe-area-inset-bottom)]" aria-label="Bottom navigation">
        {STUDENT_NAV.map((n) => {
          const active = n.match(pathname);
          return (
            <Link key={n.to} to={n.to} className={cx('flex flex-col items-center justify-center gap-0.5 h-16 text-[11px] font-medium', active ? 'text-brand' : 'text-muted')} aria-current={active ? 'page' : undefined}>
              <n.icon className="text-xl" /> {n.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

const ADMIN_NAV = [
  { to: '/admin', label: 'Dashboard', icon: LuLayoutDashboard, match: (p: string) => p === '/admin' },
  { to: '/admin/resources', label: 'Resources', icon: LuFolderOpen, match: (p: string) => p.startsWith('/admin/resources') },
  { to: '/admin/audit', label: 'Audit Logs', icon: LuScrollText, match: (p: string) => p.startsWith('/admin/audit') },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const user = useSession();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const sidebar = (
    <div className="flex flex-col h-full bg-sidebar text-white">
      <div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
        <Logo light />
        <button className="icon-btn text-white hover:bg-white/10 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><LuX /></button>
      </div>
      <div className="px-4 py-3 text-[11px] uppercase tracking-wider text-white/60">Administration</div>
      <nav className="px-2 space-y-0.5 flex-1" aria-label="Admin">
        {ADMIN_NAV.map((n) => (
          <Link key={n.to} to={n.to} className={cx('flex items-center gap-3 h-10 px-3 rounded-lg text-sm', n.match(pathname) ? 'bg-white/15 font-medium' : 'text-white/80 hover:bg-white/10')}>
            <n.icon /> {n.label}
          </Link>
        ))}
      </nav>
      <div className="p-3 border-t border-white/10">
        <div className="px-2 pb-2">
          <div className="text-sm font-medium truncate">{user?.name}</div>
          <div className="text-[11px] text-white/60 truncate">{user?.title}</div>
        </div>
        <button className="flex items-center gap-3 h-10 px-3 rounded-lg text-sm text-white/80 hover:bg-white/10 w-full cursor-pointer"
          onClick={() => { actions.signOut(); navigate('/login'); }}>
          <LuLogOut /> Switch account
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-full flex flex-col">
      <DemoStrip />
      <div className="flex flex-1 min-h-0">
        <aside className="hidden lg:block w-60 shrink-0 sticky top-0 h-screen">{sidebar}</aside>
        {open && (
          <div className="lg:hidden fixed inset-0 z-40">
            <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-64">{sidebar}</div>
          </div>
        )}
        <div className="flex-1 min-w-0 flex flex-col">
          <header className="h-14 flex items-center justify-between gap-2 px-4 border-b border-line bg-card sticky top-0 z-20">
            <div className="flex items-center gap-2">
              <button className="icon-btn lg:hidden -ml-2" onClick={() => setOpen(true)} aria-label="Open menu"><LuMenu /></button>
              <span className="text-sm text-muted">DGVC LMS · Admin</span>
            </div>
            <div className="flex items-center gap-1">
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 p-4 sm:p-6 max-w-[1400px] w-full">{children}</main>
        </div>
      </div>
    </div>
  );
}
