import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { api, isNetworkError } from '@/shared/lib/api';
import { useSyncQueueStore } from '@/stores/syncQueueStore';

export interface Bookmark {
  id: string;
  user_id: string;
  book_id: string;
  cfi: string; // Readium Locator JSON string (legacy epub.js CFI values are not supported)
  label: string | null;
  created_at: string;
}

function generateTempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

interface BookmarkState {
  bookmarks: Bookmark[];
  total: number;
  loading: boolean;
  fetchBookmarks: (bookId: string, limit?: number, offset?: number) => Promise<void>;
  addBookmark: (bookId: string, cfi: string, label?: string) => Promise<void>;
  removeBookmark: (bookId: string, bookmarkId: string) => Promise<void>;
  replaceTempId: (tempId: string, realId: string) => void;
}

export const useBookmarkStore = create<BookmarkState>()(
  persist(
    (set, get) => ({
      bookmarks: [],
      total: 0,
      loading: false,

      fetchBookmarks: async (bookId: string, limit = 100, offset = 0) => {
        set({ loading: true });
        try {
          const data = await api.get<{ bookmarks: Bookmark[]; total: number }>(
            `/api/books/${bookId}/bookmarks?limit=${limit}&offset=${offset}`,
          );
          set({ bookmarks: data.bookmarks, total: data.total, loading: false });
        } catch {
          set({ loading: false });
        }
      },

      addBookmark: async (bookId: string, cfi: string, label?: string) => {
        const tempId = generateTempId();
        const optimistic: Bookmark = {
          id: tempId,
          user_id: '',
          book_id: bookId,
          cfi,
          label: label || null,
          created_at: new Date().toISOString(),
        };

        set({ bookmarks: [...get().bookmarks, optimistic] });

        try {
          const data = await api.post<{ bookmark: Bookmark }>(
            '/api/books/' + bookId + '/bookmarks',
            { cfi, label },
          );
          set({
            bookmarks: get().bookmarks.map((b) =>
              b.id === tempId ? data.bookmark : b,
            ),
          });
        } catch (e) {
          if (isNetworkError(e)) {
            useSyncQueueStore.getState().add({
              type: 'CREATE_BOOKMARK',
              payload: { bookId, cfi, label, tempId },
            });
          } else {
            set({ bookmarks: get().bookmarks.filter((b) => b.id !== tempId) });
            throw e;
          }
        }
      },

      removeBookmark: async (bookId: string, bookmarkId: string) => {
        const previous = get().bookmarks;
        set({ bookmarks: previous.filter((b) => b.id !== bookmarkId) });

        try {
          await api.delete('/api/books/' + bookId + '/bookmarks/' + bookmarkId);
        } catch (e) {
          if (isNetworkError(e)) {
            useSyncQueueStore.getState().add({
              type: 'DELETE_BOOKMARK',
              payload: { bookId, bookmarkId },
            });
          } else {
            set({ bookmarks: previous });
            throw e;
          }
        }
      },

      replaceTempId: (tempId: string, realId: string) => {
        set({
          bookmarks: get().bookmarks.map((b) =>
            b.id === tempId ? { ...b, id: realId } : b,
          ),
        });
      },
    }),
    {
      name: 'vellum-bookmarks',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
