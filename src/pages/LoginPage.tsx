import { useState } from 'react';
import { LuGraduationCap, LuShieldCheck, LuUser, LuUsers } from 'react-icons/lu';
import { z } from 'zod';
import { ThemeToggle, DemoStrip } from '../components/Shells';
import { Logo } from '../components/ui';
import { DEMO_PASSWORD, DEMO_USERS } from '../data/demoUsers';
import type { DemoUser } from '../data/types';
import { actions } from '../lib/actions';
import { navigate } from '../lib/router';

const schema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const ICONS = { student: LuGraduationCap, faculty: LuUser, department_admin: LuUsers, super_admin: LuShieldCheck };

export function enter(u: DemoUser) {
  actions.signIn(u.id);
  navigate(u.role === 'student' ? '/home' : '/admin', { replace: true });
}

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors;
      return setErrors({ email: f.email?.[0], password: f.password?.[0] });
    }
    const u = DEMO_USERS.find((x) => x.email.toLowerCase() === parsed.data.email.toLowerCase());
    if (!u || parsed.data.password !== DEMO_PASSWORD) return setErrors({ form: 'Email or password is incorrect. Use one of the demo accounts below.' });
    enter(u);
  };

  return (
    <div className="min-h-full flex flex-col">
      <DemoStrip />
      <div className="flex-1 grid lg:grid-cols-2">
        <section className="hidden lg:flex flex-col justify-between bg-sidebar text-white p-10">
          <Logo light />
          <div>
            <h1 className="text-3xl font-semibold tracking-tight leading-tight max-w-md">Every question paper and study resource, in one place.</h1>
            <p className="text-white/75 mt-3 max-w-md">DGVC LMS brings previous year papers, notes and lectures for DG Vaishnav College programmes into a single app for students and staff.</p>
          </div>
          <p className="text-xs text-white/60">Demonstration build. All academic content shown is sample data and must be validated before production use.</p>
        </section>
        <section className="flex flex-col items-center justify-center p-5 sm:p-10">
          <div className="w-full max-w-md">
            <div className="flex items-center justify-between mb-8 lg:hidden">
              <Logo />
              <ThemeToggle />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
            <p className="text-sm text-muted mt-1">Use a demo account to explore the student app or the admin dashboard.</p>

            <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
              <label className="block">
                <span className="label">College email</span>
                <input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@demo.dgvc.in" aria-invalid={!!errors.email} />
                {errors.email && <span className="text-xs text-bad mt-1 block">{errors.email}</span>}
              </label>
              <label className="block">
                <span className="label">Password</span>
                <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password} />
                {errors.password && <span className="text-xs text-bad mt-1 block">{errors.password}</span>}
              </label>
              {errors.form && <div className="text-sm text-bad">{errors.form}</div>}
              <button className="btn-primary w-full h-11" type="submit">Sign in</button>
            </form>

            <div className="mt-8">
              <div className="flex items-center gap-3 text-xs text-muted mb-3">
                <span className="h-px bg-line flex-1" /> Demo accounts · password <code className="font-mono text-ink">{DEMO_PASSWORD}</code> <span className="h-px bg-line flex-1" />
              </div>
              <div className="grid gap-2" data-testid="demo-accounts">
                {DEMO_USERS.map((u) => {
                  const Icon = ICONS[u.role];
                  return (
                    <button key={u.id} onClick={() => enter(u)} className="card flex items-center gap-3 p-3 text-left hover:border-brand/50 hover:bg-hover cursor-pointer transition-colors" data-testid={`demo-${u.role}`}>
                      <span className="h-10 w-10 rounded-lg bg-brand-soft text-brand flex items-center justify-center text-lg shrink-0"><Icon /></span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{u.name} <span className="text-muted font-normal">· {u.title}</span></span>
                        <span className="block text-xs text-muted truncate">{u.email}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted mt-4">Demo sign-in runs entirely in this browser and is not production authentication. Production uses Supabase Auth with server-side role checks.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
