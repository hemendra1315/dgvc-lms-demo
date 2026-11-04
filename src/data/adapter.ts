/**
 * Local demo data adapter.
 *
 * Pure functions over DemoState: every mutation checks permissions and returns
 * a new state plus an audit entry. In this demo the checks run in the browser,
 * which is NOT secure — they model the rules that production enforces with
 * Supabase Row Level Security (see supabase/migrations).
 */
import type { DemoState, DemoUser, PyqFilters, PyqResource, ResourceStatus, SortKey } from './types';

export class PermissionError extends Error {
  constructor(message = 'You do not have permission to do that.') {
    super(message);
    this.name = 'PermissionError';
  }
}

const now = () => new Date().toISOString();
const rid = () => Math.random().toString(36).slice(2, 10);

/** Whether a user may manage (edit/publish/archive/delete/preview drafts of) a resource. */
export function canManage(user: DemoUser | null, r: PyqResource): boolean {
  if (!user) return false;
  switch (user.role) {
    case 'super_admin':
      return true;
    case 'department_admin':
      return !!user.department && r.department === user.department;
    case 'faculty':
      return !!user.assignedSubjects?.includes(r.subject_key);
    default:
      return false;
  }
}

/** Whether a user may open a resource at all. Students only see published papers. */
export function canView(user: DemoUser | null, r: PyqResource): boolean {
  if (!user) return false;
  if (r.status === 'published') return true;
  return canManage(user, r);
}

/** Resources a user can see in listings. Staff see only what they manage. */
export function visibleResources(state: DemoState, user: DemoUser | null): PyqResource[] {
  if (!user) return [];
  if (user.role === 'student') return state.resources.filter((r) => r.status === 'published');
  return state.resources.filter((r) => canManage(user, r));
}

export function filterResources(list: PyqResource[], f: PyqFilters): PyqResource[] {
  const q = f.q?.trim().toLowerCase();
  return list.filter((r) => {
    if (f.subject && r.subject_key !== f.subject) return false;
    if (f.semester && r.semester !== f.semester) return false;
    if (f.year && r.exam_year !== f.year) return false;
    if (f.examType && r.exam_type !== f.examType) return false;
    if (f.department && r.department !== f.department) return false;
    if (f.programme && r.programme !== f.programme) return false;
    if (f.status && f.status !== 'all' && r.status !== f.status) return false;
    if (q) {
      const hay = `${r.title} ${r.subject} ${r.subject_code} ${r.department} ${r.programme} ${r.exam_month} ${r.exam_year} ${r.exam_type}`.toLowerCase();
      if (!q.split(/\s+/).every((t) => hay.includes(t))) return false;
    }
    return true;
  });
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const examSortValue = (r: PyqResource) => r.exam_year * 100 + MONTHS.indexOf(r.exam_month);

export function sortResources(list: PyqResource[], sort: SortKey): PyqResource[] {
  const out = [...list];
  if (sort === 'az') out.sort((a, b) => a.title.localeCompare(b.title));
  else if (sort === 'oldest') out.sort((a, b) => examSortValue(a) - examSortValue(b) || a.subject.localeCompare(b.subject));
  else out.sort((a, b) => examSortValue(b) - examSortValue(a) || a.subject.localeCompare(b.subject));
  return out;
}

/** Distinct option values for filter dropdowns. */
export function facets(list: PyqResource[]) {
  const uniq = <T,>(xs: T[]) => [...new Set(xs)];
  return {
    subjects: uniq(list.map((r) => r.subject_key))
      .map((key) => ({ key, name: list.find((r) => r.subject_key === key)!.subject }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    semesters: uniq(list.map((r) => r.semester)).sort((a, b) => a - b),
    years: uniq(list.map((r) => r.exam_year)).sort((a, b) => b - a),
    examTypes: uniq(list.map((r) => r.exam_type)).sort(),
    departments: uniq(list.map((r) => r.department)).sort(),
    programmes: uniq(list.map((r) => r.programme)).sort(),
  };
}

function audit(state: DemoState, user: DemoUser, action: string, entity: string, detail?: string): DemoState {
  const entry = { id: rid(), at: now(), actor: `${user.name} (${user.email})`, action, entity, detail };
  return { ...state, audit: [entry, ...state.audit].slice(0, 300) };
}

function requireManage(state: DemoState, user: DemoUser | null, id: string): PyqResource {
  const r = state.resources.find((x) => x.id === id);
  if (!r) throw new Error('Resource not found.');
  if (!user || !canManage(user, r)) throw new PermissionError();
  return r;
}

const STATUS_VERB: Record<ResourceStatus, string> = {
  published: 'Published resource',
  unpublished: 'Unpublished resource',
  archived: 'Archived resource',
  draft: 'Moved resource to draft',
};

export function setStatus(state: DemoState, user: DemoUser | null, id: string, status: ResourceStatus): DemoState {
  const r = requireManage(state, user, id);
  if (r.status === status) return state;
  const next = {
    ...state,
    resources: state.resources.map((x) => (x.id === id ? { ...x, status, updated_at: now() } : x)),
  };
  return audit(next, user!, STATUS_VERB[status], r.title, `${r.status} → ${status}`);
}

export type EditableFields = Pick<PyqResource,
  'title' | 'description' | 'subject' | 'subject_code' | 'department' | 'programme' | 'semester' | 'exam_year' | 'exam_month' | 'exam_type'>;

export function updateResource(state: DemoState, user: DemoUser | null, id: string, patch: Partial<EditableFields>): DemoState {
  const r = requireManage(state, user, id);
  const updated = { ...r, ...patch, updated_at: now() };
  // A department admin may not move a resource out of their department.
  if (!canManage(user, updated)) throw new PermissionError('That change would move the resource outside your permitted scope.');
  const changed = (Object.keys(patch) as (keyof EditableFields)[]).filter((k) => patch[k] !== r[k]);
  const next = { ...state, resources: state.resources.map((x) => (x.id === id ? updated : x)) };
  return audit(next, user!, 'Edited resource metadata', updated.title, changed.length ? `Changed: ${changed.join(', ')}` : 'No changes');
}

export function deleteResource(state: DemoState, user: DemoUser | null, id: string): DemoState {
  const r = requireManage(state, user, id);
  const strip = (m: Record<string, { id: string; at: string }[]>) =>
    Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.filter((i) => i.id !== id)]));
  const next: DemoState = {
    ...state,
    resources: state.resources.filter((x) => x.id !== id),
    bookmarks: Object.fromEntries(Object.entries(state.bookmarks).map(([k, v]) => [k, v.filter((b) => b !== id)])),
    downloads: strip(state.downloads),
    recent: strip(state.recent),
  };
  return audit(next, user!, 'Deleted resource', r.title);
}

