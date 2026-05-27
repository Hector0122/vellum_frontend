import { create } from 'zustand';
import { api } from '@/shared/lib/api';
import type { Note } from '@/types';

interface NotesResponse {
  notes: Note[];
}

interface NoteResponse {
  note: Note;
}

interface NoteState {
  notes: Note[];
  allNotes: Note[];
  loading: boolean;
  fetchNotes: (bookId: string) => Promise<void>;
  fetchAllNotes: () => Promise<void>;
  createNote: (bookId: string, content: string, highlightId?: string) => Promise<void>;
  deleteNote: (bookId: string, noteId: string) => Promise<void>;
}

export const useNoteStore = create<NoteState>((set, get) => ({
  notes: [],
  allNotes: [],
  loading: false,

  fetchNotes: async (bookId: string) => {
    set({ loading: true });
    try {
      const data = await api.get<NotesResponse>(`/api/books/${bookId}/notes`);
      set({ notes: data.notes, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  fetchAllNotes: async () => {
    set({ loading: true });
    try {
      const data = await api.get<NotesResponse>('/api/notes');
      set({ allNotes: data.notes, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  createNote: async (bookId: string, content: string, highlightId?: string) => {
    const data = await api.post<NoteResponse>(`/api/books/${bookId}/notes`, {
      content,
      highlight_id: highlightId || null,
    });
    set({ notes: [...get().notes, data.note] });
    set({ allNotes: [...get().allNotes, data.note] });
  },

  deleteNote: async (bookId: string, noteId: string) => {
    await api.delete(`/api/books/${bookId}/notes/${noteId}`);
    set({ notes: get().notes.filter((n) => n.id !== noteId) });
    set({ allNotes: get().allNotes.filter((n) => n.id !== noteId) });
  },
}));
