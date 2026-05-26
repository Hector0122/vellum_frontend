import { create } from 'zustand';
import { api } from '@/shared/lib/api';
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
  updateProgress: (bookId: string, progress: number) => Promise<void>;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  books: [],
  loading: false,

  fetchBooks: async () => {
    set({ loading: true });
    try {
      const data = await api.get<BooksResponse>('/api/books');
      set({ books: data.books, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  deleteBook: async (bookId: string) => {
    await api.delete(`/api/books/${bookId}`);
    const { books } = get();
    set({ books: books.filter((b) => b.id !== bookId) });
  },

  updateProgress: async (bookId: string, progress: number) => {
    await api.patch<BookResponse>(`/api/books/${bookId}`, {
      progress_percent: progress,
      last_opened_at: new Date().toISOString(),
    });

    const { books } = get();
    set({
      books: books.map((b) =>
        b.id === bookId ? { ...b, progress_percent: progress } : b,
      ),
    });
  },
}));
