import { useCallback, useState } from 'react';
import { api } from '@/shared/lib/api';

interface SummaryResponse {
  summary: string;
  cached: boolean;
}

export function parseSummaryBullets(summary: string): string[] {
  return summary
    .split('\n')
    .map((line) => line.replace(/^[\s•\-*]+|^\d+[.)]\s*/, '').trim())
    .filter(Boolean);
}

export function useChapterSummary(bookId: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const fetchSummary = useCallback(
    async (chapterIndex: number, href: string) => {
      setLoading(true);
      setError(null);
      setSummary(null);
      try {
        const data = await api.post<SummaryResponse>(
          `/api/books/${bookId}/${chapterIndex}/summary`,
          { href },
        );
        setSummary(data.summary);
      } catch (e: any) {
        setError(
          e.message ||
            'AI summary is temporarily unavailable. Please try again later.',
        );
      } finally {
        setLoading(false);
      }
    },
    [bookId],
  );

  const reset = useCallback(() => {
    setSummary(null);
    setError(null);
  }, []);

  return { loading, error, summary, fetchSummary, reset };
}
