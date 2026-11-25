import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { SearchMatch } from './types';
import {
  runSearch,
  clearHighlights,
  updateActiveHighlight,
  scrollToMatch,
} from './searchHighlighter';

export interface UseSearchOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  initialOpen?: boolean;
  debounceMs?: number;
  docDir?: 'ltr' | 'rtl';
}

export interface UseSearchResult {
  isOpen: boolean;
  query: string;
  currentIndex: number;
  totalMatches: number;
  caseSensitive: boolean;
  matches: SearchMatch[];
  openSearch: () => void;
  closeSearch: () => void;
  setQuery: (query: string) => void;
  nextMatch: () => void;
  prevMatch: () => void;
  toggleCaseSensitive: () => void;
  docDir?: 'ltr' | 'rtl';
}

export function useSearch({
  containerRef,
  initialOpen = false,
  debounceMs = 0,
  docDir = 'ltr',
}: UseSearchOptions): UseSearchResult {
  const [isOpen, setIsOpen] = useState<boolean>(initialOpen);
  const [query, setQueryState] = useState<string>('');
  const [effectiveQuery, setEffectiveQuery] = useState<string>('');
  const [caseSensitive, setCaseSensitive] = useState<boolean>(false);
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Run synchronous search pipeline in useLayoutEffect so React DOM commits
  // are finalized before indexing and painting highlights.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !effectiveQuery.trim()) {
      clearHighlights(container);
      setMatches([]);
      setCurrentIndex(0);
      return;
    }

    const { matches: found, activeTarget } = runSearch(container, effectiveQuery, {
      caseSensitive,
      activeIndex: 0,
    });
    setMatches(found);
    setCurrentIndex(0);

    if (activeTarget) {
      scrollToMatch(container, activeTarget);
    }
  }, [containerRef, effectiveQuery, caseSensitive]);

  const setQuery = useCallback(
    (newQuery: string) => {
      setQueryState(newQuery);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (debounceMs > 0) {
        debounceTimerRef.current = setTimeout(() => {
          setEffectiveQuery(newQuery);
        }, debounceMs);
      } else {
        setEffectiveQuery(newQuery);
      }
    },
    [debounceMs]
  );

  const toggleCaseSensitive = useCallback(() => {
    setCaseSensitive((prev) => !prev);
  }, []);

  const openSearch = useCallback(() => {
    setIsOpen(true);
    if (query.trim()) {
      setEffectiveQuery(query);
    }
  }, [query]);

  const closeSearch = useCallback(() => {
    setIsOpen(false);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    clearHighlights(containerRef.current);
    setQueryState('');
    setEffectiveQuery('');
    setMatches([]);
    setCurrentIndex(0);
  }, [containerRef]);

  const nextMatch = useCallback(() => {
    if (matches.length === 0) return;
    const next = (currentIndex + 1) % matches.length;
    updateActiveHighlight(containerRef.current, currentIndex, next, matches);
    setCurrentIndex(next);
  }, [containerRef, currentIndex, matches]);

  const prevMatch = useCallback(() => {
    if (matches.length === 0) return;
    const prev = (currentIndex - 1 + matches.length) % matches.length;
    updateActiveHighlight(containerRef.current, currentIndex, prev, matches);
    setCurrentIndex(prev);
  }, [containerRef, currentIndex, matches]);

  // Cleanup highlights on unmount
  useEffect(() => {
    const currentContainer = containerRef.current;
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      clearHighlights(currentContainer);
    };
  }, [containerRef]);

  return {
    isOpen,
    query,
    currentIndex,
    totalMatches: matches.length,
    caseSensitive,
    matches,
    openSearch,
    closeSearch,
    setQuery,
    nextMatch,
    prevMatch,
    toggleCaseSensitive,
    docDir,
  };
}
