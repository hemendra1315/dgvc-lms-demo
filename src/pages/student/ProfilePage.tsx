import { useState } from 'react';
import { LuLogOut, LuMoon, LuRotateCcw, LuSun } from 'react-icons/lu';
import { useSession } from '../../data/store';
import { actions } from '../../lib/actions';
import { ROMAN } from '../../lib/format';
import { navigate } from '../../lib/router';
import { useTheme } from '../../components/Shells';
import { ConfirmationDialog, PageHeader } from '../../components/ui';

export function ProfilePage() {
  const user = useSession()!;
  const { dark, toggle } = useTheme();
  const [confirmReset, setConfirmReset] = useState(false);
  const rows: [string, string][] = [
    ['College email', user.email],
    ['Department', user.department ?? '—'],
    ['Programme', user.programme ?? '—'],
    ['Year of study', user.year ?? '—'],
    ['Semester', `Semester ${ROMAN[user.semester ?? 1]}`],
    ['Register number', user.registerNo ?? '—'],
  ];
  return (
    <div className="max-w-2xl">
      <PageHeader title="Profile" />
      <div className="card p-5 flex items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-brand text-white text-xl font-semibold flex items-center justify-center">{user.name.charAt(0)}</div>
        <div className="min-w-0">
          <div className="font-semibold text-lg">{user.name}</div>
          <div className="text-sm text-muted">{user.programme}</div>
          <span className="inline-flex items-center h-6 px-2 mt-1.5 rounded-md bg-ok/10 text-ok border border-ok/30 text-[11px] font-semibold">APPROVED</span>
        </div>
      </div>
      <div className="card mt-4 divide-y divide-line">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-5 py-3 text-sm">
            <span className="text-muted">{k}</span><span className="text-right">{v}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted mt-2 px-1">Role and approval status are assigned by administrators and cannot be changed here.</p>

      <div className="card mt-4 divide-y divide-line">
        <button className="w-full flex items-center justify-between px-5 py-3.5 text-sm hover:bg-hover cursor-pointer" onClick={toggle}>
          <span className="flex items-center gap-3">{dark ? <LuSun /> : <LuMoon />} Theme</span>
          <span className="text-muted">{dark ? 'Dark' : 'Light'}</span>
        </button>
        <button className="w-full flex items-center gap-3 px-5 py-3.5 text-sm hover:bg-hover cursor-pointer" onClick={() => setConfirmReset(true)}>
          <LuRotateCcw /> Reset demo data
        </button>
        <button className="w-full flex items-center gap-3 px-5 py-3.5 text-sm text-bad hover:bg-hover cursor-pointer" onClick={() => { actions.signOut(); navigate('/login', { replace: true }); }} data-testid="sign-out">
          <LuLogOut /> Sign out
        </button>
      </div>
      <ConfirmationDialog open={confirmReset} title="Reset demo data?" confirmLabel="Reset"
        body="This restores all sample question papers and clears bookmarks, downloads, recent activity and admin changes in this browser."
        onCancel={() => setConfirmReset(false)} onConfirm={() => { actions.resetDemo(); setConfirmReset(false); }} />
    </div>
  );
}
