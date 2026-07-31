import { useCallback, useEffect, useRef, useState } from 'react';
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
  const lastProgressRef = useRef<{ percent: number; locator: string } | null>(null);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [overallProgress, setOverallProgress] = useState(0);

  useEffect(() => {
    return () => {
      if (progressTimeoutRef.current) clearTimeout(progressTimeoutRef.current);
    };
  }, []);

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
        lastProgressRef.current = { percent, locator: locatorStr };
        if (progressTimeoutRef.current) clearTimeout(progressTimeoutRef.current);
        progressTimeoutRef.current = setTimeout(() => {
          updateProgress(bookId, percent, locatorStr, position, totalCount);
        }, 500);
      }
    },
    [book, bookId, totalCount, updateProgress],
  );

  return {
    currentLocatorRef,
    currentPosition,
    overallProgress,
    handleLocationChange,
  };
}
