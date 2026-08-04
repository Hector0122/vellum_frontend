import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { Locator } from 'react-native-readium';
import type { Book } from '@/types';

interface UseLocatorPersistenceParams {
  bookId: string;
  book: Book | undefined;
  totalCount: number;
  updateProgress: (
    bookId: string,
    progress: number,
    locator: string,
    position: number,
    total: number,
  ) => Promise<void> | void;
}

interface PendingProgress {
  bookId: string;
  percent: number;
  locator: string;
  position: number;
  total: number;
}

/**
 * Tracks the reader's current Locator and debounces persisting reading
 * progress (percent + Locator JSON) back to the library store.
 */
export function useLocatorPersistence({
  bookId,
  book,
  totalCount,
  updateProgress,
}: UseLocatorPersistenceParams) {
  const currentLocatorRef = useRef<Locator | null>(null);
  const progressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingProgressRef = useRef<PendingProgress | null>(null);
  const updateProgressRef = useRef(updateProgress);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [overallProgress, setOverallProgress] = useState(0);

  useEffect(() => {
    updateProgressRef.current = updateProgress;
  }, [updateProgress]);

  // Saves whatever position change is still waiting on the debounce timer,
  // instead of letting it get silently dropped by clearTimeout. Called when
  // the reader unmounts (navigating away) and when the app is backgrounded
  // (home button / app switch) — both are "closing the app" from the
  // reader's point of view, and neither should lose the last page turn.
  const flushPendingProgress = useCallback(() => {
    if (progressTimeoutRef.current) {
      clearTimeout(progressTimeoutRef.current);
      progressTimeoutRef.current = null;
    }
    const pending = pendingProgressRef.current;
    if (pending) {
      pendingProgressRef.current = null;
      updateProgressRef.current(
        pending.bookId,
        pending.percent,
        pending.locator,
        pending.position,
        pending.total,
      );
    }
  }, []);

  useEffect(() => {
    return () => {
      flushPendingProgress();
    };
  }, [flushPendingProgress]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        flushPendingProgress();
      }
    });
    return () => sub.remove();
  }, [flushPendingProgress]);

  const handleLocationChange = useCallback(
    (locator: Locator) => {
      currentLocatorRef.current = locator;
      const position = locator.locations?.position ?? 0;
      const percent =
        totalCount > 0
          ? Math.min(Math.round((position / totalCount) * 100), 100)
          : locator.locations?.totalProgression
            ? Math.round(locator.locations.totalProgression * 100)
            : 0;

      setCurrentPosition(position);
      setOverallProgress(percent);

      if (book && totalCount > 0) {
        const locatorStr = JSON.stringify(locator);
        pendingProgressRef.current = {
          bookId,
          percent,
          locator: locatorStr,
          position,
          total: totalCount,
        };
        if (progressTimeoutRef.current) clearTimeout(progressTimeoutRef.current);
        progressTimeoutRef.current = setTimeout(() => {
          progressTimeoutRef.current = null;
          pendingProgressRef.current = null;
          updateProgressRef.current(bookId, percent, locatorStr, position, totalCount);
        }, 500);
      }
    },
    [book, bookId, totalCount],
  );

  return {
    currentLocatorRef,
    currentPosition,
    overallProgress,
    handleLocationChange,
  };
}
