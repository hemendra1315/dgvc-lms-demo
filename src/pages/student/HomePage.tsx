import { useMemo, useState } from 'react';
import { LuArrowRight, LuBookmark, LuClock, LuDownload, LuFileText, LuSearch } from 'react-icons/lu';
import { activityResources, examSortValue, visibleResources } from '../../data/adapter';
import { useDemo, useSession } from '../../data/store';
import { greeting, ROMAN, timeAgo } from '../../lib/format';
import { Link, navigate } from '../../lib/router';
import { SampleBadge } from '../../components/ui';

export function HomePage() {
  const s = useDemo((x) => x);
  const user = useSession()!;
  const [q, setQ] = useState('');
  const papers = useMemo(() => visibleResources(s, user), [s, user]);
  const recent = activityResources(s, user, s.recent[user.id]).slice(0, 4);
  const mine = papers.filter((r) => r.programme === user.programme);
  const latest = [...papers].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);
  const subjects = [...new Map(mine.map((r) => [r.subject_key, r])).values()];

  return (
    <div className="space-y-7">
      <section className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{greeting()}, {user.name}</h1>
          <p className="text-sm text-muted mt-1">{user.programme} · {user.year} · Semester {ROMAN[user.semester ?? 1]}</p>
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); navigate(`/pyq${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`); }}
          className="relative"
          role="search"
        >
          <LuSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input h-12 pl-10 text-[15px]" placeholder="Search subjects, codes, question papers…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search question papers" data-testid="home-search" />
        </form>
      </section>

      <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Link to="/pyq" className="card p-4 hover:border-brand/50 col-span-2 sm:col-span-1 bg-brand text-white border-brand" data-testid="qa-pyq">
          <LuFileText className="text-2xl" />
          <div className="font-semibold mt-3">Previous Year Papers</div>
          <div className="text-xs text-white/80 mt-0.5">{papers.length} sample papers available</div>
        </Link>
        <Link to="/saved?tab=bookmarks" className="card p-4 hover:border-brand/50">
          <LuBookmark className="text-2xl text-brand" />
          <div className="font-semibold mt-3">Bookmarks</div>
          <div className="text-xs text-muted mt-0.5">{(s.bookmarks[user.id] ?? []).length} saved</div>
        </Link>
        <Link to="/saved?tab=downloads" className="card p-4 hover:border-brand/50">
          <LuDownload className="text-2xl text-brand" />
          <div className="font-semibold mt-3">Downloads</div>
          <div className="text-xs text-muted mt-0.5">{(s.downloads[user.id] ?? []).length} files</div>
        </Link>
      </section>

      {recent.length > 0 && (
        <section>
          <h2 className="font-semibold mb-3">Continue where you left off</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recent.map(({ resource: r, at }) => (
              <Link key={r.id} to={`/pyq/${r.id}`} className="card p-3.5 flex items-center gap-3 hover:border-brand/50 min-w-0">
                <span className="h-10 w-10 rounded-lg bg-brand-soft text-brand flex items-center justify-center shrink-0"><LuClock /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium truncate">{r.title}</span>
                  <span className="block text-xs text-muted">Opened {timeAgo(at)}</span>
                </span>
                <LuArrowRight className="text-muted" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Papers for my subjects</h2>
          <Link to={`/pyq?programme=${encodeURIComponent(user.programme ?? '')}`} className="text-sm text-brand font-medium">View all</Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {subjects.map((r) => {
            const count = mine.filter((x) => x.subject_key === r.subject_key).length;
            return (
              <Link key={r.subject_key} to={`/pyq?subject=${r.subject_key}`} className="card p-4 hover:border-brand/50" data-testid="subject-card">
                <div className="text-[11px] font-semibold text-brand">{r.subject_code}</div>
                <div className="font-medium leading-snug mt-1">{r.subject}</div>
                <div className="text-xs text-muted mt-2">Sem {ROMAN[r.semester]} · {count} paper{count === 1 ? '' : 's'}</div>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-3">Recently added</h2>
        <div className="card divide-y divide-line">
          {latest.sort((a, b) => examSortValue(b) - examSortValue(a)).map((r) => (
            <Link key={r.id} to={`/pyq/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-hover">
              <LuFileText className="text-brand shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium truncate">{r.title}</span>
                <span className="block text-xs text-muted">Question paper · {r.subject_code}</span>
              </span>
              <SampleBadge />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
