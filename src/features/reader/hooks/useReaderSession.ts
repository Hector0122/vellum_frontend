import { useEffect, useRef } from 'react';
import { analytics } from '@/shared/lib/analytics';
import { useReadingStats } from '@/shared/hooks/useReadingStats';

/**
 * Tracks reader-open analytics and the reading-stats session (start on mount,
 * end on unmount) for a book. Side-effect only — nothing to render with.
 */
export function useReaderSession(bookId: string) {
  const sessionIdRef = useRef<string | null>(null);
  const { startSession, endSession } = useReadingStats();

  useEffect(() => {
    analytics.trackReaderOpen(bookId);
    analytics.trackPageView('Reader');
  }, [bookId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = await startSession(bookId);
      if (!cancelled) sessionIdRef.current = id;
    })();
    return () => {
      cancelled = true;
      endSession(sessionIdRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);
}
