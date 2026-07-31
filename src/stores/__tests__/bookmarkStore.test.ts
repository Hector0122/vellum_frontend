import { useBookmarkStore } from '../bookmarkStore';
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

describe('bookmarkStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useBookmarkStore.setState({ bookmarks: [], total: 0, loading: false });
    useSyncQueueStore.setState({ queue: [], isProcessing: false });
  });

  it('fetchBookmarks requests the given page and stores the total', async () => {
    mockedApi.get.mockResolvedValueOnce({ bookmarks: [], total: 5 });

    await useBookmarkStore.getState().fetchBookmarks('book-1', 20, 40);

    expect(mockedApi.get).toHaveBeenCalledWith(
      '/api/books/book-1/bookmarks?limit=20&offset=40',
    );
    expect(useBookmarkStore.getState().total).toBe(5);
  });

  describe('addBookmark', () => {
    it('queues for retry on network failure, keeping the optimistic entry', async () => {
      mockedApi.post.mockRejectedValueOnce(new Error('network request failed'));
      mockedIsNetworkError.mockReturnValueOnce(true);

      await useBookmarkStore.getState().addBookmark('book-1', '{"href":"ch1"}', 'My bookmark');

      expect(useBookmarkStore.getState().bookmarks).toHaveLength(1);
      expect(useSyncQueueStore.getState().queue[0]).toMatchObject({
        type: 'CREATE_BOOKMARK',
        payload: { bookId: 'book-1', locator: '{"href":"ch1"}', label: 'My bookmark' },
      });
    });

    it('removes the optimistic entry on a non-network error', async () => {
      mockedApi.post.mockRejectedValueOnce(new Error('bad request'));
      mockedIsNetworkError.mockReturnValueOnce(false);

      await expect(
        useBookmarkStore.getState().addBookmark('book-1', '{"href":"ch1"}'),
      ).rejects.toThrow('bad request');

      expect(useBookmarkStore.getState().bookmarks).toHaveLength(0);
    });
  });

  describe('removeBookmark', () => {
    const existing = {
      id: 'bm1',
      user_id: 'u1',
      book_id: 'book-1',
      locator: '{"href":"ch1"}',
      label: null,
      created_at: new Date().toISOString(),
    };

    it('reports a 404 (non-network error) by reverting and rethrowing', async () => {
      useBookmarkStore.setState({ bookmarks: [existing], total: 1 });
      mockedApi.delete.mockRejectedValueOnce(new Error('Bookmark not found'));
      mockedIsNetworkError.mockReturnValueOnce(false);

      await expect(
        useBookmarkStore.getState().removeBookmark('book-1', 'bm1'),
      ).rejects.toThrow('Bookmark not found');

      expect(useBookmarkStore.getState().bookmarks).toHaveLength(1);
    });
  });
});
