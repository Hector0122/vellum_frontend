import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { api, isNetworkError } from '@/shared/lib/api';
import { useSyncQueueStore } from '@/stores/syncQueueStore';
import type { Book } from '@/types';

interface BooksResponse {
  books: Book[];
}

interface BookResponse {
  book: Book;
}

interface LibraryState {
  books: Book[];
  loading: boolean;
  fetchBooks: () => Promise<void>;
  deleteBook: (bookId: string) => Promise<void>;
  updateProgress: (bookId: string, progress: number, cfi?: string) => Promise<void>;
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      books: [],
      loading: false,

      fetchBooks: async () => {
        set({ loading: true });
        try {
          const data = await api.get<BooksResponse>('/api/books');
          set({ books: data.books, loading: false });
        } catch {
          // If fetch fails, keep existing persisted books in state
          set({ loading: false });
        }
      },

      deleteBook: async (bookId: string) => {
        await api.delete(`/api/books/${bookId}`);
        const { books } = get();
        set({ books: books.filter((b) => b.id !== bookId) });
      },

      updateProgress: async (bookId: string, progress: number, cfi?: string) => {
        if (__DEV__) console.log('[libraryStore] updateProgress:', bookId, progress, cfi);

        const newStatus = progress >= 100 ? 'read' : 'reading';

        // Optimistic update
        const { books } = get();
        set({
          books: books.map((b) =>
            b.id === bookId
              ? { ...b, progress_percent: progress, progress_cfi: cfi, status: newStatus, last_opened_at: new Date().toISOString() }
              : b,
          ),
        });

        try {
          await api.patch<BookResponse>(`/api/books/${bookId}`, {
            progress_percent: progress,
            progress_cfi: cfi ?? null,
            status: newStatus,
            last_opened_at: new Date().toISOString(),
          });
        } catch (e) {
          if (__DEV__) console.warn('[libraryStore] PATCH failed, queued:', e);
          if (isNetworkError(e)) {
            useSyncQueueStore.getState().add({
              type: 'UPDATE_PROGRESS',
              payload: { bookId, progress, cfi },
            });
          }
        }
      },
    }),
    {
      name: 'vellum-library',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
