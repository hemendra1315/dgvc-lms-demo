import { useMemo, useState } from 'react';
import { LuArchive, LuArchiveRestore, LuEye, LuEyeOff, LuPencil, LuRotateCcw, LuSearch, LuSend, LuTrash2 } from 'react-icons/lu';
import { z } from 'zod';
import { facets, filterResources, sortResources, visibleResources } from '../../data/adapter';
import { useDemo, useSession } from '../../data/store';
import type { PyqResource, ResourceStatus } from '../../data/types';
import { actions } from '../../lib/actions';
import { formatBytes, ROMAN } from '../../lib/format';
import { Link, setSearchParams, useLocation } from '../../lib/router';
import { ConfirmationDialog, EmptyState, FilterDropdown, Modal, PageHeader, SampleBadge, StatusBadge } from '../../components/ui';

const STATUSES: ResourceStatus[] = ['published', 'unpublished', 'archived'];

export function AdminResources() {
  const s = useDemo((x) => x);
  const user = useSession()!;
  const { search } = useLocation();
  const mine = useMemo(() => visibleResources(s, user), [s, user]);
  const f = facets(mine);
  const [editing, setEditing] = useState<PyqResource | null>(null);
  const [deleting, setDeleting] = useState<PyqResource | null>(null);
  const [archiving, setArchiving] = useState<PyqResource | null>(null);

  const filters = {
    q: search.get('q') ?? '',
    status: (search.get('status') as ResourceStatus) ?? undefined,
    subject: search.get('subject') ?? undefined,
    department: search.get('department') ?? undefined,
    year: search.get('year') ? Number(search.get('year')) : undefined,
  };
  const rows = sortResources(filterResources(mine, filters), 'latest');

  const scope =
    user.role === 'super_admin' ? 'You can manage every resource.' :
    user.role === 'department_admin' ? `You can manage resources in ${user.department}.` :
    'You can manage resources for your assigned subjects only.';

  return (
    <div>
      <PageHeader
        title="Resource Management"
        subtitle={<>Question papers · {mine.length} in your scope. {scope}</>}
        actions={<button className="btn-outline" onClick={actions.resetDemo} title="Restore the initial sample papers"><LuRotateCcw /> Reset demo data</button>}
      />

      <div className="card p-3 sm:p-4 mb-4 grid grid-cols-2 md:grid-cols-5 gap-3">
        <label className="block col-span-2 md:col-span-1">
          <span className="label">Search</span>
          <span className="relative block">
            <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className="input pl-9" value={filters.q} placeholder="Title, code, year…" onChange={(e) => setSearchParams({ q: e.target.value })} data-testid="admin-search" />
          </span>
        </label>
        <FilterDropdown label="Status" value={filters.status} testId="admin-filter-status" options={STATUSES.map((x) => ({ value: x, label: x[0].toUpperCase() + x.slice(1) }))} onChange={(v) => setSearchParams({ status: v })} />
        <FilterDropdown label="Subject" value={filters.subject} options={f.subjects.map((x) => ({ value: x.key, label: x.name }))} onChange={(v) => setSearchParams({ subject: v })} />
        <FilterDropdown label="Department" value={filters.department} options={f.departments.map((x) => ({ value: x, label: x.replace('Department of ', '') }))} onChange={(v) => setSearchParams({ department: v })} />
        <FilterDropdown label="Exam year" value={filters.year} options={f.years.map((x) => ({ value: x, label: String(x) }))} onChange={(v) => setSearchParams({ year: v })} />
      </div>

      <div className="text-sm text-muted mb-2" data-testid="admin-count">{rows.length} resource{rows.length === 1 ? '' : 's'}</div>

      {rows.length === 0 ? (
        <EmptyState title="No resources match" body="Change the filters or reset the demo data." />
      ) : (
        <>
          {/* Desktop table */}
          <div className="card overflow-x-auto hidden md:block">
            <table className="w-full text-sm" data-testid="resource-table">
              <thead>
                <tr className="text-left text-xs text-muted border-b border-line">
                  <th className="font-medium px-4 py-3">Title</th>
                  <th className="font-medium px-3 py-3">Department</th>
                  <th className="font-medium px-3 py-3">Sem</th>
                  <th className="font-medium px-3 py-3">Exam</th>
                  <th className="font-medium px-3 py-3">File</th>
                  <th className="font-medium px-3 py-3">Status</th>
                  <th className="font-medium px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-hover/60" data-testid="resource-row" data-id={r.id}>
                    <td className="px-4 py-3 max-w-[280px]">
                      <div className="font-medium truncate">{r.title}</div>
                      <div className="text-xs text-muted flex items-center gap-1.5 mt-0.5">{r.subject_code} <SampleBadge className="h-5" /></div>
                    </td>
                    <td className="px-3 py-3 text-muted whitespace-nowrap">{r.department.replace('Department of ', '')}</td>
                    <td className="px-3 py-3 text-muted">{ROMAN[r.semester]}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{r.exam_month} {r.exam_year}<div className="text-xs text-muted">{r.exam_type.replace(' Examination', '')}</div></td>
                    <td className="px-3 py-3 text-muted whitespace-nowrap">{formatBytes(r.file_size)}</td>
                    <td className="px-3 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3"><RowActions r={r} onEdit={setEditing} onDelete={setDeleting} onArchive={setArchiving} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="card p-3.5" data-testid="resource-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-sm">{r.title}</div>
                    <div className="text-xs text-muted mt-0.5">{r.subject_code} · Sem {ROMAN[r.semester]} · {formatBytes(r.file_size)}</div>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                <div className="mt-3"><RowActions r={r} onEdit={setEditing} onDelete={setDeleting} onArchive={setArchiving} /></div>
              </div>
            ))}
          </div>
        </>
      )}

      {editing && <EditDialog r={editing} options={facets(s.resources)} onClose={() => setEditing(null)} />}
      <ConfirmationDialog
        open={!!archiving}
        title="Archive this paper?"
        confirmLabel="Archive"
        body={<>“{archiving?.title}” will be hidden from students and moved to Archived. You can restore it later.</>}
        onCancel={() => setArchiving(null)}
        onConfirm={() => { if (archiving) actions.setStatus(archiving, 'archived'); setArchiving(null); }}
      />
      <ConfirmationDialog
        open={!!deleting}
        danger
        title="Delete this paper?"
        confirmLabel="Delete permanently"
        body={<>
          <p>“{deleting?.title}” will be removed from the resource catalogue, along with students' bookmarks and download history for it. This cannot be undone.</p>
          <p className="text-xs text-muted mt-2">Demo note: the static PDF file stays in public/demo-pdfs/. Use “Reset demo data” to restore the record.</p>
        </>}
        onCancel={() => setDeleting(null)}
        onConfirm={() => { if (deleting) actions.remove(deleting); setDeleting(null); }}
      />
    </div>
  );
}

