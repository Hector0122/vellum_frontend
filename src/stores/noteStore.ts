import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { api, isNetworkError } from '@/shared/lib/api';
import { useSyncQueueStore } from '@/stores/syncQueueStore';
import type { Note } from '@/types';

interface NotesResponse {
  notes: Note[];
  total: number;
}

interface NoteResponse {
  note: Note;
}

const PAGE_SIZE = 20;

function generateTempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

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
  replaceTempId: (tempId: string, realId: string) => void;
}

export const useNoteStore = create<NoteState>()(
  persist(
    (set, get) => ({
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
        const tempId = generateTempId();
        const optimistic: Note = {
          id: tempId,
          user_id: '',
          book_id: bookId,
          highlight_id: highlightId || null,
          content,
          created_at: new Date().toISOString(),
        };

        set({
          notes: [...get().notes, optimistic],
          allNotes: [...get().allNotes, optimistic],
        });

        try {
          const data = await api.post<NoteResponse>(`/api/books/${bookId}/notes`, {
            content,
            highlight_id: highlightId || null,
          });
          set({
            notes: get().notes.map((n) => (n.id === tempId ? data.note : n)),
            allNotes: get().allNotes.map((n) => (n.id === tempId ? data.note : n)),
          });
        } catch (e) {
          if (isNetworkError(e)) {
            useSyncQueueStore.getState().add({
              type: 'CREATE_NOTE',
              payload: { bookId, content, highlightId, tempId },
            });
          } else {
            set({
              notes: get().notes.filter((n) => n.id !== tempId),
              allNotes: get().allNotes.filter((n) => n.id !== tempId),
            });
            throw e;
          }
        }
      },

      deleteNote: async (bookId: string, noteId: string) => {
        const previousNotes = get().notes;
        const previousAll = get().allNotes;

        set({
          notes: previousNotes.filter((n) => n.id !== noteId),
          allNotes: previousAll.filter((n) => n.id !== noteId),
        });

        try {
          await api.delete(`/api/books/${bookId}/notes/${noteId}`);
        } catch (e) {
          if (isNetworkError(e)) {
            useSyncQueueStore.getState().add({
              type: 'DELETE_NOTE',
              payload: { bookId, noteId },
            });
          } else {
            set({ notes: previousNotes, allNotes: previousAll });
            throw e;
          }
        }
      },

      replaceTempId: (tempId: string, realId: string) => {
        set({
          notes: get().notes.map((n) =>
            n.id === tempId ? { ...n, id: realId } : n,
          ),
          allNotes: get().allNotes.map((n) =>
            n.id === tempId ? { ...n, id: realId } : n,
          ),
        });
      },
    }),
    {
      name: 'vellum-notes',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
