import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { api, isNetworkError } from '@/shared/lib/api';
import { useSyncQueueStore } from '@/stores/syncQueueStore';
import type { Highlight } from '@/types';

interface HighlightsResponse {
  highlights: Highlight[];
  total: number;
}

interface HighlightResponse {
  highlight: Highlight;
}

const PAGE_SIZE = 20;

function generateTempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

interface HighlightState {
  highlights: Highlight[];
  allHighlights: Highlight[];
  loading: boolean;
  allLoading: boolean;
  allPage: number;
  allHasMore: boolean;
  fetchHighlights: (bookId: string) => Promise<void>;
  fetchAllHighlights: (reset?: boolean) => Promise<void>;
  createHighlight: (bookId: string, text: string, locator: string, color?: string) => Promise<void>;
  deleteHighlight: (bookId: string, highlightId: string) => Promise<void>;
  replaceTempId: (tempId: string, realId: string) => void;
}

export const useHighlightStore = create<HighlightState>()(
  persist(
    (set, get) => ({
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

      createHighlight: async (bookId: string, text: string, locator: string, color = '#FFD700') => {
        const tempId = generateTempId();
        const optimistic: Highlight = {
          id: tempId,
          user_id: '', // unknown until sync
          book_id: bookId,
          text,
          locator,
          color,
          created_at: new Date().toISOString(),
        };

        set({ highlights: [...get().highlights, optimistic] });

        try {
          const data = await api.post<HighlightResponse>(`/api/books/${bookId}/highlights`, {
            text,
            locator,
            color,
          });
          set({
            highlights: get().highlights.map((h) =>
              h.id === tempId ? data.highlight : h,
            ),
          });
        } catch (e) {
          if (isNetworkError(e)) {
            useSyncQueueStore.getState().add({
              type: 'CREATE_HIGHLIGHT',
              payload: { bookId, text, locator, color, tempId },
            });
          } else {
            // Non-network error: remove optimistic highlight
            set({ highlights: get().highlights.filter((h) => h.id !== tempId) });
            throw e;
          }
        }
      },

      deleteHighlight: async (bookId: string, highlightId: string) => {
        const previousHighlights = get().highlights;
        const previousAll = get().allHighlights;

        set({
          highlights: previousHighlights.filter((h) => h.id !== highlightId),
          allHighlights: previousAll.filter((h) => h.id !== highlightId),
        });

        try {
          await api.delete(`/api/books/${bookId}/highlights/${highlightId}`);
        } catch (e) {
          if (isNetworkError(e)) {
            useSyncQueueStore.getState().add({
              type: 'DELETE_HIGHLIGHT',
              payload: { bookId, highlightId },
            });
          } else {
            // Revert on non-network error
            set({ highlights: previousHighlights, allHighlights: previousAll });
            throw e;
          }
        }
      },

      replaceTempId: (tempId: string, realId: string) => {
        set({
          highlights: get().highlights.map((h) =>
            h.id === tempId ? { ...h, id: realId } : h,
          ),
          allHighlights: get().allHighlights.map((h) =>
            h.id === tempId ? { ...h, id: realId } : h,
          ),
        });
      },
    }),
    {
      name: 'vellum-highlights',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
