import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useLibraryStore } from '@/stores/libraryStore';
import { useHighlightStore } from '@/stores/highlightStore';
import { useNoteStore } from '@/stores/noteStore';
import { useBookmarkStore } from '@/stores/bookmarkStore';
import { EpubReader } from '../components/EpubReader';
import type { EpubReaderHandle } from '../components/EpubReader';
import {
  isEpubCached,
  getCachedEpubBase64,
  downloadAndCache,
} from '@/shared/lib/epubCache';
import { useFontPrefs } from '@/shared/hooks/useFontPrefs';
import { useWarmPaper } from '@/shared/hooks/useWarmPaper';
import { HighlightItem } from '@/features/highlights/components/HighlightItem';
import { analytics } from '@/shared/lib/analytics';
import { hapticLight, hapticSuccess } from '@/shared/lib/haptics';
import { api } from '@/shared/lib/api';
import { showToast } from '@/shared/components/Toast';
import { useReadingStats } from '@/shared/hooks/useReadingStats';
import { colors } from '@/shared/theme/colors';
import type { RootStackParamList } from '@/types';

type ReaderRoute = RouteProp<RootStackParamList, 'Reader'>;

const HIGHLIGHT_COLORS = [
  { color: colors.highlightYellow, label: 'Yellow' },
  { color: colors.highlightGreen, label: 'Green' },
  { color: colors.highlightBlue, label: 'Blue' },
  { color: colors.highlightPink, label: 'Pink' },
  { color: colors.highlightOrange, label: 'Orange' },
];

const FLATLIST_CONFIG = {
  initialNumToRender: 8,
  maxToRenderPerBatch: 10,
  windowSize: 5,
  removeClippedSubviews: true,
};

