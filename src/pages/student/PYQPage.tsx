import { useMemo } from 'react';
import { LuRotateCcw, LuSearch, LuX } from 'react-icons/lu';
import { facets, filterResources, sortResources, visibleResources } from '../../data/adapter';
import { useDemo, useSession } from '../../data/store';
import type { SortKey } from '../../data/types';
import { cx, ROMAN } from '../../lib/format';
import { setSearchParams, useLocation } from '../../lib/router';
import { PYQCard } from '../../components/PYQCard';
import { DemoNotice, EmptyState, FilterDropdown, PageHeader } from '../../components/ui';

export function PYQPage() {
  const s = useDemo((x) => x);
  const user = useSession()!;
  const { search } = useLocation();
  const all = useMemo(() => visibleResources(s, user), [s, user]);
  const f = facets(all);
  const bookmarks = new Set(s.bookmarks[user.id] ?? []);

  const filters = {
    q: search.get('q') ?? '',
    subject: search.get('subject') ?? undefined,
    semester: search.get('semester') ? Number(search.get('semester')) : undefined,
    year: search.get('year') ? Number(search.get('year')) : undefined,
    examType: search.get('type') ?? undefined,
    department: search.get('department') ?? undefined,
    programme: search.get('programme') ?? undefined,
  };
  const sort = (search.get('sort') as SortKey) || 'latest';
  // Subject chips reflect the other filters (except subject) so they never lead to an empty list.
  const forChips = filterResources(all, { ...filters, subject: undefined });
  const chipSubjects = facets(forChips).subjects;
  const results = sortResources(filterResources(all, filters), sort);
  const active = Object.entries(filters).some(([k, v]) => k !== 'q' && v !== undefined) || !!filters.q;

  return (
    <div>
      <PageHeader title="Previous Year Question Papers" subtitle={`${all.length} sample papers across ${f.subjects.length} subjects`} />
      <div className="mb-4">
        <DemoNotice>
          These are <strong>SAMPLE / AI-generated demo papers</strong> created from generic question banks for this demonstration. They are not actual DG Vaishnav College examination papers.
        </DemoNotice>
      </div>

      <div className="relative mb-3">
        <LuSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          className="input h-11 pl-10 pr-10"
          placeholder="Search by subject, code, year…"
          value={filters.q}
          onChange={(e) => setSearchParams({ q: e.target.value })}
          aria-label="Search question papers"
          data-testid="pyq-search"
        />
        {filters.q && (
          <button className="absolute right-2 top-1/2 -translate-y-1/2 icon-btn h-8 w-8" onClick={() => setSearchParams({ q: '' })} aria-label="Clear search"><LuX /></button>
        )}
      </div>

      {/* Subject selector */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 mb-2 [scrollbar-width:none]" role="tablist" aria-label="Subjects" data-testid="subject-chips">
        <button role="tab" aria-selected={!filters.subject} onClick={() => setSearchParams({ subject: '' })}
          className={cx('chip', !filters.subject ? 'bg-brand text-white border-brand' : 'border-line bg-card text-ink hover:bg-hover')}>
          All subjects
        </button>
        {chipSubjects.map((sub) => (
          <button key={sub.key} role="tab" aria-selected={filters.subject === sub.key} onClick={() => setSearchParams({ subject: sub.key })}
            className={cx('chip', filters.subject === sub.key ? 'bg-brand text-white border-brand' : 'border-line bg-card text-ink hover:bg-hover')}
            data-testid={`chip-${sub.key}`}>
            {sub.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <FilterDropdown label="Semester" value={filters.semester} testId="filter-semester"
          options={f.semesters.map((x) => ({ value: x, label: `Semester ${ROMAN[x]}` }))}
          onChange={(v) => setSearchParams({ semester: v })} />
        <FilterDropdown label="Exam year" value={filters.year} testId="filter-year"
          options={f.years.map((x) => ({ value: x, label: String(x) }))}
          onChange={(v) => setSearchParams({ year: v })} />
        <FilterDropdown label="Exam type" value={filters.examType} testId="filter-type"
          options={f.examTypes.map((x) => ({ value: x, label: x.replace(' Examination', '') }))}
          onChange={(v) => setSearchParams({ type: v })} />
        <FilterDropdown label="Programme" value={filters.programme} testId="filter-programme"
          options={f.programmes.map((x) => ({ value: x, label: x }))}
          onChange={(v) => setSearchParams({ programme: v })} />
        <label className="block col-span-2 md:col-span-1">
          <span className="label">Sort by</span>
          <select className="input select-chevron appearance-none pr-8" value={sort} onChange={(e) => setSearchParams({ sort: e.target.value === 'latest' ? '' : e.target.value })} data-testid="sort">
            <option value="latest">Latest exam first</option>
            <option value="oldest">Oldest exam first</option>
            <option value="az">Alphabetical</option>
          </select>
        </label>
      </div>

      <div className="flex items-center justify-between mb-3 text-sm">
        <span className="text-muted" data-testid="result-count">{results.length} paper{results.length === 1 ? '' : 's'}</span>
        {active && (
          <button className="btn-ghost btn-sm" onClick={() => setSearchParams({ q: '', subject: '', semester: '', year: '', type: '', department: '', programme: '', sort: '' })}>
            <LuRotateCcw /> Clear filters
          </button>
        )}
      </div>

      {results.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="pyq-list">
          {results.map((r) => <PYQCard key={r.id} r={r} bookmarked={bookmarks.has(r.id)} />)}
        </div>
      ) : (
        <EmptyState
          title="No papers match these filters"
          body={all.length ? 'Try a different subject, semester or year, or clear the filters.' : 'No question papers have been published yet.'}
          action={active ? <button className="btn-outline" onClick={() => setSearchParams({ q: '', subject: '', semester: '', year: '', type: '', department: '', programme: '' })}>Clear filters</button> : undefined}
        />
      )}
    </div>
  );
}
