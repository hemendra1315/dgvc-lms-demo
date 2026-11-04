import { type ReactNode, useEffect, useRef } from 'react';
import { LuFileX, LuX } from 'react-icons/lu';
import type { ResourceStatus } from '../data/types';
import { cx } from '../lib/format';

export function StatusBadge({ status }: { status: ResourceStatus }) {
  const map: Record<ResourceStatus, string> = {
    published: 'bg-ok/10 text-ok border-ok/30',
    unpublished: 'bg-warn/10 text-warn border-warn/30',
    draft: 'bg-muted/10 text-muted border-muted/30',
    archived: 'bg-muted/10 text-muted border-line',
  };
  return (
    <span className={cx('inline-flex items-center h-6 px-2 rounded-md border text-[11px] font-semibold uppercase tracking-wide', map[status])}>
      {status}
    </span>
  );
}

export function SampleBadge({ className }: { className?: string }) {
  return (
    <span
      className={cx('inline-flex items-center h-6 px-2 rounded-md bg-bad/10 text-bad border border-bad/25 text-[11px] font-semibold tracking-wide', className)}
      title="Sample / AI-generated demo question paper — not an actual DGVC examination paper"
    >
      SAMPLE
    </span>
  );
}

export function DemoNotice({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-warn/30 bg-warn/10 text-[13px] leading-relaxed px-3.5 py-2.5 text-ink">
      {children}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center text-center px-6 py-12 gap-2" data-testid="empty-state">
      <div className="h-12 w-12 rounded-full bg-brand-soft text-brand flex items-center justify-center text-xl mb-1">{icon ?? <LuFileX />}</div>
      <h3 className="font-semibold">{title}</h3>
      {body && <p className="text-sm text-muted max-w-sm">{body}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card h-24 animate-pulse bg-hover" />
      ))}
    </div>
  );
}

export function FilterDropdown<T extends string | number>({
  label, value, options, onChange, allLabel = 'All', testId,
}: {
  label: string;
  value: T | undefined;
  options: { value: T; label: string }[];
  onChange: (v: T | undefined) => void;
  allLabel?: string;
  testId?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="label">{label}</span>
      <select
        className="input pr-8 appearance-none select-chevron"
        value={value === undefined ? '' : String(value)}
        data-testid={testId}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') return onChange(undefined);
          const opt = options.find((o) => String(o.value) === raw);
          onChange(opt?.value);
        }}
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

export function Modal({ open, onClose, title, children, footer, wide }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx('relative card w-full rounded-b-none sm:rounded-xl shadow-xl max-h-[92vh] flex flex-col', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}
      >
        <div className="flex items-center justify-between px-5 h-14 border-b border-line shrink-0">
          <h2 className="font-semibold">{title}</h2>
          <button className="icon-btn -mr-2" onClick={onClose} aria-label="Close"><LuX /></button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-line flex justify-end gap-2 shrink-0">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmationDialog({ open, title, body, confirmLabel, danger, onConfirm, onCancel }: {
  open: boolean; title: string; body: ReactNode; confirmLabel: string; danger?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <button className="btn-outline" onClick={onCancel}>Cancel</button>
          <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} data-testid="confirm-action">{confirmLabel}</button>
        </>
      }
    >
      <div className="text-sm text-ink leading-relaxed">{body}</div>
    </Modal>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function StatisticsCard({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: string; icon?: ReactNode }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between text-muted text-xs font-medium">
        <span>{label}</span>
        <span className="text-brand text-base">{icon}</span>
      </div>
      <div className="text-2xl font-semibold mt-1.5 tabular-nums">{value}</div>
      {hint && <div className="text-xs text-muted mt-0.5">{hint}</div>}
    </div>
  );
}

export function Logo({ compact, light }: { compact?: boolean; light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/icon.svg" alt="" className="h-8 w-8 rounded-lg" />
      {!compact && (
        <div className="leading-tight">
          <div className={cx('font-semibold text-[15px] tracking-tight', light ? 'text-white' : 'text-ink')}>DGVC LMS</div>
          <div className={cx('text-[11px]', light ? 'text-white/70' : 'text-muted')}>Learn. Explore. Excel.</div>
        </div>
      )}
    </div>
  );
}
