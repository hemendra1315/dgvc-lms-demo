import { LuBookmark, LuBookmarkCheck, LuDownload, LuEye, LuFileText } from 'react-icons/lu';
import type { PyqResource } from '../data/types';
import { actions } from '../lib/actions';
import { cx, formatBytes, ROMAN } from '../lib/format';
import { Link } from '../lib/router';
import { SampleBadge } from './ui';

export function PYQCard({ r, bookmarked }: { r: PyqResource; bookmarked: boolean }) {
  return (
    <article className="card p-4 flex flex-col gap-3 hover:border-brand/40 transition-colors" data-testid="pyq-card" data-id={r.id}>
      <div className="flex gap-3">
        <div className="h-11 w-11 shrink-0 rounded-lg bg-brand-soft text-brand flex items-center justify-center text-xl">
          <LuFileText />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Link to={`/pyq/${r.id}`} className="font-semibold leading-snug hover:text-brand">
              {r.subject}
            </Link>
            <button
              className={cx('icon-btn -mt-2 -mr-2 shrink-0', bookmarked && 'text-brand')}
              aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark paper'}
              aria-pressed={bookmarked}
              data-testid="bookmark-btn"
              onClick={() => actions.toggleBookmark(r)}
            >
              {bookmarked ? <LuBookmarkCheck /> : <LuBookmark />}
            </button>
          </div>
          <div className="text-[13px] text-muted mt-0.5">
            {r.subject_code} · {r.programme} · Sem {ROMAN[r.semester]}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="inline-flex items-center h-6 px-2 rounded-md bg-brand-soft text-brand font-semibold">
          {r.exam_month} {r.exam_year}
        </span>
        <span className="inline-flex items-center h-6 px-2 rounded-md border border-line text-muted">{r.exam_type.replace(' Examination', '')}</span>
        <SampleBadge />
      </div>
      <div className="text-xs text-muted flex flex-wrap gap-x-3 gap-y-1">
        <span>Max {r.max_marks} marks</span>
        <span>{r.duration}</span>
        <span>PDF · {r.page_count} pages · {formatBytes(r.file_size)}</span>
      </div>
      <div className="flex gap-2 mt-auto pt-1">
        <Link to={`/pyq/${r.id}`} className="btn-primary flex-1" data-testid="open-btn">
          <LuEye /> Open
        </Link>
        <button className="btn-outline flex-1" onClick={() => actions.download(r)} data-testid="download-btn">
          <LuDownload /> Download
        </button>
      </div>
    </article>
  );
}
