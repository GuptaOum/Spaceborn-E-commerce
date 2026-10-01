'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface Loaded<T> {
  data: T | null;
  error: string | null;
  /** True only while there is nothing to show yet (first load or after deps change). */
  loading: boolean;
  /** True while re-fetching behind existing data. */
  refreshing: boolean;
  /** Re-fetch, keeping the current data on screen until the new data arrives. */
  reload: () => Promise<void>;
  /** Alias of reload for call sites that want to spell out the intent. */
  refresh: () => Promise<void>;
  /** Update the data locally right away (optimistic UI). Pass a value or an updater. */
  mutate: (next: T | ((current: T | null) => T | null)) => void;
}

export function useLoad<T>(load: () => Promise<T>, deps: unknown[]): Loaded<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasData = useRef(false);
  const generation = useRef(0);
  const firstRun = useRef(true);

  const fetchNow = useCallback(async () => {
    const mine = ++generation.current;
    if (hasData.current) setRefreshing(true);
    else setLoading(true);
    try {
      const next = await load();
      if (mine !== generation.current) return; // a newer request superseded this one
      hasData.current = true;
      setData(next);
      setError(null);
    } catch (err) {
      if (mine !== generation.current) return;
      setError((err as Error).message);
    } finally {
      if (mine === generation.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    // Deps changed: the current data belongs to the old query, so show the loading state again.
    if (!firstRun.current) {
      hasData.current = false;
      setData(null);
    }
    firstRun.current = false;
    void fetchNow();
  }, [fetchNow]);

  const mutate = useCallback((next: T | ((current: T | null) => T | null)) => {
    setData((current) => {
      const value = typeof next === 'function' ? (next as (c: T | null) => T | null)(current) : next;
      hasData.current = value !== null;
      return value;
    });
  }, []);

  return { data, error, loading, refreshing, reload: fetchNow, refresh: fetchNow, mutate };
}
