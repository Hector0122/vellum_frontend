import { useLibraryStore } from '../libraryStore';
import { useSyncQueueStore } from '../syncQueueStore';
import { api, isNetworkError } from '@/shared/lib/api';
import type { Book } from '@/types';

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

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: 'book-1',
    user_id: 'user-1',
    title: 'Test Book',
    file_url: 'https://example.com/book.epub',
    file_type: 'epub',
    status: 'unread',
    genres: [],
    progress_percent: 0,
    current_page: 0,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('libraryStore.deleteBook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useLibraryStore.setState({ books: [makeBook()], loading: false });
    useSyncQueueStore.setState({ queue: [], isProcessing: false });
  });

  it('removes the book optimistically and deletes it on success', async () => {
    mockedApi.delete.mockResolvedValueOnce(undefined);

    await useLibraryStore.getState().deleteBook('book-1');

    expect(useLibraryStore.getState().books).toHaveLength(0);
    expect(mockedApi.delete).toHaveBeenCalledWith('/api/books/book-1');
  });

  it('keeps the optimistic removal and queues a retry on network failure', async () => {
    const networkError = new Error('Network request failed');
    mockedApi.delete.mockRejectedValueOnce(networkError);
    mockedIsNetworkError.mockReturnValueOnce(true);

    await useLibraryStore.getState().deleteBook('book-1');

    expect(useLibraryStore.getState().books).toHaveLength(0);
    expect(useSyncQueueStore.getState().queue).toHaveLength(1);
    expect(useSyncQueueStore.getState().queue[0]).toMatchObject({
      type: 'DELETE_BOOK',
      payload: { bookId: 'book-1' },
    });
  });

  it('reverts the removal and rethrows on a non-network error', async () => {
    const serverError = new Error('Book not found');
    mockedApi.delete.mockRejectedValueOnce(serverError);
    mockedIsNetworkError.mockReturnValueOnce(false);

    await expect(useLibraryStore.getState().deleteBook('book-1')).rejects.toThrow(
      'Book not found',
    );

    expect(useLibraryStore.getState().books).toHaveLength(1);
    expect(useSyncQueueStore.getState().queue).toHaveLength(0);
  });
});