function RowActions({ r, onEdit, onDelete, onArchive }: { r: PyqResource; onEdit: (r: PyqResource) => void; onDelete: (r: PyqResource) => void; onArchive: (r: PyqResource) => void }) {
  return (
    <div className="flex items-center md:justify-end gap-1 flex-wrap">
      <Link to={`/admin/resources/${r.id}/preview`} className="btn-ghost btn-sm" data-testid="action-preview"><LuEye /> Preview</Link>
      {r.status === 'published' ? (
        <button className="btn-ghost btn-sm" onClick={() => actions.setStatus(r, 'unpublished')} data-testid="action-unpublish"><LuEyeOff /> Unpublish</button>
      ) : r.status !== 'archived' ? (
        <button className="btn-ghost btn-sm text-brand" onClick={() => actions.setStatus(r, 'published')} data-testid="action-publish"><LuSend /> Publish</button>
      ) : null}
      <button className="btn-ghost btn-sm" onClick={() => onEdit(r)} data-testid="action-edit"><LuPencil /> Edit</button>
      {r.status === 'archived' ? (
        <button className="btn-ghost btn-sm" onClick={() => actions.setStatus(r, 'unpublished')} data-testid="action-restore"><LuArchiveRestore /> Restore</button>
      ) : (
        <button className="btn-ghost btn-sm" onClick={() => onArchive(r)} data-testid="action-archive"><LuArchive /> Archive</button>
      )}
      <button className="btn-ghost btn-sm text-bad" onClick={() => onDelete(r)} aria-label={`Delete ${r.title}`} data-testid="action-delete"><LuTrash2 /> <span className="md:hidden">Delete</span></button>
    </div>
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const metaSchema = z.object({
  title: z.string().trim().min(5, 'Title must be at least 5 characters').max(140),
  description: z.string().trim().max(500, 'Keep the description under 500 characters'),
  subject: z.string().trim().min(2, 'Subject is required'),
  subject_code: z.string().trim().regex(/^[A-Z]{2,4}-[A-Z]\d{3}$/, 'Use the format ABC-C101'),
  department: z.string().min(1, 'Department is required'),
  programme: z.string().min(1, 'Programme is required'),
  semester: z.coerce.number().int().min(1).max(8),
  exam_year: z.coerce.number().int().min(2015, 'Year must be 2015 or later').max(new Date().getFullYear(), 'Year cannot be in the future'),
  exam_month: z.enum(MONTHS as [string, ...string[]]),
  exam_type: z.string().min(1),
});
type MetaForm = z.input<typeof metaSchema>;

function EditDialog({ r, options, onClose }: { r: PyqResource; options: ReturnType<typeof facets>; onClose: () => void }) {
  const [form, setForm] = useState<MetaForm>({
    title: r.title, description: r.description, subject: r.subject, subject_code: r.subject_code, department: r.department,
    programme: r.programme, semester: r.semester, exam_year: r.exam_year, exam_month: r.exam_month, exam_type: r.exam_type,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof MetaForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const err = (k: string) => errors[k] && <span className="text-xs text-bad mt-1 block">{errors[k]}</span>;

  const save = () => {
    const p = metaSchema.safeParse(form);
    if (!p.success) {
      setErrors(Object.fromEntries(Object.entries(p.error.flatten().fieldErrors).map(([k, v]) => [k, v?.[0] ?? 'Invalid'])));
      return;
    }
    if (actions.update(r, p.data)) onClose();
  };

  return (
    <Modal open wide onClose={onClose} title="Edit metadata" footer={<><button className="btn-outline" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save} data-testid="save-meta">Save changes</button></>}>
      <div className="grid sm:grid-cols-2 gap-4" data-testid="edit-form">
        <label className="sm:col-span-2 block"><span className="label">Title</span><input className="input" value={form.title} onChange={set('title')} data-testid="edit-title" />{err('title')}</label>
        <label className="sm:col-span-2 block"><span className="label">Description</span><textarea className="input h-20 py-2" value={form.description} onChange={set('description')} />{err('description')}</label>
        <label className="block"><span className="label">Subject</span><input className="input" value={form.subject} onChange={set('subject')} />{err('subject')}</label>
        <label className="block"><span className="label">Subject code</span><input className="input" value={form.subject_code} onChange={set('subject_code')} />{err('subject_code')}</label>
        <label className="block"><span className="label">Department</span>
          <select className="input select-chevron appearance-none" value={form.department} onChange={set('department')}>{options.departments.map((d) => <option key={d}>{d}</option>)}</select>{err('department')}</label>
        <label className="block"><span className="label">Programme</span>
          <select className="input select-chevron appearance-none" value={form.programme} onChange={set('programme')}>{options.programmes.map((d) => <option key={d}>{d}</option>)}</select>{err('programme')}</label>
        <label className="block"><span className="label">Semester</span>
          <select className="input select-chevron appearance-none" value={String(form.semester)} onChange={set('semester')}>{[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>Semester {ROMAN[n]}</option>)}</select></label>
        <label className="block"><span className="label">Exam type</span>
          <select className="input select-chevron appearance-none" value={form.exam_type} onChange={set('exam_type')}>{['End Semester Examination', 'Supplementary Examination', 'Internal Assessment'].map((t) => <option key={t}>{t}</option>)}</select></label>
        <label className="block"><span className="label">Exam month</span>
          <select className="input select-chevron appearance-none" value={form.exam_month} onChange={set('exam_month')}>{MONTHS.map((m) => <option key={m}>{m}</option>)}</select>{err('exam_month')}</label>
        <label className="block"><span className="label">Exam year</span><input className="input" inputMode="numeric" value={String(form.exam_year)} onChange={set('exam_year')} data-testid="edit-year" />{err('exam_year')}</label>
      </div>
      <p className="text-xs text-muted mt-4">The attached PDF ({r.file_name}) keeps its identity; only catalogue metadata changes.</p>
    </Modal>
  );
}
