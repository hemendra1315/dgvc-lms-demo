import { useSyncExternalStore } from 'react';
import { LuCircleCheck, LuTriangleAlert, LuX } from 'react-icons/lu';

type Toast = { id: number; kind: 'ok' | 'error'; text: string };
let toasts: Toast[] = [];
const ls = new Set<() => void>();
const emit = () => ls.forEach((l) => l());
let n = 0;

export function toast(text: string, kind: Toast['kind'] = 'ok') {
  const id = ++n;
  toasts = [...toasts, { id, kind, text }];
  emit();
  setTimeout(() => dismiss(id), 3500);
}
function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function Toaster() {
  const list = useSyncExternalStore((l) => (ls.add(l), () => ls.delete(l)), () => toasts);
  return (
    <div className="fixed z-[60] bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 flex flex-col gap-2 w-[min(92vw,420px)]" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className="card shadow-lg flex items-start gap-3 px-4 py-3 text-sm" data-testid="toast">
          {t.kind === 'ok' ? <LuCircleCheck className="text-ok mt-0.5 shrink-0" /> : <LuTriangleAlert className="text-bad mt-0.5 shrink-0" />}
          <span className="flex-1">{t.text}</span>
          <button className="text-muted hover:text-ink cursor-pointer" onClick={() => dismiss(t.id)} aria-label="Dismiss"><LuX /></button>
        </div>
      ))}
    </div>
  );
}
