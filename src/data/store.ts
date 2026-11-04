/**
 * Tiny persisted store (useSyncExternalStore + localStorage).
 * Demo mode only: state lives in this browser and survives refreshes.
 */
import { useSyncExternalStore } from 'react';
import { findUser } from './demoUsers';
import { initialState, SEED_VERSION } from './seed';
import type { DemoState } from './types';

const KEY = 'dgvc-lms-demo-state';

function load(): DemoState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoState;
      if (parsed.version === SEED_VERSION) return parsed;
    }
  } catch {
    /* storage unavailable or corrupt: fall back to seed */
  }
  return initialState();
}

let state: DemoState = load();
const listeners = new Set<() => void>();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore quota / private mode */
  }
}

export const store = {
  get: () => state,
  set(next: DemoState | ((s: DemoState) => DemoState)) {
    state = typeof next === 'function' ? next(state) : next;
    save();
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  /** Restore the initial sample data (keeps the current session). */
  reset() {
    const session = state.sessionUserId;
    store.set({ ...initialState(), sessionUserId: session });
  },
};

// Keep multiple tabs in sync (e.g. admin in one tab, student in another).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      state = load();
      listeners.forEach((l) => l());
    }
  });
}

export function useDemo<T>(selector: (s: DemoState) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(state));
}

export const useSession = () => {
  const id = useDemo((s) => s.sessionUserId);
  return findUser(id);
};
