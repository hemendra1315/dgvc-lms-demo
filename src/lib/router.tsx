/** Minimal History-API router (supports direct navigation to every route). */
import { type AnchorHTMLAttributes, type MouseEvent, useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
if (typeof window !== 'undefined') window.addEventListener('popstate', notify);

export function navigate(to: string, opts: { replace?: boolean; keepScroll?: boolean } = {}) {
  if (to === location.pathname + location.search) return;
  history[opts.replace ? 'replaceState' : 'pushState'](null, '', to);
  if (!opts.keepScroll) window.scrollTo(0, 0);
  notify();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useLocation() {
  const href = useSyncExternalStore(subscribe, () => location.pathname + location.search);
  const url = new URL(href, 'http://local');
  return { pathname: url.pathname, search: url.searchParams, href };
}

/** Match "/pyq/:id" style patterns. Returns params or null. */
export function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean);
  const s = pathname.split('/').filter(Boolean);
  if (p.length !== s.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(s[i]);
    else if (p[i] !== s[i]) return null;
  }
  return params;
}

/** Update query-string parameters in place (replaces history entry). */
export function setSearchParams(updates: Record<string, string | number | undefined | null>) {
  const url = new URL(location.href);
  for (const [k, v] of Object.entries(updates)) {
    if (v === undefined || v === null || v === '') url.searchParams.delete(k);
    else url.searchParams.set(k, String(v));
  }
  navigate(url.pathname + url.search, { replace: true, keepScroll: true });
}

export function Link({ to, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  return (
    <a
      href={to}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate(to);
      }}
      {...rest}
    />
  );
}
