import { create } from 'zustand';
import { api } from '@/shared/lib/api';

export interface Bookmark {
  id: string;
  user_id: string;
  book_id: string;
  cfi: string;
  label: string | null;
  created_at: string;
}

interface BookmarkState {
  bookmarks: Bookmark[];
  loading: boolean;
  fetchBookmarks: (bookId: string) => Promise<void>;
  addBookmark: (bookId: string, cfi: string, label?: string) => Promise<void>;
  removeBookmark: (bookId: string, bookmarkId: string) => Promise<void>;
}

export const useBookmarkStore = create<BookmarkState>((set, get) => ({
  bookmarks: [],
  loading: false,

  fetchBookmarks: async (bookId: string) => {
    set({ loading: true });
    try {
      const data = await api.get<{ bookmarks: Bookmark[] }>('/api/books/' + bookId + '/bookmarks');
      set({ bookmarks: data.bookmarks, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  addBookmark: async (bookId: string, cfi: string, label?: string) => {
    const data = await api.post<{ bookmark: Bookmark }>('/api/books/' + bookId + '/bookmarks', { cfi, label });
    set({ bookmarks: [...get().bookmarks, data.bookmark] });
  },

  removeBookmark: async (bookId: string, bookmarkId: string) => {
    await api.delete('/api/books/' + bookId + '/bookmarks/' + bookmarkId);
    set({ bookmarks: get().bookmarks.filter((b) => b.id !== bookmarkId) });
  },
}));
