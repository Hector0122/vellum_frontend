import { useNoteStore } from '../noteStore';
import { useSyncQueueStore } from '../syncQueueStore';
import { api, isNetworkError } from '@/shared/lib/api';

jest.mock('@/shared/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
  isNetworkError: jest.fn(),
}));

const mockedApi = api as jest.Mocked<typeof api>;
const mockedIsNetworkError = isNetworkError as jest.MockedFunction<
  typeof isNetworkError
>;

describe('noteStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useNoteStore.setState({
      notes: [],
      allNotes: [],
      loading: false,
      allLoading: false,
      allPage: 0,
      allHasMore: true,
    });
    useSyncQueueStore.setState({ queue: [], isProcessing: false });
  });

  describe('createNote', () => {
    it('queues for retry on network failure, keeping the optimistic entry', async () => {
      mockedApi.post.mockRejectedValueOnce(new Error('network request failed'));
      mockedIsNetworkError.mockReturnValueOnce(true);

      await useNoteStore.getState().createNote('book-1', 'thoughts', 'h1');

      expect(useNoteStore.getState().notes).toHaveLength(1);
      expect(useSyncQueueStore.getState().queue[0]).toMatchObject({
        type: 'CREATE_NOTE',
        payload: { bookId: 'book-1', content: 'thoughts', highlightId: 'h1' },
      });
    });
  });

  describe('deleteNote', () => {
    const existing = {
      id: 'n1',
      user_id: 'u1',
      book_id: 'book-1',
      highlight_id: null,
      content: 'thoughts',
      created_at: new Date().toISOString(),
    };

    it('removes optimistically and stays removed on success', async () => {
      useNoteStore.setState({ notes: [existing], allNotes: [existing] });
      mockedApi.delete.mockResolvedValueOnce(undefined);

      await useNoteStore.getState().deleteNote('book-1', 'n1');

      expect(useNoteStore.getState().notes).toHaveLength(0);
      expect(useNoteStore.getState().allNotes).toHaveLength(0);
    });

    it('reverts both notes and allNotes on a non-network error', async () => {
      useNoteStore.setState({ notes: [existing], allNotes: [existing] });
      mockedApi.delete.mockRejectedValueOnce(new Error('Note not found'));
      mockedIsNetworkError.mockReturnValueOnce(false);

      await expect(useNoteStore.getState().deleteNote('book-1', 'n1')).rejects.toThrow(
        'Note not found',
      );

      expect(useNoteStore.getState().notes).toHaveLength(1);
      expect(useNoteStore.getState().allNotes).toHaveLength(1);
    });
  });
});
