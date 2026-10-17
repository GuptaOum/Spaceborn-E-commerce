'use client';

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

const PREFIX = 'sb-draft:';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function read<T>(key: string, initial: T): T {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (raw === null) return initial;
    const stored = JSON.parse(raw) as T;
    // Fields added to a form after a draft was saved fall back to their initial values.
    return isPlainObject(initial) && isPlainObject(stored) ? ({ ...initial, ...stored } as T) : stored;
  } catch {
    return initial;
  }
}

/**
 * useState that survives a page refresh in this browser tab. Meant for input the user has not
 * sent yet. Stored in sessionStorage, so it never outlives the tab and is wiped on sign-out.
 *
 * The first render always uses `initial` (the server cannot see sessionStorage), and the saved
 * draft is applied right after mount. A `null` key turns persistence off. Changing the key loads
 * that key's draft, or `initial` if there is none.
 */
export function useDraft<T>(key: string | null, initial: T): [T, Dispatch<SetStateAction<T>>, () => void] {
  const [value, setValue] = useState<T>(initial);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const initialRef = useRef(initial);
  initialRef.current = initial;
  const skipWrite = useRef(false);

  useEffect(() => {
    if (key === null) return;
    setValue(read(key, initialRef.current));
    setLoadedKey(key);
  }, [key]);

  useEffect(() => {
    if (key === null || loadedKey !== key) return;
    if (skipWrite.current) {
      skipWrite.current = false;
      return;
    }
    try {
      sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      // Storage full or blocked: the form still works, it just won't survive a refresh.
    }
  }, [key, loadedKey, value]);

  const clear = useCallback(() => {
    if (key !== null) {
      try {
        sessionStorage.removeItem(PREFIX + key);
      } catch {
        // ignore
      }
      skipWrite.current = true;
    }
    setValue(initialRef.current);
  }, [key]);

  return [value, setValue, clear];
}

/** Removes every saved draft in this tab. Called on sign-out so the next user starts clean. */
export function clearDrafts(): void {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k?.startsWith(PREFIX)) sessionStorage.removeItem(k);
    }
  } catch {
    // ignore
  }
}
