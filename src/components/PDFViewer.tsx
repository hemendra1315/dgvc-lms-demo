import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LuArrowLeft, LuBookmark, LuBookmarkCheck, LuChevronLeft, LuChevronRight, LuDownload, LuFileX,
  LuLock, LuMaximize, LuMinimize, LuMoveHorizontal, LuRotateCcw, LuTriangleAlert, LuWifiOff, LuZoomIn, LuZoomOut,
} from 'react-icons/lu';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { cx } from '../lib/format';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; doc: PDFDocumentProxy }
  | { kind: 'error'; reason: 'missing' | 'failed' | 'offline' | 'denied'; message?: string };

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;
function loadPdfJs() {
  pdfjsPromise ??= import('pdfjs-dist').then((m) => {
    m.GlobalWorkerOptions.workerSrc = '/assets/pdf.worker.min.mjs';
    return m;
  });
  return pdfjsPromise;
}

export interface PDFViewerProps {
  url: string;
  title: string;
  subtitle?: string;
  denied?: boolean;
  bookmarked?: boolean;
  onBack: () => void;
  onDownload: () => void;
  onToggleBookmark?: () => void;
}

const MIN = 0.5, MAX = 3, STEP = 0.25;

export function PDFViewer({ url, title, subtitle, denied, bookmarked, onBack, onDownload, onToggleBookmark }: PDFViewerProps) {
  const [state, setState] = useState<LoadState>(denied ? { kind: 'error', reason: 'denied' } : { kind: 'loading' });
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [fit, setFit] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [isFull, setIsFull] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const taskRef = useRef<RenderTask | null>(null);

  // Load document
  useEffect(() => {
    if (denied) return;
    let cancelled = false;
    let task: { destroy: () => Promise<void> } | null = null;
    setState({ kind: 'loading' });
    setPage(1);
    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) {
          if (!cancelled) setState({ kind: 'error', reason: res.status === 404 ? 'missing' : res.status === 403 ? 'denied' : 'failed', message: `HTTP ${res.status}` });
          return;
        }
        const data = new Uint8Array(await res.arrayBuffer());
        const pdfjs = await loadPdfJs();
        const loading = pdfjs.getDocument({ data });
        task = loading;
        const doc = await loading.promise;
        if (!cancelled) setState({ kind: 'ready', doc });
      } catch (e) {
        if (!cancelled) setState({ kind: 'error', reason: navigator.onLine ? 'failed' : 'offline', message: (e as Error).message });
      }
    })();
    return () => {
      cancelled = true;
      taskRef.current?.cancel();
      // Destroying the loading task also tears down the document and its worker port.
      task?.destroy().catch(() => undefined);
    };
  }, [url, denied, attempt]);

  // Render current page
  const render = useCallback(async () => {
    if (state.kind !== 'ready' || !canvasRef.current || !stageRef.current) return;
    const pdfPage = await state.doc.getPage(page);
    const base = pdfPage.getViewport({ scale: 1 });
    // Fit width, but cap at a comfortable reading width on large screens.
    const available = Math.min(stageRef.current.clientWidth - 32, 920);
    const s = fit ? Math.max(MIN, Math.min(MAX, available / base.width)) : scale;
    if (fit && Math.abs(s - scale) > 0.001) setScale(s);
    const viewport = pdfPage.getViewport({ scale: s });
    const dpr = window.devicePixelRatio || 1;
    const canvas = canvasRef.current;
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;
    taskRef.current?.cancel();
    const task = pdfPage.render({ canvas, viewport, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined });
    taskRef.current = task;
    try {
      await task.promise;
      canvas.dataset.renderedPage = String(page);
    } catch {
      /* cancelled by a newer render */
    }
  }, [state, page, scale, fit]);

  useEffect(() => {
    render();
  }, [render]);

  useEffect(() => {
    if (!fit) return;
    const ro = new ResizeObserver(() => render());
    if (stageRef.current) ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, [fit, render]);

  useEffect(() => {
    const onFs = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const pages = state.kind === 'ready' ? state.doc.numPages : 0;
  const go = useCallback((p: number) => setPage((cur) => (pages ? Math.min(pages, Math.max(1, p)) : cur)), [pages]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') go(page + 1);
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(page - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, page]);

  const zoom = (d: number) => {
    setFit(false);
    setScale((s) => Math.min(MAX, Math.max(MIN, Math.round((s + d) * 100) / 100)));
  };
  const toggleFull = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await wrapRef.current?.requestFullscreen?.().catch(() => undefined);
  };

  const ready = state.kind === 'ready';

  return (
    <div ref={wrapRef} className="flex flex-col h-full bg-page" data-testid="pdf-viewer">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 sm:px-3 h-14 border-b border-line bg-card shrink-0">
        <button className="icon-btn" onClick={onBack} aria-label="Back"><LuArrowLeft /></button>
        <div className="min-w-0 flex-1 px-1">
          <div className="text-sm font-semibold truncate">{title}</div>
          {subtitle && <div className="text-[11px] text-muted truncate">{subtitle}</div>}
        </div>
        {onToggleBookmark && (
          <button className={cx('icon-btn', bookmarked && 'text-brand')} onClick={onToggleBookmark} aria-pressed={!!bookmarked}
            aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark'} data-testid="viewer-bookmark">
            {bookmarked ? <LuBookmarkCheck /> : <LuBookmark />}
          </button>
        )}
        <button className="icon-btn" onClick={onDownload} aria-label="Download PDF" data-testid="viewer-download" disabled={state.kind === 'error' && state.reason === 'denied'}>
          <LuDownload />
        </button>
        <button className="icon-btn" onClick={toggleFull} aria-label={isFull ? 'Exit full screen' : 'Full screen'}>
          {isFull ? <LuMinimize /> : <LuMaximize />}
        </button>
      </div>

      {/* Controls */}
      {ready && (
        <div className="flex items-center justify-between gap-1 px-1 sm:px-3 h-12 border-b border-line bg-card text-sm shrink-0">
          <div className="flex items-center gap-1">
            <button className="icon-btn h-9 w-9" onClick={() => go(page - 1)} disabled={page <= 1} aria-label="Previous page"><LuChevronLeft /></button>
            <label className="flex items-center gap-1.5">
              <span className="sr-only">Page</span>
              <input
                className="input h-8 w-12 text-center px-1"
                value={page}
                inputMode="numeric"
                aria-label="Page number"
                data-testid="page-input"
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!Number.isNaN(v)) go(v);
                }}
              />
              <span className="text-muted whitespace-nowrap" data-testid="page-count">/ {pages}</span>
            </label>
            <button className="icon-btn h-9 w-9" onClick={() => go(page + 1)} disabled={page >= pages} aria-label="Next page" data-testid="next-page"><LuChevronRight /></button>
          </div>
          <div className="flex items-center gap-1">
            <button className="icon-btn h-9 w-9" onClick={() => zoom(-STEP)} disabled={scale <= MIN} aria-label="Zoom out"><LuZoomOut /></button>
            <span className="w-10 sm:w-12 text-center tabular-nums text-muted text-xs" data-testid="zoom-level">{Math.round(scale * 100)}%</span>
            <button className="icon-btn h-9 w-9" onClick={() => zoom(STEP)} disabled={scale >= MAX} aria-label="Zoom in" data-testid="zoom-in"><LuZoomIn /></button>
            <button className={cx('btn-ghost btn-sm', fit && 'text-brand')} onClick={() => setFit(true)} aria-pressed={fit} title="Fit width">
              <LuMoveHorizontal /> <span className="hidden sm:inline">Fit width</span>
            </button>
          </div>
        </div>
      )}

      {/* Stage */}
      <div ref={stageRef} className="flex-1 overflow-auto bg-hover/60">
        {state.kind === 'loading' && (
          <div className="h-full min-h-[50vh] flex flex-col items-center justify-center gap-3 text-muted text-sm" data-testid="viewer-loading">
            <div className="h-8 w-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
            Loading document…
          </div>
        )}
        {state.kind === 'error' && <ViewerError reason={state.reason} message={state.message} onRetry={() => setAttempt((a) => a + 1)} onBack={onBack} />}
        <div className={cx('p-4 w-max min-w-full flex justify-center', !ready && 'hidden')}>
          <canvas ref={canvasRef} className="bg-white shadow-md rounded-sm" data-testid="pdf-canvas" aria-label={`${title}, page ${page}`} />
        </div>
      </div>
    </div>
  );
}