export function ReaderScreen() {
  const route = useRoute<ReaderRoute>();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { bookId } = route.params;
  const { books, updateProgress } = useLibraryStore();
  const { highlights, fetchHighlights, createHighlight, deleteHighlight } =
    useHighlightStore();
  const { notes, fetchNotes, createNote, deleteNote } = useNoteStore();
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [showHighlights, setShowHighlights] = useState(false);
  const [readerError, setReaderError] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ cfiRange: string; text: string } | null>(null);
  const [creatingHighlight, setCreatingHighlight] = useState(false);
  const [cachedData, setCachedData] = useState<string | null | undefined>(undefined);
  const [toc, setToc] = useState<{ label: string; href: string; depth: number }[]>([]);
  const [showChapters, setShowChapters] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [chapterWords, setChapterWords] = useState(0);
  const [chapterPct, setChapterPct] = useState(0);
  const [overallProgress, setOverallProgress] = useState(0);
  const [totalChapters, setTotalChapters] = useState(0);
  const [wpm, setWpm] = useState(200);
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const currentChapterIndexRef = useRef(0);
  const epubRef = useRef<EpubReaderHandle>(null);
  const currentCfiRef = useRef('');
  const chapterWordsRef = useRef(0);
  const lastChapterWordsRef = useRef(0);
  const totalBookWordsRef = useRef(0);
  const chaptersSeenRef = useRef(new Set<number>());
  const chapterStartTimeRef = useRef(Date.now());
  const lastChapterIndexRef = useRef(-1);
  const {
    fontSize,
    fontFamily,
    increaseSize,
    decreaseSize,
    cycleFont,
    fontLabel,
  } = useFontPrefs();
  const { warmPaper, toggle: toggleWarmPaper } = useWarmPaper();
  const { startSession, endSession } = useReadingStats();
  const sessionIdRef = useRef<string | null>(null);
  const { bookmarks, fetchBookmarks, addBookmark, removeBookmark } =
    useBookmarkStore();

  const trackedIncrease = useCallback(() => {
    increaseSize();
    analytics.trackEvent('font_changed', { direction: 'increase' });
  }, [increaseSize]);

  const trackedDecrease = useCallback(() => {
    decreaseSize();
    analytics.trackEvent('font_changed', { direction: 'decrease' });
  }, [decreaseSize]);

  const trackedCycleFont = useCallback(() => {
    cycleFont();
    analytics.trackEvent('font_changed', { direction: 'cycle' });
  }, [cycleFont]);

  const book = books.find(b => b.id === bookId);

  useEffect(() => {
    if (!book) {
      navigation.goBack();
    }
  }, [book, navigation]);

  useEffect(() => {
    fetchHighlights(bookId);
    fetchNotes(bookId);

    (async () => {
      const cached = await isEpubCached(bookId);
      if (cached) {
        const b64 = await getCachedEpubBase64(bookId);
        setCachedData(b64);
      } else {
        try {
          const b64 = await downloadAndCache(bookId);
          setCachedData(b64);
        } catch {
          setCachedData(null);
        }
      }
    })();
  }, [bookId, fetchHighlights, fetchNotes]);

  useEffect(() => {
    analytics.trackReaderOpen(bookId);
    analytics.trackPageView('Reader');
  }, [bookId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = await startSession(bookId);
      if (!cancelled) sessionIdRef.current = id;
    })();
    return () => {
      cancelled = true;
      endSession(sessionIdRef.current, chapterWordsRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  const handleProgress = useCallback(
    (percent: number, cfi: string, chapPct: number, chapterIndex: number) => {
      currentCfiRef.current = cfi;
      setChapterPct(chapPct);
      setOverallProgress(percent);

      const prevIndex = lastChapterIndexRef.current;
      if (chapterIndex !== prevIndex && prevIndex !== -1) {
        const prevWords = lastChapterWordsRef.current;
        if (prevWords > 0) {
          const elapsedMin = (Date.now() - chapterStartTimeRef.current) / 60000;
          if (elapsedMin > 0.5 && elapsedMin < 120) {
            const actualWPM = Math.round(prevWords / elapsedMin);
            if (actualWPM > 50 && actualWPM < 1000) {
              setWpm(p => Math.round(p * 0.7 + actualWPM * 0.3));
            }
          }
        }
        chapterStartTimeRef.current = Date.now();
      }
      lastChapterIndexRef.current = chapterIndex;
      currentChapterIndexRef.current = chapterIndex;

      if (!chaptersSeenRef.current.has(chapterIndex)) {
        chaptersSeenRef.current.add(chapterIndex);
        totalBookWordsRef.current += chapterWordsRef.current;
      }

      if (book && percent >= 0) {
        updateProgress(book.id, percent, cfi || undefined);
      }
    },
    [book, updateProgress],
  );

  const handleReady = useCallback((totalCh: number) => {
    setReady(true);
    setTotalChapters(totalCh);
    fetchBookmarks(bookId);
  }, [fetchBookmarks, bookId]);

  const handleReaderError = useCallback((msg: string) => {
    setReaderError(msg);
  }, []);

  const handleToc = useCallback(
    (chapters: { label: string; href: string; depth: number }[]) => {
      if (__DEV__) console.log('[ReaderScreen] TOC received:', chapters.length);
      setToc(chapters);
    },
    [],
  );

  const handleWordCount = useCallback((words: number) => {
    if (chapterWordsRef.current > 0) {
      lastChapterWordsRef.current = chapterWordsRef.current;
    }
    setChapterWords(words);
    chapterWordsRef.current = words;
  }, []);

  const handleChapterText = useCallback(
    async (text: string) => {
      if (!text.trim()) {
        setSummarizing(false);
        showToast('error', 'No text found in chapter');
        return;
      }

      const chapterIndex = currentChapterIndexRef.current;
      try {
        const { summary: result, cached } = await api.post<{
          summary: string;
          cached: boolean;
        }>(`/api/books/${bookId}/${chapterIndex}/summary`, { text });

        setSummary(result);
        setShowSummary(true);
        setSummarizing(false);
        showToast(
          'success',
          cached ? 'Summary loaded from cache' : 'Summary created',
        );
      } catch (err: any) {
        setSummarizing(false);
        showToast('error', 'Summary failed', err.message);
      }
    },
    [bookId],
  );

  const handleSummarize = useCallback(() => {
    setSummarizing(true);
    setSummary(null);
    epubRef.current?.getChapterText();
  }, []);

  const handleAddBookmark = useCallback(async () => {
    if (!book) return;
    const cfi = currentCfiRef.current;
    if (!cfi) return;
    try {
      await addBookmark(book.id, cfi);
      hapticSuccess();
      showToast('success', 'Bookmark added');
    } catch {
      showToast('error', 'Failed to add bookmark');
    }
  }, [book, addBookmark]);

  const handleGoToCfi = useCallback((cfi: string) => {
    epubRef.current?.goToCfi(cfi);
    setShowOverlay(false);
    setShowBookmarks(false);
  }, []);

  const handleGoToChapter = useCallback((href: string) => {
    if (__DEV__)
      console.log(
        '[ReaderScreen] handleGoToChapter:',
        href,
        'ref:',
        !!epubRef.current,
      );
    epubRef.current?.goToChapter(href);
    setShowOverlay(false);
    setShowChapters(false);
  }, []);

  const toggleOverlay = useCallback(() => {
    if (selected) {
      setSelected(null);
      return;
    }
    setShowOverlay(prev => !prev);
    if (showHighlights) setShowHighlights(false);
  }, [showHighlights, selected]);

  const handleSelected = useCallback((cfiRange: string, text: string) => {
    setSelected({ cfiRange, text });
    setShowOverlay(true);
    setShowHighlights(false);
  }, []);

  const handleCreateHighlight = useCallback(
    async (color: string) => {
      if (!selected) return;
      setCreatingHighlight(true);
      try {
        await createHighlight(bookId, selected.text, selected.cfiRange, color);
        await fetchNotes(bookId);
        setSelected(null);
        hapticSuccess();
        showToast('success', 'Highlight created');
        analytics.trackHighlightCreated(bookId, color);
      } catch (err: any) {
        showToast('error', 'Error', err.message);
      } finally {
        setCreatingHighlight(false);
      }
    },
    [bookId, selected, createHighlight, fetchNotes],
  );

  const handleDeleteHighlight = useCallback(
    (highlightId: string) => {
      hapticLight();
      Alert.alert('Delete highlight', 'Remove this highlight?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteHighlight(bookId, highlightId);
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

  const highlightLocations = useMemo(
    () =>
      highlights.map(h => ({
        location: h.location,
        color: h.color,
      })),
    [highlights],
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

  const timeRemaining = useMemo(() => {
    if (chapterWords === 0) return { chapterMin: 0, totalMin: 0 };

    const remainingWords = Math.round(chapterWords * (1 - chapterPct));
    const chapterMin = Math.max(1, Math.round(remainingWords / wpm));

    let totalMin = 0;
    if (totalChapters > 0 && chaptersSeenRef.current.size > 0) {
      const avgWordsPerChapter = totalBookWordsRef.current / chaptersSeenRef.current.size;
      const estimatedTotalWords = avgWordsPerChapter * totalChapters;
      const remainingBookWords = Math.round(
        estimatedTotalWords * (1 - overallProgress / 100),
      );
      totalMin = Math.round(remainingBookWords / wpm);
    }

    return { chapterMin, totalMin };
  }, [chapterWords, chapterPct, wpm, totalChapters, overallProgress]);

  const renderHighlightItem = useCallback(
    ({ item, index }: { item: any; index: number }) => (
      <HighlightItem
        item={item}
        index={index}
        notes={notesByHighlight[item.id] || []}
        bookId={bookId}
        onDelete={handleDeleteHighlight}
        onSaveNote={handleSaveNote}
        onDeleteNote={handleDeleteNote}
      />
    ),
    [
      notesByHighlight,
      bookId,
      handleDeleteHighlight,
      handleSaveNote,
      handleDeleteNote,
    ],
  );

  if (!book) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <EpubReader
        ref={epubRef}
        bookId={book.id}
        initialCfi={book.progress_cfi}
        data={cachedData}
        fontSize={fontSize}
        fontFamily={fontFamily}
        warmPaper={warmPaper}
        highlights={highlightLocations}
        onProgress={handleProgress}
        onReady={handleReady}
        onError={handleReaderError}
        onTapped={toggleOverlay}
        onSelected={handleSelected}
        onToc={handleToc}
        onWordCount={handleWordCount}
        onChapterText={handleChapterText}
      />

      {ready && (
        <View style={[styles.timeBadge, { bottom: insets.bottom + 8 }]}>
          <Text style={styles.timeBadgeText}>
            {chapterWords > 0
              ? `~${timeRemaining.chapterMin}m in chap${
                  timeRemaining.totalMin > 0 &&
                  timeRemaining.totalMin > timeRemaining.chapterMin
                    ? ` · ~${
                        timeRemaining.totalMin >= 60
                          ? `${Math.floor(timeRemaining.totalMin / 60)}h ${timeRemaining.totalMin % 60}m`
                          : `${timeRemaining.totalMin}m`
                      } total`
                    : ''
                }`
              : 'Calculating...'}
          </Text>
        </View>
      )}

      {showOverlay && ready && (
        <View style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end' }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              setShowOverlay(false);
              setSelected(null);
            }}
          />
          <Animated.View
            entering={FadeIn.springify()}
            exiting={FadeOut}
            style={[styles.overlayPanel, { paddingBottom: insets.bottom + 16 }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.panelHandle} />

            {selected && (
              <View style={styles.pickerInline}>
                <Text style={styles.pickerText} numberOfLines={2}>
                  &quot;{selected.text}&quot;
                </Text>
                <View style={styles.pickerColors}>
                  {HIGHLIGHT_COLORS.map(c => (
                    <TouchableOpacity
                      key={c.color}
                      style={[styles.colorDot, { backgroundColor: c.color }]}
                      onPress={() => handleCreateHighlight(c.color)}
                      disabled={creatingHighlight}
                    />
                  ))}
                  <TouchableOpacity onPress={() => setSelected(null)}>
                    <Text style={styles.pickerCancelText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.fontRow}>
              <TouchableOpacity
                style={styles.fontBtn}
                onPress={trackedDecrease}
              >
                <Text style={styles.fontBtnText}>A−</Text>
              </TouchableOpacity>
              <Text style={styles.fontSizeLabel}>
                {Math.round(fontSize * 100)}%
              </Text>
              <TouchableOpacity
                style={styles.fontBtn}
                onPress={trackedIncrease}
              >
                <Text style={styles.fontBtnText}>A+</Text>
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.fontBtn}
                onPress={trackedCycleFont}
              >
                <Text style={styles.fontLabelText}>{fontLabel}</Text>
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity
                style={[styles.fontBtn, warmPaper && styles.warmActive]}
                onPress={() => {
                  toggleWarmPaper();
                  analytics.trackEvent('warm_paper_toggle', {
                    enabled: !warmPaper,
                  });
                }}
              >
                <Text
                  style={[
                    styles.fontLabelText,
                    warmPaper && styles.warmActiveText,
                  ]}
                >
                  Warm
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleAddBookmark}
              >
                <Text style={styles.actionBtnIcon}>+</Text>
                <Text style={styles.actionBtnText}>Save</Text>
              </TouchableOpacity>
              {toc.length > 0 && (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => setShowChapters(true)}
                >
                  <Text style={styles.actionBtnText}>Chapters</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => setShowBookmarks(true)}
              >
                <Text style={styles.actionBtnText}>
                  Bookmarks ({bookmarks.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, summarizing && styles.actionBtnDisabled]}
                onPress={handleSummarize}
                disabled={summarizing}
              >
                <Icon
                  name={summarizing ? 'loading' : 'auto-fix'}
                  size={16}
                  color={summarizing ? colors.textMuted : '#10B981'}
                />
                <Text
                  style={[
                    styles.actionBtnText,
                    { color: summarizing ? colors.textMuted : '#10B981' },
                  ]}
                >
                  {summarizing ? 'Summarizing...' : 'AI Summary'}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      )}

      {/* Chapters list */}
      {showChapters && toc.length > 0 && (
        <View style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end' }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowChapters(false)}
          />
          <Animated.View
            entering={FadeIn.springify()}
            exiting={FadeOut}
            style={[
              styles.chaptersPanel,
              { paddingBottom: insets.bottom + 16 },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.panelHandle} />
            <Text style={styles.chaptersTitle}>Chapters</Text>
            <FlatList
              data={toc}
              keyExtractor={(_, i) => String(i)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.chapterItem,
                    { paddingLeft: 16 + item.depth * 16 },
                  ]}
                  onPress={() => handleGoToChapter(item.href)}
                >
                  <Text style={styles.chapterLabel} numberOfLines={1}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
              style={styles.chaptersList}
            />
          </Animated.View>
        </View>
      )}

      {/* Bookmarks list */}
      {showBookmarks && (
        <View style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end' }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowBookmarks(false)}
          />
          <Animated.View
            entering={FadeIn.springify()}
            exiting={FadeOut}
            style={[
              styles.chaptersPanel,
              { paddingBottom: insets.bottom + 16 },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.panelHandle} />
            <Text style={styles.chaptersTitle}>Bookmarks</Text>
            {bookmarks.length === 0 ? (
              <Text style={styles.noHighlights}>No bookmarks yet</Text>
            ) : (
              <FlatList
                data={bookmarks}
                keyExtractor={b => b.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.chapterItem}
                    onPress={() => handleGoToCfi(item.cfi)}
                    onLongPress={() => {
                      Alert.alert(
                        'Delete bookmark',
                        item.label || 'Remove this bookmark?',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: () => removeBookmark(book.id, item.id),
                          },
                        ],
                      );
                    }}
                  >
                    <Text style={styles.chapterLabel} numberOfLines={1}>
                      {item.label || `Page ${bookmarks.indexOf(item) + 1}`}
                    </Text>
                  </TouchableOpacity>
                )}
                style={styles.chaptersList}
              />
            )}
          </Animated.View>
        </View>
      )}

      {/* AI Summary */}
      {showSummary && summary && (
        <View style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end' }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowSummary(false)}
          />
          <Animated.View
            entering={FadeIn.springify()}
            exiting={FadeOut}
            style={[
              styles.summaryPanel,
              { paddingBottom: insets.bottom + 16 },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.panelHandle} />
            <View style={styles.summaryHeader}>
              <Icon name="auto-fix" size={18} color="#10B981" />
              <Text style={styles.summaryTitle}>AI Summary</Text>
              <TouchableOpacity onPress={() => setShowSummary(false)}>
                <Icon name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.summaryText}>{summary}</Text>
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
            <TouchableOpacity
              onPress={() => {
                setShowHighlights(false);
              }}
            >
              <Text
                style={{
                  color: colors.accent,
                  fontSize: 15,
                  fontWeight: '600',
                }}
              >
                Close
              </Text>
            </TouchableOpacity>
          </View>
          {highlights.length === 0 ? (
            <Text style={styles.noHighlights}>
              Select text to create a highlight
            </Text>
          ) : (
            <FlatList
              data={highlights}
              keyExtractor={h => h.id}
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

      {/* Loading overlay */}
      {!ready && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingText}>Loading reader...</Text>
          {readerError && <Text style={styles.errorText}>{readerError}</Text>}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  overlayBackdrop: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    zIndex: 10,
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
  pickerInline: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginBottom: 8,
  },
  pickerText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontStyle: 'italic',
  },
  pickerColors: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fontRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  fontBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fontBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.white,
  },
  fontSizeLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    minWidth: 42,
    textAlign: 'center',
    fontWeight: '600',
  },
  fontLabelText: {
    fontSize: 12,
    color: colors.white,
    fontWeight: '600',
  },
  warmActive: {
    backgroundColor: colors.accent,
  },
  warmActiveText: {
    color: '#FFF8E7',
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
    marginHorizontal: 4,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  actionBtnIcon: {
    fontSize: 18,
    fontWeight: '500',
    color: colors.accent,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  summaryPanel: {
    backgroundColor: colors.elevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 12,
    maxHeight: 350,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
    flex: 1,
  },
  summaryText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    paddingBottom: 8,
  },
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
  highlightsTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.white,
  },
  noHighlights: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 40,
  },
  highlightsList: {
    gap: 10,
    paddingBottom: 40,
  },
  pickerContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  pickerTitle: {
    color: colors.textSecondary,
    fontSize: 13,
    fontStyle: 'italic',
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  pickerCancel: {
    marginLeft: 'auto',
  },
  pickerCancelText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.bg,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  errorText: {
    color: colors.destructive,
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginTop: 8,
  },
  timeBadge: {
    position: 'absolute',
    right: 16,
    zIndex: 999,
    elevation: 10,
  },
  timeBadgeText: {
    color: 'rgba(0,0,0,0.7)',
    fontSize: 11,
    fontWeight: '400',
    backgroundColor: 'transparent',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
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
  chaptersTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
  chaptersList: {
    maxHeight: 200,
  },
  chapterItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  chapterLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});
