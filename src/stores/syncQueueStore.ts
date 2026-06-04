import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type SyncOperationType =
  | 'UPDATE_PROGRESS'
  | 'CREATE_HIGHLIGHT'
  | 'DELETE_HIGHLIGHT'
  | 'CREATE_BOOKMARK'
  | 'DELETE_BOOKMARK'
  | 'CREATE_NOTE'
  | 'DELETE_NOTE';

export interface SyncOperation {
  id: string;
  type: SyncOperationType;
  payload: Record<string, unknown>;
  retries: number;
  createdAt: string;
}

interface SyncQueueState {
  queue: SyncOperation[];
  isProcessing: boolean;
  add: (op: Omit<SyncOperation, 'id' | 'retries' | 'createdAt'>) => void;
  remove: (id: string) => void;
  clear: () => void;
  setProcessing: (value: boolean) => void;
  incrementRetry: (id: string) => void;
}

function generateOpId(): string {
  return `op_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export const useSyncQueueStore = create<SyncQueueState>()(
  persist(
    (set, get) => ({
      queue: [],
      isProcessing: false,

      add: (op) => {
        const newOp: SyncOperation = {
          ...op,
          id: generateOpId(),
          retries: 0,
          createdAt: new Date().toISOString(),
        };
        set({ queue: [...get().queue, newOp] });
      },

      remove: (id) => {
        set({ queue: get().queue.filter((o) => o.id !== id) });
      },

      clear: () => set({ queue: [] }),

      setProcessing: (value) => set({ isProcessing: value }),

      incrementRetry: (id) => {
        set({
          queue: get().queue.map((o) =>
            o.id === id ? { ...o, retries: o.retries + 1 } : o,
          ),
        });
      },
    }),
    {
      name: 'vellum-sync-queue',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
