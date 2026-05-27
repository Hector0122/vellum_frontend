import { create } from 'zustand';
import { api } from '@/shared/lib/api';
import type { Highlight } from '@/types';

interface HighlightsResponse {
  highlights: Highlight[];
}

interface HighlightResponse {
  highlight: Highlight;
}

interface HighlightState {
  highlights: Highlight[];
  allHighlights: Highlight[];
  loading: boolean;
  fetchHighlights: (bookId: string) => Promise<void>;
  fetchAllHighlights: () => Promise<void>;
  createHighlight: (bookId: string, text: string, location: string, color?: string) => Promise<void>;
  deleteHighlight: (bookId: string, highlightId: string) => Promise<void>;
}

export const useHighlightStore = create<HighlightState>((set, get) => ({
  highlights: [],
  allHighlights: [],
  loading: false,

  fetchHighlights: async (bookId: string) => {
    set({ loading: true });
    try {
      const data = await api.get<HighlightsResponse>(`/api/books/${bookId}/highlights`);
      set({ highlights: data.highlights, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  fetchAllHighlights: async () => {
    set({ loading: true });
    try {
      const data = await api.get<HighlightsResponse>('/api/highlights');
      set({ allHighlights: data.highlights, loading: false });
    } catch {
      set({ loading: false });
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
    set({ highlights: get().highlights.filter((h) => h.id !== highlightId) });
  },
}));
