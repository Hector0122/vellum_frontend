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
  updateProgress: (bookId: string, progress: number, cfi?: string, currentPage?: number, totalPages?: number) => Promise<void>;
  markAsRead: (bookId: string) => Promise<void>;
  updatePages: (bookId: string, currentPage: number, totalPages?: number) => Promise<void>;
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
          const localBooks = get().books;
          const merged = data.books.map((serverBook) => {
            const local = localBooks.find((b) => b.id === serverBook.id);
            if (local && local.last_opened_at && serverBook.last_opened_at &&
                new Date(local.last_opened_at) > new Date(serverBook.last_opened_at)) {
              return {
                ...serverBook,
                progress_percent: local.progress_percent ?? serverBook.progress_percent,
                progress_cfi: local.progress_cfi ?? serverBook.progress_cfi,
                current_page: local.current_page ?? serverBook.current_page,
                total_pages: local.total_pages ?? serverBook.total_pages,
                last_opened_at: local.last_opened_at,
                status: local.status ?? serverBook.status,
              };
            }
            return serverBook;
          });
          set({ books: merged, loading: false });
        } catch {
          // If fetch fails, keep existing persisted books in state
          set({ loading: false });
        }
      },

      deleteBook: async (bookId: string) => {
        const previous = get().books;
        set({ books: previous.filter((b) => b.id !== bookId) });

        try {
          await api.delete(`/api/books/${bookId}`);
        } catch (e) {
          if (isNetworkError(e)) {
            useSyncQueueStore.getState().add({
              type: 'DELETE_BOOK',
              payload: { bookId },
            });
          } else {
            set({ books: previous });
            throw e;
          }
        }
      },

      updateProgress: async (bookId: string, progress: number, cfi?: string, currentPage?: number, totalPages?: number) => {
        if (__DEV__) console.log('[libraryStore] updateProgress:', bookId, progress, cfi, currentPage, totalPages);

        const clamped = Math.min(progress, 100);
        const newStatus = clamped >= 100 ? 'read' : 'reading';

        // Optimistic update
        const { books } = get();
        set({
          books: books.map((b) =>
            b.id === bookId
              ? {
                  ...b,
                  progress_percent: clamped,
                  progress_cfi: cfi,
                  current_page: currentPage ?? b.current_page,
                  total_pages: totalPages ?? b.total_pages,
                  status: newStatus,
                  last_opened_at: new Date().toISOString(),
                }
              : b,
          ),
        });

        try {
          await api.patch<BookResponse>(`/api/books/${bookId}`, {
            progress_percent: clamped,
            progress_cfi: cfi ?? null,
            current_page: currentPage,
            total_pages: totalPages,
            status: newStatus,
            last_opened_at: new Date().toISOString(),
          });
        } catch (e) {
          if (__DEV__) console.warn('[libraryStore] PATCH failed, queued:', e);
          if (isNetworkError(e)) {
            useSyncQueueStore.getState().add({
              type: 'UPDATE_PROGRESS',
              payload: { bookId, progress, cfi, currentPage, totalPages },
            });
          }
        }
      },

      markAsRead: async (bookId: string) => {
        const { books } = get();
        set({
          books: books.map((b) =>
            b.id === bookId
              ? { ...b, status: 'read', progress_percent: 100, last_opened_at: new Date().toISOString() }
              : b,
          ),
        });

        try {
          await api.patch<BookResponse>(`/api/books/${bookId}`, {
            status: 'read',
            progress_percent: 100,
            last_opened_at: new Date().toISOString(),
          });
        } catch (e) {
          if (__DEV__) console.warn('[libraryStore] markAsRead PATCH failed:', e);
          if (isNetworkError(e)) {
            useSyncQueueStore.getState().add({
              type: 'UPDATE_PROGRESS',
              payload: { bookId, progress: 100 },
            });
          }
        }
      },

      updatePages: async (bookId: string, currentPage: number, totalPages?: number) => {
        const { books } = get();
        const book = books.find((b) => b.id === bookId);
        if (!book) return;

        const resolvedTotal = totalPages ?? book.total_pages ?? 0;
        const newProgress = resolvedTotal > 0
          ? Math.min(100, Math.round((currentPage / resolvedTotal) * 100))
          : book.progress_percent;
        const newStatus = newProgress >= 100 ? 'read' : book.status === 'read' ? 'read' : 'reading';

        set({
          books: books.map((b) =>
            b.id === bookId
              ? {
                  ...b,
                  current_page: currentPage,
                  total_pages: totalPages ?? b.total_pages,
                  progress_percent: newProgress,
                  status: newStatus,
                }
              : b,
          ),
        });

        try {
          await api.patch<BookResponse>(`/api/books/${bookId}`, {
            current_page: currentPage,
            total_pages: totalPages ?? null,
            progress_percent: newProgress,
            status: newStatus,
          });
        } catch (e) {
          if (__DEV__) console.warn('[libraryStore] updatePages PATCH failed:', e);
          if (isNetworkError(e)) {
            useSyncQueueStore.getState().add({
              type: 'UPDATE_PROGRESS',
              payload: { bookId, progress: newProgress, currentPage, totalPages },
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