function ViewerError({ reason, message, onRetry, onBack }: { reason: 'missing' | 'failed' | 'offline' | 'denied'; message?: string; onRetry: () => void; onBack: () => void }) {
  const copy = {
    missing: { icon: <LuFileX />, title: 'Document not found', body: 'The PDF for this resource is missing on the server. An administrator has been notified in production; in the demo, re-run the paper generator.' },
    failed: { icon: <LuTriangleAlert />, title: 'Could not open this document', body: 'The file could not be loaded or is not a valid PDF.' },
    offline: { icon: <LuWifiOff />, title: 'You are offline', body: 'Connect to the internet to open this paper. Previously opened papers may be available from your browser cache.' },
    denied: { icon: <LuLock />, title: 'Not available', body: 'This resource is not published or you do not have permission to view it.' },
  }[reason];
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center text-center gap-2 px-6" data-testid={`viewer-error-${reason}`}>
      <div className="h-12 w-12 rounded-full bg-bad/10 text-bad flex items-center justify-center text-xl">{copy.icon}</div>
      <h2 className="font-semibold">{copy.title}</h2>
      <p className="text-sm text-muted max-w-sm">{copy.body}</p>
      {message && <p className="text-xs text-muted">{message}</p>}
      <div className="flex gap-2 mt-3">
        <button className="btn-outline" onClick={onBack}><LuArrowLeft /> Go back</button>
        {reason !== 'denied' && <button className="btn-primary" onClick={onRetry}><LuRotateCcw /> Try again</button>}
      </div>
    </div>
  );
}
