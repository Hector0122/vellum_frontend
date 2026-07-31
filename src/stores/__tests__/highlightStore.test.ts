import { useHighlightStore } from '../highlightStore';
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

describe('highlightStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useHighlightStore.setState({
      highlights: [],
      allHighlights: [],
      loading: false,
      allLoading: false,
      allPage: 0,
      allHasMore: true,
    });
    useSyncQueueStore.setState({ queue: [], isProcessing: false });
  });

  describe('createHighlight', () => {
    it('adds an optimistic highlight then replaces it with the server result', async () => {
      mockedApi.post.mockResolvedValueOnce({
        highlight: {
          id: 'real-id',
          user_id: 'u1',
          book_id: 'book-1',
          text: 'quote',
          locator: 'loc',
          color: '#FFD700',
          created_at: new Date().toISOString(),
        },
      });

      await useHighlightStore.getState().createHighlight('book-1', 'quote', 'loc');

      const { highlights } = useHighlightStore.getState();
      expect(highlights).toHaveLength(1);
      expect(highlights[0].id).toBe('real-id');
    });

    it('queues for retry on network failure and keeps the optimistic entry', async () => {
      mockedApi.post.mockRejectedValueOnce(new Error('network request failed'));
      mockedIsNetworkError.mockReturnValueOnce(true);

      await useHighlightStore.getState().createHighlight('book-1', 'quote', 'loc');

      expect(useHighlightStore.getState().highlights).toHaveLength(1);
      expect(useSyncQueueStore.getState().queue).toHaveLength(1);
      expect(useSyncQueueStore.getState().queue[0].type).toBe('CREATE_HIGHLIGHT');
    });

    it('removes the optimistic entry on a non-network error', async () => {
      mockedApi.post.mockRejectedValueOnce(new Error('validation failed'));
      mockedIsNetworkError.mockReturnValueOnce(false);

      await expect(
        useHighlightStore.getState().createHighlight('book-1', 'quote', 'loc'),
      ).rejects.toThrow('validation failed');

      expect(useHighlightStore.getState().highlights).toHaveLength(0);
    });
  });

  describe('deleteHighlight', () => {
    const existing = {
      id: 'h1',
      user_id: 'u1',
      book_id: 'book-1',
      text: 'quote',
      locator: 'loc',
      color: '#FFD700',
      created_at: new Date().toISOString(),
    };

    it('removes optimistically and stays removed on success', async () => {
      useHighlightStore.setState({ highlights: [existing], allHighlights: [existing] });
      mockedApi.delete.mockResolvedValueOnce(undefined);

      await useHighlightStore.getState().deleteHighlight('book-1', 'h1');

      expect(useHighlightStore.getState().highlights).toHaveLength(0);
    });

    it('reverts on non-network error', async () => {
      useHighlightStore.setState({ highlights: [existing], allHighlights: [existing] });
      mockedApi.delete.mockRejectedValueOnce(new Error('Highlight not found'));
      mockedIsNetworkError.mockReturnValueOnce(false);

      await expect(
        useHighlightStore.getState().deleteHighlight('book-1', 'h1'),
      ).rejects.toThrow('Highlight not found');

      expect(useHighlightStore.getState().highlights).toHaveLength(1);
    });
  });
});
