import { create } from 'zustand';
import { api } from '@/shared/lib/api';
import type { Highlight } from '@/types';

interface HighlightsResponse {
  highlights: Highlight[];
  total: number;
}

interface HighlightResponse {
  highlight: Highlight;
}

const PAGE_SIZE = 20;

interface HighlightState {
  highlights: Highlight[];
  allHighlights: Highlight[];
  loading: boolean;
  allLoading: boolean;
  allPage: number;
  allHasMore: boolean;
  fetchHighlights: (bookId: string) => Promise<void>;
  fetchAllHighlights: (reset?: boolean) => Promise<void>;
  createHighlight: (bookId: string, text: string, location: string, color?: string) => Promise<void>;
  deleteHighlight: (bookId: string, highlightId: string) => Promise<void>;
}

export const useHighlightStore = create<HighlightState>((set, get) => ({
  highlights: [],
  allHighlights: [],
  loading: false,
  allLoading: false,
  allPage: 0,
  allHasMore: true,

  fetchHighlights: async (bookId: string) => {
    set({ loading: true });
    try {
      const data = await api.get<HighlightsResponse>(`/api/books/${bookId}/highlights`);
      set({ highlights: data.highlights, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  fetchAllHighlights: async (reset = false) => {
    const { allLoading, allPage, allHasMore } = get();
    if (allLoading || (!allHasMore && !reset)) return;

    const page = reset ? 0 : allPage;
    set({ allLoading: true });

    try {
      const data = await api.get<HighlightsResponse>(
        `/api/highlights?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`,
      );
      const newHighlights = reset
        ? data.highlights
        : [...get().allHighlights, ...data.highlights];

      set({
        allHighlights: newHighlights,
        allLoading: false,
        allPage: page + 1,
        allHasMore: newHighlights.length < data.total,
      });
    } catch {
      set({ allLoading: false });
    }
  },

  createHighlight: async (bookId: string, text: string, location: string, color = '#FFD700') => {
    const data = await api.post<HighlightResponse>(`/api/books/${bookId}/highlights`, {
      text,
      location,
      color,
    });
    set({ highlights: [...get().highlights, data.highlight] });
  },

  deleteHighlight: async (bookId: string, highlightId: string) => {
    await api.delete(`/api/books/${bookId}/highlights/${highlightId}`);
    const { highlights, allHighlights } = get();
    set({
      highlights: highlights.filter((h) => h.id !== highlightId),
      allHighlights: allHighlights.filter((h) => h.id !== highlightId),
    });
  },
}));
