import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  ScrollView,
  Alert,
  StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Pdf from 'react-native-pdf';
import type { PdfRef } from 'react-native-pdf';
import { useLibraryStore } from '@/stores/libraryStore';
import { useHighlightStore } from '@/stores/highlightStore';
import { useNoteStore } from '@/stores/noteStore';
import { useBookmarkStore } from '@/stores/bookmarkStore';
import {
  isDocumentCached,
  getCachedDocumentPath,
  downloadAndCacheDocument,
} from '@/shared/lib/documentCache';
import {
  useChapterSummary,
  parseSummaryBullets,
} from '@/features/reader/hooks/useChapterSummary';
import {
  parseLocator,
  isPdfLocator,
  buildPdfLocator,
} from '@/features/reader/utils/parseLocator';
import { useReaderSession } from '@/features/reader/hooks/useReaderSession';
import { HighlightItem } from '@/features/highlights/components/HighlightItem';
import { analytics } from '@/shared/lib/analytics';
import { hapticLight, hapticSuccess } from '@/shared/lib/haptics';
import { showToast } from '@/shared/components/Toast';
import { colors } from '@/shared/theme/colors';
import { radius, iconSize } from '@/shared/theme/tokens';
import type { RootStackParamList } from '@/types';

type ReaderRoute = RouteProp<RootStackParamList, 'Reader'>;

const FLATLIST_CONFIG = {
  initialNumToRender: 8,
  maxToRenderPerBatch: 10,
  windowSize: 5,
  removeClippedSubviews: true,
};

const PROGRESS_DEBOUNCE_MS = 500;

function makeFileUrl(path: string): string {
  if (path.startsWith('file://')) return path;
  return `file://${path}`;
}

/**
 * PDF rendering via react-native-pdf. Pages render as bitmaps (no selectable
 * text layer), so — unlike EpubReaderScreen — highlights here mark a whole
 * page rather than a text range; see design.md Decision 1 in
 * openspec/changes/add-multi-format-documents for why, and
 * specs/pdf-document-support/spec.md for the resulting contract.
 */
