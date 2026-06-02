import { api } from './api';

type EventName =
  | 'page_view'
  | 'book_open'
  | 'book_upload'
  | 'book_delete'
  | 'highlight_created'
  | 'highlight_deleted'
  | 'note_created'
  | 'note_deleted'
  | 'reader_open'
  | 'font_changed';

interface EventProperties {
  [key: string]: string | number | boolean | undefined;
}

const isDev = __DEV__;

async function trackEvent(name: EventName, properties?: EventProperties) {
  if (isDev) {
    console.log(`[Analytics] ${name}`, properties || '');
  }

  try {
    await api.post('/api/analytics/track', {
      event: name,
      properties: properties || {},
      timestamp: new Date().toISOString(),
    });
  } catch {
    // silently fail — analytics should never block UX
  }
}

function trackPageView(screenName: string) {
  trackEvent('page_view', { screen: screenName });
}

function trackBookOpen(bookId: string, bookTitle: string) {
  trackEvent('book_open', { book_id: bookId, book_title: bookTitle });
}

function trackHighlightCreated(bookId: string, color: string) {
  trackEvent('highlight_created', { book_id: bookId, color });
}

function trackReaderOpen(bookId: string) {
  trackEvent('reader_open', { book_id: bookId });
}

export const analytics = {
  trackEvent,
  trackPageView,
  trackBookOpen,
  trackHighlightCreated,
  trackReaderOpen,
};
