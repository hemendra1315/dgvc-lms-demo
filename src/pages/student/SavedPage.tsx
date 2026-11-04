import { LuBookmark, LuBookmarkX, LuDownload, LuEye, LuHistory, LuTrash2 } from 'react-icons/lu';
import { activityResources } from '../../data/adapter';
import { useDemo, useSession } from '../../data/store';
import type { PyqResource } from '../../data/types';
import { actions } from '../../lib/actions';
import { cx, formatBytes, timeAgo } from '../../lib/format';
import { Link, setSearchParams, useLocation } from '../../lib/router';
import { EmptyState, PageHeader, SampleBadge } from '../../components/ui';

type Tab = 'bookmarks' | 'downloads' | 'recent';

export function SavedPage() {
  const s = useDemo((x) => x);
  const user = useSession()!;
  const { search } = useLocation();
  const tab = (search.get('tab') as Tab) || 'bookmarks';

  const bookmarks = activityResources(s, user, (s.bookmarks[user.id] ?? []).map((id) => ({ id, at: '' })));
  const downloads = activityResources(s, user, s.downloads[user.id]);
  const recent = activityResources(s, user, s.recent[user.id]);
  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'bookmarks', label: 'Bookmarks', count: bookmarks.length },
    { key: 'downloads', label: 'Downloads', count: downloads.length },
    { key: 'recent', label: 'Recent activity', count: recent.length },
  ];

  return (
    <div>
      <PageHeader title="Saved" subtitle="Your bookmarks, downloads and recently opened papers" />
      <div className="flex gap-1 border-b border-line mb-4 overflow-x-auto" role="tablist">
        {tabs.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setSearchParams({ tab: t.key })} data-testid={`tab-${t.key}`}
            className={cx('h-10 px-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap cursor-pointer', tab === t.key ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink')}>
            {t.label} <span className="ml-1 text-xs text-muted">{t.count}</span>
          </button>
        ))}
      </div>

      {tab === 'bookmarks' && (bookmarks.length ? (
        <List items={bookmarks.map((b) => ({ r: b.resource }))} action={(r) => (
          <button className="icon-btn" onClick={() => actions.toggleBookmark(r)} aria-label="Remove bookmark" data-testid="remove-bookmark"><LuBookmarkX /></button>
        )} />
      ) : <EmptyState icon={<LuBookmark />} title="No bookmarks yet" body="Tap the bookmark icon on any question paper to save it here." action={<Link to="/pyq" className="btn-primary">Browse papers</Link>} />)}

      {tab === 'downloads' && (downloads.length ? (
        <>
          <p className="text-xs text-muted mb-3">Files are saved by your browser to your device's Downloads folder. Removing an item here clears it from this list only.</p>
          <List items={downloads.map((d) => ({ r: d.resource, note: `Downloaded ${timeAgo(d.at)}` }))} action={(r) => (
            <button className="icon-btn" onClick={() => actions.removeDownload(r.id)} aria-label="Remove from downloads" data-testid="remove-download"><LuTrash2 /></button>
          )} />
        </>
      ) : <EmptyState icon={<LuDownload />} title="No downloads yet" body="Papers you download will be listed here." action={<Link to="/pyq" className="btn-primary">Browse papers</Link>} />)}

      {tab === 'recent' && (recent.length ? (
        <List items={recent.map((d) => ({ r: d.resource, note: `Opened ${timeAgo(d.at)}` }))} />
      ) : <EmptyState icon={<LuHistory />} title="No recent activity" body="Papers you open will appear here." />)}
    </div>
  );
}

function List({ items, action }: { items: { r: PyqResource; note?: string }[]; action?: (r: PyqResource) => React.ReactNode }) {
  return (
    <div className="card divide-y divide-line" data-testid="saved-list">
      {items.map(({ r, note }) => (
        <div key={r.id} className="flex items-center gap-2 px-3 sm:px-4 py-3" data-testid="saved-item">
          <div className="min-w-0 flex-1">
            <Link to={`/pyq/${r.id}`} className="block text-sm font-medium truncate hover:text-brand">{r.title}</Link>
            <div className="text-xs text-muted flex items-center gap-2 mt-0.5 flex-wrap">
              <span>{r.subject_code}</span><span>{formatBytes(r.file_size)}</span>{note && <span>{note}</span>}<SampleBadge className="h-5" />
            </div>
          </div>
          <Link to={`/pyq/${r.id}`} className="icon-btn" aria-label="Open"><LuEye /></Link>
          <button className="icon-btn" onClick={() => actions.download(r)} aria-label="Download"><LuDownload /></button>
          {action?.(r)}
        </div>
      ))}
    </div>
  );
}
