/** UI-facing actions: wrap adapter calls with the current session, persistence and toasts. */
import * as A from '../data/adapter';
import { findUser } from '../data/demoUsers';
import { store } from '../data/store';
import type { PyqResource, ResourceStatus } from '../data/types';
import { toast } from './toast';

const me = () => findUser(store.get().sessionUserId);

function run(fn: () => void, ok?: string) {
  try {
    fn();
    if (ok) toast(ok);
    return true;
  } catch (e) {
    toast(e instanceof Error ? e.message : 'Something went wrong.', 'error');
    return false;
  }
}

export const actions = {
  signIn(userId: string) {
    store.set((s) => ({ ...s, sessionUserId: userId }));
  },
  signOut() {
    store.set((s) => ({ ...s, sessionUserId: null }));
  },
  toggleBookmark(r: PyqResource) {
    let added = false;
    const ok = run(() => {
      store.set((s) => {
        const next = A.toggleBookmark(s, me(), r.id);
        added = (next.bookmarks[me()!.id] ?? []).includes(r.id);
        return next;
      });
    });
    if (ok) toast(added ? 'Added to bookmarks' : 'Removed from bookmarks');
  },
  recordOpen(id: string) {
    store.set((s) => A.recordOpen(s, me(), id));
  },
  removeDownload(id: string) {
    run(() => store.set((s) => A.removeDownload(s, me(), id)), 'Removed from downloads');
  },
  setStatus(r: PyqResource, status: ResourceStatus) {
    const verb = { published: 'Published', unpublished: 'Unpublished', archived: 'Archived', draft: 'Moved to draft' }[status];
    return run(() => store.set((s) => A.setStatus(s, me(), r.id, status)), `${verb}: ${r.title}`);
  },
  update(r: PyqResource, patch: Partial<A.EditableFields>) {
    return run(() => store.set((s) => A.updateResource(s, me(), r.id, patch)), 'Metadata saved');
  },
  remove(r: PyqResource) {
    return run(() => store.set((s) => A.deleteResource(s, me(), r.id)), `Deleted: ${r.title}`);
  },
  resetDemo() {
    store.reset();
    toast('Demo data restored to the initial sample set');
  },

  /** Fetch the PDF and save it with its proper filename. Fails loudly if the file is missing. */
  async download(r: PyqResource) {
    try {
      const res = await fetch(r.file_url);
      if (!res.ok) throw new Error(res.status === 404 ? 'The PDF file is missing on the server.' : `Download failed (${res.status}).`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = r.file_name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      store.set((s) => A.recordDownload(s, me(), r.id));
      toast(`Downloading ${r.file_name}`);
    } catch (e) {
      toast(navigator.onLine ? (e as Error).message : 'You are offline. Connect to download this paper.', 'error');
    }
  },
};
