import { useMemo } from 'react';
import { LuArchive, LuBookmark, LuDownload, LuEyeOff, LuFileText, LuSend } from 'react-icons/lu';
import { visibleResources } from '../../data/adapter';
import { useDemo, useSession } from '../../data/store';
import { formatDate, timeAgo } from '../../lib/format';
import { Link } from '../../lib/router';
import { PageHeader, StatisticsCard, StatusBadge } from '../../components/ui';

export function AdminDashboard() {
  const s = useDemo((x) => x);
  const user = useSession()!;
  const mine = useMemo(() => visibleResources(s, user), [s, user]);
  const ids = new Set(mine.map((r) => r.id));
  const count = (st: string) => mine.filter((r) => r.status === st).length;
  const downloads = Object.values(s.downloads).flat().filter((d) => ids.has(d.id)).length;
  const bookmarks = Object.values(s.bookmarks).flat().filter((id) => ids.has(id)).length;
  const latest = [...mine].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={user.role === 'super_admin' ? 'All departments' : user.role === 'department_admin' ? `Scope: ${user.department}` : `Scope: your assigned subjects`}
      />
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3" data-testid="admin-stats">
        <StatisticsCard label="Question papers" value={mine.length} icon={<LuFileText />} hint="In your scope" />
        <StatisticsCard label="Published" value={count('published')} icon={<LuSend />} hint="Visible to students" />
        <StatisticsCard label="Unpublished" value={count('unpublished') + count('draft')} icon={<LuEyeOff />} />
        <StatisticsCard label="Archived" value={count('archived')} icon={<LuArchive />} />
        <StatisticsCard label="Downloads" value={downloads} icon={<LuDownload />} hint="Demo activity" />
        <StatisticsCard label="Bookmarks" value={bookmarks} icon={<LuBookmark />} hint="Demo activity" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-5">
        <section className="card">
          <div className="flex items-center justify-between px-4 h-12 border-b border-line">
            <h2 className="font-semibold text-sm">Recent uploads</h2>
            <Link to="/admin/resources" className="text-sm text-brand font-medium">Manage resources</Link>
          </div>
          <div className="divide-y divide-line">
            {latest.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{r.title}</div>
                  <div className="text-xs text-muted">{r.department} · added {formatDate(r.created_at)}</div>
                </div>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        </section>
        <section className="card">
          <div className="flex items-center justify-between px-4 h-12 border-b border-line">
            <h2 className="font-semibold text-sm">Recent activity</h2>
            <Link to="/admin/audit" className="text-sm text-brand font-medium">Audit log</Link>
          </div>
          <div className="divide-y divide-line">
            {s.audit.slice(0, 6).map((a) => (
              <div key={a.id} className="px-4 py-2.5 text-sm">
                <div><span className="font-medium">{a.action}</span> · <span className="text-muted">{a.entity}</span></div>
                <div className="text-xs text-muted">{a.actor} · {timeAgo(a.at)}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