export function PdfReaderScreen() {
  const route = useRoute<ReaderRoute>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { bookId } = route.params;
  const books = useLibraryStore((s) => s.books);
  const updateProgress = useLibraryStore((s) => s.updateProgress);
  const highlights = useHighlightStore((s) => s.highlights);
  const fetchHighlights = useHighlightStore((s) => s.fetchHighlights);
  const createHighlight = useHighlightStore((s) => s.createHighlight);
  const deleteHighlight = useHighlightStore((s) => s.deleteHighlight);
  const notes = useNoteStore((s) => s.notes);
  const fetchNotes = useNoteStore((s) => s.fetchNotes);
  const createNote = useNoteStore((s) => s.createNote);
  const deleteNote = useNoteStore((s) => s.deleteNote);
  const bookmarks = useBookmarkStore((s) => s.bookmarks);
  const fetchBookmarks = useBookmarkStore((s) => s.fetchBookmarks);
  const addBookmark = useBookmarkStore((s) => s.addBookmark);
  const removeBookmark = useBookmarkStore((s) => s.removeBookmark);
  const insets = useSafeAreaInsets();

  const [fileUri, setFileUri] = useState<string | null>(null);
  const [readerError, setReaderError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [showOverlay, setShowOverlay] = useState(false);
  const [showHighlights, setShowHighlights] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const pdfRef = useRef<PdfRef>(null);
  const progressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    loading: summaryLoading,
    error: summaryError,
    summary,
    fetchSummary,
    reset: resetSummary,
  } = useChapterSummary(bookId);

  const book = useMemo(() => books.find((b) => b.id === bookId), [books, bookId]);

  useReaderSession(bookId);

  useEffect(() => {
    if (!book) {
      navigation.goBack();
    }
  }, [book, navigation]);

  useEffect(() => {
    fetchHighlights(bookId);
    fetchNotes(bookId);
    fetchBookmarks(bookId);

    (async () => {
      const cached = await isDocumentCached(bookId, 'pdf');
      let path: string | null = null;
      if (cached) {
        path = await getCachedDocumentPath(bookId, 'pdf');
      } else {
        try {
          path = await downloadAndCacheDocument(bookId, 'pdf');
        } catch (e) {
          if (__DEV__) console.error('Failed to download PDF:', e);
          setReaderError('Failed to download document');
          return;
        }
      }
      if (!path) {
        setReaderError('Document file not found');
        return;
      }

      const initialLocator = parseLocator(book?.progress_locator);
      if (initialLocator && isPdfLocator(initialLocator)) {
        setPage(initialLocator.page);
      }

      setFileUri(makeFileUrl(path));
    })();
  }, [bookId, fetchHighlights, fetchNotes, fetchBookmarks, book]);

  const persistProgress = useCallback(
    (nextPage: number, nextTotal: number) => {
      if (progressTimeoutRef.current) clearTimeout(progressTimeoutRef.current);
      progressTimeoutRef.current = setTimeout(() => {
        progressTimeoutRef.current = null;
        const percent = nextTotal > 0 ? Math.min(Math.round((nextPage / nextTotal) * 100), 100) : 0;
        updateProgress(bookId, percent, buildPdfLocator(nextPage, nextTotal), nextPage, nextTotal);
      }, PROGRESS_DEBOUNCE_MS);
    },
    [bookId, updateProgress],
  );

  useEffect(() => {
    return () => {
      if (progressTimeoutRef.current) clearTimeout(progressTimeoutRef.current);
    };
  }, []);

  const handleLoadComplete = useCallback((numberOfPages: number) => {
    setTotalPages(numberOfPages);
    setReady(true);
  }, []);

  const handlePageChanged = useCallback(
    (nextPage: number, numberOfPages: number) => {
      setPage(nextPage);
      setTotalPages(numberOfPages);
      persistProgress(nextPage, numberOfPages);
    },
    [persistProgress],
  );

  const handleError = useCallback((error: Error) => {
    if (__DEV__) console.error('PDF render error:', error);
    setReaderError('Failed to open document');
  }, []);

  const toggleOverlay = useCallback(() => {
    setShowOverlay((prev) => !prev);
    if (showHighlights) setShowHighlights(false);
  }, [showHighlights]);

  const pageHighlight = useMemo(
    () =>
      highlights.find((h) => {
        const locator = parseLocator(h.locator);
        return locator && isPdfLocator(locator) && locator.page === page;
      }),
    [highlights, page],
  );

  const handleToggleHighlight = useCallback(() => {
    if (pageHighlight) {
      deleteHighlight(bookId, pageHighlight.id)
        .then(() => {
          hapticLight();
          showToast('success', 'Highlight removed');
          analytics.trackEvent('highlight_deleted', { book_id: bookId });
        })
        .catch(() => showToast('error', 'Failed to remove highlight'));
      return;
    }

    createHighlight(bookId, `Page ${page}`, buildPdfLocator(page, totalPages), colors.highlightYellow)
      .then(() => {
        hapticSuccess();
        showToast('success', 'Page highlighted');
      })
      .catch((err: any) => showToast('error', 'Error', err.message));
  }, [pageHighlight, bookId, page, totalPages, deleteHighlight, createHighlight]);

  const handleAddBookmark = useCallback(async () => {
    try {
      await addBookmark(bookId, buildPdfLocator(page, totalPages), `Page ${page}`);
      hapticSuccess();
      showToast('success', 'Bookmark added');
    } catch {
      showToast('error', 'Failed to add bookmark');
    }
  }, [addBookmark, bookId, page, totalPages]);

  const goToLocator = useCallback((rawLocator: string, closePanels: () => void) => {
    const locator = parseLocator(rawLocator);
    if (!locator || !isPdfLocator(locator)) {
      showToast('error', 'Invalid location');
      return;
    }
    pdfRef.current?.setPage(locator.page);
    setPage(locator.page);
    closePanels();
  }, []);

  const handleGoToBookmark = useCallback(
    (rawLocator: string) => goToLocator(rawLocator, () => {
      setShowOverlay(false);
      setShowBookmarks(false);
    }),
    [goToLocator],
  );

  const handleGoToHighlight = useCallback(
    (rawLocator: string) => goToLocator(rawLocator, () => setShowHighlights(false)),
    [goToLocator],
  );

  const handleShowSummary = useCallback(() => {
    resetSummary();
    setShowOverlay(false);
    setShowSummary(true);
    // chapterIndex just needs to be a stable per-section cache key on the
    // backend (see ChapterSummary's bookId+chapterIndex uniqueness) — the
    // page number itself works fine for that. `href` carries the actual
    // section reference the backend dispatches on: a page number for PDFs.
    fetchSummary(page, String(page));
  }, [page, resetSummary, fetchSummary]);

  const handleDeleteHighlight = useCallback(
    (highlightId: string) => {
      hapticLight();
      Alert.alert('Delete highlight', 'Remove this highlight?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteHighlight(bookId, highlightId).catch(() =>
              showToast('error', 'Failed to delete highlight'),
            );
            analytics.trackEvent('highlight_deleted', { book_id: bookId });
          },
        },
      ]);
    },
    [bookId, deleteHighlight],
  );

  const handleSaveNote = useCallback(
    async (highlightId: string, text: string) => {
      await createNote(bookId, text, highlightId);
      hapticLight();
      showToast('success', 'Note saved');
      analytics.trackEvent('note_created', { book_id: bookId });
    },
    [bookId, createNote],
  );

  const handleDeleteNote = useCallback(
    (noteId: string) => {
      hapticLight();
      Alert.alert('Delete note', 'Remove this note?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteNote(bookId, noteId);
            analytics.trackEvent('note_deleted', { book_id: bookId });
          },
        },
      ]);
    },
    [bookId, deleteNote],
  );

  const notesByHighlight = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const n of notes) {
      if (n.highlight_id) {
        if (!map[n.highlight_id]) map[n.highlight_id] = [];
        map[n.highlight_id].push(n);
      }
    }
    return map;
  }, [notes]);

  const renderHighlightItem = useCallback(
    ({ item, index }: { item: any; index: number }) => (
      <TouchableOpacity onPress={() => handleGoToHighlight(item.locator)}>
        <HighlightItem
          item={item}
          index={index}
          notes={notesByHighlight[item.id] || []}
          onDelete={handleDeleteHighlight}
          onSaveNote={handleSaveNote}
          onDeleteNote={handleDeleteNote}
        />
      </TouchableOpacity>
    ),
    [notesByHighlight, handleDeleteHighlight, handleSaveNote, handleDeleteNote, handleGoToHighlight],
  );

  const renderBookmarkItem = useCallback(
    ({ item }: { item: typeof bookmarks[number] }) => (
      <TouchableOpacity
        style={styles.chapterItem}
        onPress={() => handleGoToBookmark(item.locator)}
        onLongPress={() => {
          Alert.alert('Delete bookmark', item.label || 'Remove this bookmark?', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => removeBookmark(bookId, item.id),
            },
          ]);
        }}
      >
        <Text style={styles.chapterLabel} numberOfLines={1}>
          {item.label || 'Bookmark'}
        </Text>
      </TouchableOpacity>
    ),
    [handleGoToBookmark, removeBookmark, bookId],
  );

  const panelPadding = useMemo(() => ({ paddingBottom: insets.bottom + 16 }), [insets.bottom]);
  const absoluteFillEnd = useMemo(
    () => ({ ...StyleSheet.absoluteFill, justifyContent: 'flex-end' as const }),
    [],
  );
  const captureResponder = useCallback(() => true, []);

  if (!book) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />

      {fileUri && (
        <Pdf
          ref={pdfRef}
          source={{ uri: fileUri }}
          page={page}
          style={styles.pdf}
          onLoadComplete={handleLoadComplete}
          onPageChanged={handlePageChanged}
          onError={handleError}
        />
      )}

      {ready && totalPages > 0 && (
        <View style={[styles.pageBadge, { bottom: insets.bottom + 8 }]}>
          <Text style={styles.badgeText}>
            Page {page} / {totalPages}
          </Text>
        </View>
      )}

      {ready && (
        <TouchableOpacity
          style={[styles.fab, { top: insets.top + 8 }]}
          onPress={toggleOverlay}
          activeOpacity={0.8}
        >
          <Icon name="dots-vertical" size={iconSize.md} color={colors.white} />
        </TouchableOpacity>
      )}

      {showOverlay && ready && (
        <View style={absoluteFillEnd}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowOverlay(false)}
          />
          <Animated.View
            entering={FadeIn.springify()}
            exiting={FadeOut}
            style={[styles.overlayPanel, panelPadding]}
            onStartShouldSetResponder={captureResponder}
          >
            <View style={styles.panelHandle} />

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={handleAddBookmark}>
                <Text style={styles.actionBtnIcon}>+</Text>
                <Text style={styles.actionBtnText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={handleToggleHighlight}>
                <Text style={styles.actionBtnText}>
                  {pageHighlight ? 'Unhighlight page' : 'Highlight page'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => setShowBookmarks(true)}>
                <Text style={styles.actionBtnText}>Bookmarks ({bookmarks.length})</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => setShowHighlights(true)}>
                <Text style={styles.actionBtnText}>Highlights ({highlights.length})</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.aiSummaryBtn} onPress={handleShowSummary}>
              <Icon name="auto-fix" size={iconSize.sm} color={colors.success} />
              <Text style={styles.aiSummaryBtnText}>AI Summary</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}

      {/* Bookmarks list */}
      {showBookmarks && (
        <View style={absoluteFillEnd}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowBookmarks(false)}
          />
          <Animated.View
            entering={FadeIn.springify()}
            exiting={FadeOut}
            style={[styles.chaptersPanel, panelPadding]}
            onStartShouldSetResponder={captureResponder}
          >
            <View style={styles.panelHandle} />
            <Text style={styles.chaptersTitle}>Bookmarks</Text>
            {bookmarks.length === 0 ? (
              <Text style={styles.noHighlights}>No bookmarks yet</Text>
            ) : (
              <FlatList
                data={bookmarks}
                keyExtractor={(b) => b.id}
                renderItem={renderBookmarkItem}
                style={styles.chaptersList}
              />
            )}
          </Animated.View>
        </View>
      )}

      {/* AI Summary */}
      {showSummary && (
        <View style={absoluteFillEnd}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowSummary(false)}
          />
          <Animated.View
            entering={FadeIn.springify()}
            exiting={FadeOut}
            style={[styles.summaryPanel, panelPadding]}
            onStartShouldSetResponder={captureResponder}
          >
            <View style={styles.panelHandle} />
            <View style={styles.summaryHeader}>
              <Icon name="auto-fix" size={iconSize.sm} color={colors.success} />
              <Text style={styles.chaptersTitle}>AI Summary</Text>
            </View>
            {summaryLoading && (
              <View style={styles.summaryLoading}>
                <ActivityIndicator color={colors.success} />
                <Text style={styles.noHighlights}>Generating summary…</Text>
              </View>
            )}
            {!summaryLoading && summaryError && (
              <Text style={styles.summaryError}>{summaryError}</Text>
            )}
            {!summaryLoading && !summaryError && summary && (
              <ScrollView style={styles.summaryScroll} showsVerticalScrollIndicator nestedScrollEnabled>
                {parseSummaryBullets(summary).map((bullet, i) => (
                  <View key={i} style={styles.summaryBulletRow}>
                    <Text style={styles.summaryBulletDot}>•</Text>
                    <Text style={styles.summaryBulletText}>{bullet}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </Animated.View>
        </View>
      )}

      {/* Highlights list */}
      {showHighlights && (
        <View
          style={[
            styles.highlightsPanel,
            { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 },
          ]}
        >
          <View style={styles.highlightsHeader}>
            <Text style={styles.highlightsTitle}>Highlights</Text>
            <TouchableOpacity onPress={() => setShowHighlights(false)}>
              <Text style={styles.highlightsCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
          {highlights.length === 0 ? (
            <Text style={styles.noHighlights}>Highlight a page to see it here</Text>
          ) : (
            <FlatList
              data={highlights}
              keyExtractor={(h) => h.id}
              renderItem={renderHighlightItem}
              contentContainerStyle={styles.highlightsList}
              initialNumToRender={FLATLIST_CONFIG.initialNumToRender}
              maxToRenderPerBatch={FLATLIST_CONFIG.maxToRenderPerBatch}
              windowSize={FLATLIST_CONFIG.windowSize}
              removeClippedSubviews={FLATLIST_CONFIG.removeClippedSubviews}
            />
          )}
        </View>
      )}

      {!ready && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingText}>Loading document...</Text>
          {readerError && <Text style={styles.errorText}>{readerError}</Text>}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  pdf: { flex: 1, width: '100%', height: '100%', backgroundColor: colors.bg },
  fab: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    zIndex: 999,
  },
  overlayPanel: {
    backgroundColor: colors.elevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 20,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  panelHandle: {
    width: 36,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 4,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-evenly',
    paddingTop: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
  },
  actionBtnIcon: { fontSize: 18, fontWeight: '500', color: colors.accent },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  aiSummaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 28,
    paddingVertical: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
  },
  aiSummaryBtnText: { fontSize: 14, fontWeight: '600', color: colors.success },
  highlightsPanel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg,
    paddingHorizontal: 20,
  },
  highlightsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  highlightsTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
  highlightsCloseText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  noHighlights: { color: colors.textMuted, fontSize: 15, textAlign: 'center', marginTop: 40 },
  highlightsList: { gap: 10, paddingBottom: 40 },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.bg,
  },
  loadingText: { color: colors.textSecondary, fontSize: 14 },
  errorText: {
    color: colors.destructive,
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginTop: 8,
  },
  pageBadge: {
    position: 'absolute',
    right: 16,
    zIndex: 999,
    elevation: 10,
  },
  badgeText: {
    color: 'rgba(0,0,0,0.7)',
    fontSize: 11,
    fontWeight: '400',
    backgroundColor: 'transparent',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.xs,
    overflow: 'hidden',
  },
  chaptersPanel: {
    backgroundColor: colors.elevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
    maxHeight: 300,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  summaryPanel: {
    backgroundColor: colors.elevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
    maxHeight: '75%',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  chaptersTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  chaptersList: { maxHeight: 200 },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  summaryLoading: { alignItems: 'center', paddingVertical: 24, gap: 12 },
  summaryError: { color: colors.error, fontSize: 14, textAlign: 'center', marginTop: 24, marginBottom: 8 },
  summaryScroll: { maxHeight: 750 },
  summaryBulletRow: { flexDirection: 'row', gap: 8, paddingVertical: 6 },
  summaryBulletDot: { color: colors.success, fontSize: 15, lineHeight: 21 },
  summaryBulletText: { flex: 1, color: colors.text, fontSize: 15, lineHeight: 21 },
  chapterItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  chapterLabel: { fontSize: 14, color: colors.textSecondary },
});
