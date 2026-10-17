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

export interface PagedLoaded<T> extends Loaded<T[]> {
  /** The last page came back full, so there may be more. */
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => Promise<void>;
}

/**
 * A list fetched a page at a time. The first page loads like `useLoad`; `loadMore` appends the
 * next one. Rows already on screen are skipped by `key`, so a row that moved pages is not doubled.
 */
export function usePagedLoad<T>(
  fetchPage: (offset: number, limit: number) => Promise<T[]>,
  deps: unknown[],
  pageSize: number,
  key: (row: T) => string | number,
): PagedLoaded<T> {
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const shown = useRef<T[] | null>(null);
  const loadedFor = useRef<string | null>(null);
  const depsKey = JSON.stringify(deps);
  const base = useLoad(async () => {
    const rows = await fetchPage(0, pageSize);
    // A refresh (polling, or after an action) renews the first page and keeps the pages the user
    // already opened, so the list does not shrink under them. New filters start from page one.
    const older = loadedFor.current === depsKey ? (shown.current ?? []).slice(pageSize) : [];
    loadedFor.current = depsKey;
    if (older.length === 0) setHasMore(rows.length >= pageSize);
    const fresh = new Set(rows.map(key));
    return [...rows, ...older.filter((r) => !fresh.has(key(r)))];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  const { data, mutate } = base;
  shown.current = data;
  const [moreError, setMoreError] = useState<string | null>(null);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const rows = await fetchPage(data?.length ?? 0, pageSize);
      setHasMore(rows.length >= pageSize);
      setMoreError(null);
      mutate((current) => {
        const seen = new Set((current ?? []).map(key));
        return [...(current ?? []), ...rows.filter((r) => !seen.has(key(r)))];
      });
    } catch (err) {
      setMoreError((err as Error).message);
    } finally {
      setLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.length, mutate, pageSize, ...deps]);

  return { ...base, error: base.error ?? moreError, hasMore, loadingMore, loadMore };
}
