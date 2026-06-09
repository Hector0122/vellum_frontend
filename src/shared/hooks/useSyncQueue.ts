import { useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { api } from '@/shared/lib/api';
import { useSyncQueueStore, type SyncOperation } from '@/stores/syncQueueStore';
import { useLibraryStore } from '@/stores/libraryStore';
import { useHighlightStore } from '@/stores/highlightStore';
import { useBookmarkStore } from '@/stores/bookmarkStore';
import { useNoteStore } from '@/stores/noteStore';
import { showToast } from '@/shared/components/Toast';

const MAX_RETRIES = 3;

function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('network') ||
      msg.includes('fetch') ||
      msg.includes('timeout') ||
      msg.includes('failed to fetch') ||
      msg.includes('network request failed') ||
      msg.includes('internet') ||
      msg.includes('connection')
    );
  }
  return false;
}

async function processOperation(op: SyncOperation): Promise<boolean> {
  try {
    switch (op.type) {
      case 'UPDATE_PROGRESS': {
        const { bookId, progress, cfi, currentPage, totalPages } = op.payload as {
          bookId: string;
          progress: number;
          cfi?: string;
          currentPage?: number;
          totalPages?: number;
        };
        await api.patch(`/api/books/${bookId}`, {
          progress_percent: progress,
          progress_cfi: cfi ?? null,
          current_page: currentPage,
          total_pages: totalPages,
          last_opened_at: new Date().toISOString(),
        });
        return true;
      }

      case 'CREATE_HIGHLIGHT': {
        const { bookId, text, location, color, tempId } = op.payload as {
          bookId: string;
          text: string;
          location: string;
          color: string;
          tempId: string;
        };
        const data = await api.post<{ highlight: { id: string } }>(
          `/api/books/${bookId}/highlights`,
          { text, location, color },
        );
        // Replace temp id with real id in store
        useHighlightStore.getState().replaceTempId(tempId, data.highlight.id);
        return true;
      }

      case 'DELETE_HIGHLIGHT': {
        const { bookId, highlightId } = op.payload as {
          bookId: string;
          highlightId: string;
        };
        await api.delete(`/api/books/${bookId}/highlights/${highlightId}`);
        return true;
      }

      case 'CREATE_BOOKMARK': {
        const { bookId, cfi, label, tempId } = op.payload as {
          bookId: string;
          cfi: string;
          label?: string;
          tempId: string;
        };
        const data = await api.post<{ bookmark: { id: string } }>(
          `/api/books/${bookId}/bookmarks`,
          { cfi, label },
        );
        useBookmarkStore.getState().replaceTempId(tempId, data.bookmark.id);
        return true;
      }

      case 'DELETE_BOOKMARK': {
        const { bookId, bookmarkId } = op.payload as {
          bookId: string;
          bookmarkId: string;
        };
        await api.delete(`/api/books/${bookId}/bookmarks/${bookmarkId}`);
        return true;
      }

      case 'CREATE_NOTE': {
        const { bookId, content, highlightId, tempId } = op.payload as {
          bookId: string;
          content: string;
          highlightId?: string;
          tempId: string;
        };
        const data = await api.post<{ note: { id: string } }>(
          `/api/books/${bookId}/notes`,
          { content, highlight_id: highlightId || null },
        );
        useNoteStore.getState().replaceTempId(tempId, data.note.id);
        return true;
      }

      case 'DELETE_NOTE': {
        const { bookId, noteId } = op.payload as {
          bookId: string;
          noteId: string;
        };
        await api.delete(`/api/books/${bookId}/notes/${noteId}`);
        return true;
      }

      default:
        return false;
    }
  } catch (e) {
    if (isNetworkError(e)) {
      return false;
    }
    // Non-network error (e.g. 404, 500) — remove from queue to avoid infinite retry
    if (__DEV__) console.warn('[useSyncQueue] Non-network error, dropping op:', op.type, e);
    return true;
  }
}

export function useSyncQueue() {
  const { queue, isProcessing, remove, incrementRetry, setProcessing } =
    useSyncQueueStore();
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isConnected =
        state.isConnected && (state.type === 'wifi' || state.type === 'cellular');

      if (!isConnected) {
        wasOfflineRef.current = true;
        return;
      }

      // Came back online
      if (wasOfflineRef.current && queue.length > 0 && !isProcessing) {
        wasOfflineRef.current = false;
        processQueue();
      }
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.length, isProcessing]);

  async function processQueue() {
    if (isProcessing || queue.length === 0) return;

    setProcessing(true);
    let processed = 0;
    let failed = 0;

    for (const op of [...queue]) {
      if (op.retries >= MAX_RETRIES) {
        remove(op.id);
        failed++;
        continue;
      }

      const success = await processOperation(op);
      if (success) {
        remove(op.id);
        processed++;
      } else {
        incrementRetry(op.id);
        failed++;
      }
    }

    setProcessing(false);

    if (processed > 0) {
      showToast('success', `${processed} changes synced`);
    }
    if (failed > 0) {
      showToast('info', `${failed} changes pending`);
    }
  }
}
