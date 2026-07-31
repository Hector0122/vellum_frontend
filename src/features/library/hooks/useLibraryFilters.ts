import { useMemo, useState } from 'react';
import type { Book } from '@/types';

export type FilterMode = 'all' | 'reading' | 'unread' | 'read';
export type SortMode = 'last' | 'az' | 'progress' | 'added';

export const SORT_LABELS: Record<SortMode, string> = {
  last: 'Recent',
  az: 'A — Z',
  progress: 'Progress',
  added: 'Added',
};

/**
 * Local search/filter/sort over the library's book list. Pure client-side
 * filtering — the backend search endpoint is separate and unrelated.
 */
export function useLibraryFilters(books: Book[]) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>('reading');
  const [sort, setSort] = useState<SortMode>('last');

  const filtered = useMemo(() => {
    let result = [...books];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        b =>
          b.title.toLowerCase().includes(q) ||
          (b.author && b.author.toLowerCase().includes(q)),
      );
    }

    if (filter === 'reading') {
      result = result.filter(
        b => b.progress_percent > 0 && b.progress_percent < 100,
      );
    } else if (filter === 'unread') {
      result = result.filter(b => b.progress_percent === 0);
    } else if (filter === 'read') {
      result = result.filter(b => b.status === 'read');
    }

    switch (sort) {
      case 'az':
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'progress':
        result.sort((a, b) => b.progress_percent - a.progress_percent);
        break;
      case 'added':
        result.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        break;
      case 'last':
      default:
        result.sort(
          (a, b) =>
            new Date(b.last_opened_at || b.created_at).getTime() -
            new Date(a.last_opened_at || a.created_at).getTime(),
        );
        break;
    }

    return result;
  }, [books, search, filter, sort]);

  return { search, setSearch, filter, setFilter, sort, setSort, filtered };
}
