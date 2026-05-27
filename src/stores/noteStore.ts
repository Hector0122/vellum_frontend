import { create } from 'zustand';
import { api } from '@/shared/lib/api';
import type { Note } from '@/types';

interface NotesResponse {
  notes: Note[];
  total: number;
}

interface NoteResponse {
  note: Note;
}

const PAGE_SIZE = 20;

interface NoteState {
  notes: Note[];
  allNotes: Note[];
  loading: boolean;
  allLoading: boolean;
  allPage: number;
  allHasMore: boolean;
  fetchNotes: (bookId: string) => Promise<void>;
  fetchAllNotes: (reset?: boolean) => Promise<void>;
  createNote: (bookId: string, content: string, highlightId?: string) => Promise<void>;
  deleteNote: (bookId: string, noteId: string) => Promise<void>;
}

export const useNoteStore = create<NoteState>((set, get) => ({
  notes: [],
  allNotes: [],
  loading: false,
  allLoading: false,
  allPage: 0,
  allHasMore: true,

  fetchNotes: async (bookId: string) => {
    set({ loading: true });
    try {
      const data = await api.get<NotesResponse>(`/api/books/${bookId}/notes`);
      set({ notes: data.notes, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  fetchAllNotes: async (reset = false) => {
    const { allLoading, allPage, allHasMore } = get();
    if (allLoading || (!allHasMore && !reset)) return;

    const page = reset ? 0 : allPage;
    set({ allLoading: true });

    try {
      const data = await api.get<NotesResponse>(
        `/api/notes?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`,
      );
      const newNotes = reset
        ? data.notes
        : [...get().allNotes, ...data.notes];

      set({
        allNotes: newNotes,
        allLoading: false,
        allPage: page + 1,
        allHasMore: newNotes.length < data.total,
      });
    } catch {
      set({ allLoading: false });
    }
  },

  createNote: async (bookId: string, content: string, highlightId?: string) => {
    const data = await api.post<NoteResponse>(`/api/books/${bookId}/notes`, {
      content,
      highlight_id: highlightId || null,
    });
    set({
      notes: [...get().notes, data.note],
      allNotes: [...get().allNotes, data.note],
    });
  },

  deleteNote: async (bookId: string, noteId: string) => {
    await api.delete(`/api/books/${bookId}/notes/${noteId}`);
    const { notes, allNotes } = get();
    set({
      notes: notes.filter((n) => n.id !== noteId),
      allNotes: allNotes.filter((n) => n.id !== noteId),
    });
  },
}));
