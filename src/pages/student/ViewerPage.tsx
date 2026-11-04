import { useEffect } from 'react';
import { canView } from '../../data/adapter';
import { useDemo, useSession } from '../../data/store';
import { actions } from '../../lib/actions';
import { ROMAN } from '../../lib/format';
import { navigate } from '../../lib/router';
import { PDFViewer } from '../../components/PDFViewer';
import { EmptyState } from '../../components/ui';

/** Full-screen in-app viewer for students (/pyq/:id) and admins (/admin/resources/:id/preview). */
export function ViewerPage({ id, backTo }: { id: string; backTo: string }) {
  const s = useDemo((x) => x);
  const user = useSession();
  const r = s.resources.find((x) => x.id === id);
  const allowed = !!r && canView(user, r);
  const isStudent = user?.role === 'student';

  useEffect(() => {
    if (allowed && isStudent) actions.recordOpen(id);
  }, [id, allowed, isStudent]);

  const back = () => (history.length > 1 ? history.back() : navigate(backTo));

  if (!r) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <EmptyState title="Paper not found" body="This question paper does not exist or has been removed." action={<button className="btn-primary" onClick={() => navigate(backTo)}>Back to papers</button>} />
      </div>
    );
  }
  return (
    <div className="h-[100dvh]">
      <PDFViewer
        url={r.file_url}
        title={r.title}
        subtitle={`${r.subject_code} · ${r.programme} · Sem ${ROMAN[r.semester]} · ${r.status !== 'published' ? `${r.status.toUpperCase()} · ` : ''}SAMPLE`}
        denied={!allowed}
        bookmarked={!!user && (s.bookmarks[user.id] ?? []).includes(r.id)}
        onBack={back}
        onDownload={() => actions.download(r)}
        onToggleBookmark={allowed ? () => actions.toggleBookmark(r) : undefined}
      />
    </div>
  );
}