// ---------------------------------------------------------------- student activity

export function toggleBookmark(state: DemoState, user: DemoUser | null, id: string): DemoState {
  if (!user) throw new PermissionError('Sign in to bookmark.');
  const r = state.resources.find((x) => x.id === id);
  if (!r || !canView(user, r)) throw new PermissionError();
  const mine = state.bookmarks[user.id] ?? [];
  const next = mine.includes(id) ? mine.filter((b) => b !== id) : [id, ...mine];
  return { ...state, bookmarks: { ...state.bookmarks, [user.id]: next } };
}

function pushActivity(map: Record<string, { id: string; at: string }[]>, userId: string, id: string, limit = 50) {
  const list = (map[userId] ?? []).filter((i) => i.id !== id);
  return { ...map, [userId]: [{ id, at: now() }, ...list].slice(0, limit) };
}

export function recordDownload(state: DemoState, user: DemoUser | null, id: string): DemoState {
  if (!user) return state;
  return { ...state, downloads: pushActivity(state.downloads, user.id, id) };
}

export function removeDownload(state: DemoState, user: DemoUser | null, id: string): DemoState {
  if (!user) return state;
  return { ...state, downloads: { ...state.downloads, [user.id]: (state.downloads[user.id] ?? []).filter((d) => d.id !== id) } };
}

export function recordOpen(state: DemoState, user: DemoUser | null, id: string): DemoState {
  if (!user) return state;
  return { ...state, recent: pushActivity(state.recent, user.id, id, 20) };
}

/** Join activity items with resources the user can still see (drops unpublished/deleted ones). */
export function activityResources(state: DemoState, user: DemoUser | null, items: { id: string; at: string }[] = []) {
  return items
    .map((i) => ({ ...i, resource: state.resources.find((r) => r.id === i.id) }))
    .filter((i): i is { id: string; at: string; resource: PyqResource } => !!i.resource && canView(user, i.resource));
}
