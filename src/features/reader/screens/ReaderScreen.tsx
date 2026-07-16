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
  StatusBar,
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
import { ReadiumView } from 'react-native-readium';
import type {
  ReadiumViewRef,
  Locator,
  File as ReadiumFile,
  PublicationReadyEvent,
  SelectionAction,
  SelectionActionEvent,
  DecorationActivatedEvent,
  Decoration,
  DecorationGroup,
  Preferences,
} from 'react-native-readium';
import { useLibraryStore } from '@/stores/libraryStore';
import { useHighlightStore } from '@/stores/highlightStore';
import { useNoteStore } from '@/stores/noteStore';
import { useBookmarkStore } from '@/stores/bookmarkStore';
import {
  isEpubCached,
  getCachedEpubPath,
  downloadAndCache,
} from '@/shared/lib/epubCache';
import { useFontPrefs } from '@/shared/hooks/useFontPrefs';
import { HighlightItem } from '@/features/highlights/components/HighlightItem';
import { analytics } from '@/shared/lib/analytics';
import { hapticLight, hapticSuccess } from '@/shared/lib/haptics';
import { showToast } from '@/shared/components/Toast';
import { useReadingStats } from '@/shared/hooks/useReadingStats';
import { colors } from '@/shared/theme/colors';
import type { RootStackParamList } from '@/types';

type ReaderRoute = RouteProp<RootStackParamList, 'Reader'>;

const THEME_MAP: Record<string, { label: string; backgroundColor: string; textColor: string }> = {
  light: { label: 'Light', backgroundColor: '#ffffff', textColor: '#000000' },
  sepia: { label: 'Sepia', backgroundColor: '#f4ecd8', textColor: '#5f4b32' },
  dark: { label: 'Dark', backgroundColor: '#000000', textColor: '#ffffff' },
};

const THEME_OPTIONS = Object.entries(THEME_MAP).map(([value, { label }]) => ({ label, value }));

const FLATLIST_CONFIG = {
  initialNumToRender: 8,
  maxToRenderPerBatch: 10,
  windowSize: 5,
  removeClippedSubviews: true,
};

const selectionActions: SelectionAction[] = [
  { id: 'highlight', label: 'Highlight' },
  { id: 'bookmark', label: 'Bookmark' },
];

function makeFileUrl(path: string): string {
  if (path.startsWith('file://')) return path;
  return `file://${path}`;
}

function flattenToc(
  items: any[],
  depth = 0,
): { href: string; label: string; depth: number }[] {
  return items.flatMap((item: any) => [
    { href: item.href, label: item.title || 'Chapter', depth },
    ...(item.children ? flattenToc(item.children, depth + 1) : []),
  ]);
}

export function ReaderScreen() {
  const route = useRoute<ReaderRoute>();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { bookId } = route.params;
  const books = useLibraryStore(s => s.books);
  const updateProgress = useLibraryStore(s => s.updateProgress);
  const highlights = useHighlightStore(s => s.highlights);
  const fetchHighlights = useHighlightStore(s => s.fetchHighlights);
  const createHighlight = useHighlightStore(s => s.createHighlight);
  const deleteHighlight = useHighlightStore(s => s.deleteHighlight);
  const notes = useNoteStore(s => s.notes);
  const fetchNotes = useNoteStore(s => s.fetchNotes);
  const createNote = useNoteStore(s => s.createNote);
  const deleteNote = useNoteStore(s => s.deleteNote);
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [showHighlights, setShowHighlights] = useState(false);
  const [readerError, setReaderError] = useState<string | null>(null);
  const [toc, setToc] = useState<{ label: string; href: string; depth: number }[]>([]);
  const [positions, setPositions] = useState<{ totalCount: number } | null>(null);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [overallProgress, setOverallProgress] = useState(0);
  const [file, setFile] = useState<ReadiumFile | null>(null);
  const [decorations, setDecorations] = useState<DecorationGroup[]>([]);
  const [theme, setTheme] = useState<string>('sepia');
  const [showChapters, setShowChapters] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);

  const readiumRef = useRef<ReadiumViewRef>(null);
  const currentLocatorRef = useRef<Locator | null>(null);
  const progressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastProgressRef = useRef<{ percent: number; locator: string } | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const {
    fontSize,
    fontFamily,
    increaseSize,
    decreaseSize,
    cycleFont,
    fontLabel,
    loaded: fontPrefsLoaded,
  } = useFontPrefs();
  const { startSession, endSession } = useReadingStats();
  const bookmarks = useBookmarkStore(s => s.bookmarks);
  const fetchBookmarks = useBookmarkStore(s => s.fetchBookmarks);
  const addBookmark = useBookmarkStore(s => s.addBookmark);
  const removeBookmark = useBookmarkStore(s => s.removeBookmark);

  const book = useMemo(() => books.find((b) => b.id === bookId), [books, bookId]);
  const captureResponder = useCallback(() => true, []);
  const absoluteFillEnd = useMemo(
    () => ({ ...StyleSheet.absoluteFill, justifyContent: 'flex-end' as const }),
    [],
  );
  const panelPadding = useMemo(
    () => ({ paddingBottom: insets.bottom + 16 }),
    [insets.bottom],
  );
  const pageBadgeStyle = useMemo(
    () => [styles.pageBadge, { bottom: insets.bottom + 8 }],
    [insets.bottom],
  );
  const timeBadgeLeftStyle = useMemo(
    () => [styles.timeBadgeLeft, { bottom: insets.bottom + 8 }],
    [insets.bottom],
  );

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
      let path: string | null = null;
      if (cached) {
        path = await getCachedEpubPath(bookId);
      } else {
        try {
          path = await downloadAndCache(bookId);
        } catch (e) {
          if (__DEV__) console.error('Failed to download book:', e);
          setReaderError('Failed to download book');
          return;
        }
      }
      if (!path) {
        setReaderError('Book file not found');
        return;
      }

      const initialLocation: Locator | undefined = book?.progress_cfi
        ? (() => {
            try {
              return JSON.parse(book.progress_cfi) as Locator;
            } catch {
              return undefined;
            }
          })()
        : undefined;

      setFile({ url: makeFileUrl(path), initialLocation });
    })();
  }, [bookId, fetchHighlights, fetchNotes, book]);

  useEffect(() => {
    analytics.trackReaderOpen(bookId);
    analytics.trackPageView('Reader');
  }, [bookId]);

  useEffect(() => {
    return () => {
      if (progressTimeoutRef.current) clearTimeout(progressTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = await startSession(bookId);
      if (!cancelled) sessionIdRef.current = id;
    })();
    return () => {
      cancelled = true;
      endSession(sessionIdRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  const handlePublicationReady = useCallback(
    (event: PublicationReadyEvent) => {
      setReady(true);
      setPositions({ totalCount: event.positions.length });
      fetchBookmarks(bookId);

      try {
        const flat = flattenToc(event.tableOfContents || []);
        setToc(flat);
      } catch {
        setToc([]);
      }

      const hlDecorations: Decoration[] = highlights
        .map((h) => {
          try {
            const locator = JSON.parse(h.location) as Locator;
            return {
              id: h.id,
              locator,
              style: { type: 'highlight' as const, tint: h.color },
            };
          } catch {
            return null;
          }
        })
        .filter(Boolean) as Decoration[];

      setDecorations([{ name: 'highlights', decorations: hlDecorations }]);
    },
    [fetchBookmarks, bookId, highlights],
  );

  const handleLocationChange = useCallback(
    (locator: Locator) => {
      currentLocatorRef.current = locator;
      const position = locator.locations?.position ?? 0;
      const total = positions?.totalCount ?? 0;
      const percent = total > 0
        ? Math.min(Math.round((position / total) * 100), 100)
        : locator.locations?.totalProgression
          ? Math.round(locator.locations.totalProgression * 100)
          : 0;

      setCurrentPosition(position);
      setOverallProgress(percent);

      if (book && total > 0) {
        const locatorStr = JSON.stringify(locator);
        lastProgressRef.current = { percent, locator: locatorStr };
        if (progressTimeoutRef.current) clearTimeout(progressTimeoutRef.current);
        progressTimeoutRef.current = setTimeout(() => {
          updateProgress(bookId, percent, locatorStr, position, total);
        }, 500);
      }
    },
    [book, bookId, positions, updateProgress],
  );

  const handleSelectionAction = useCallback(
    (event: SelectionActionEvent) => {
      if (event.actionId === 'highlight') {
        const color = colors.highlightYellow;
        const locatorStr = JSON.stringify(event.locator);
        createHighlight(bookId, event.selectedText || '', locatorStr, color)
          .then(() => {
            hapticSuccess();
            showToast('success', 'Highlight created');
            const newDecoration: Decoration = {
              id: `hl_${Date.now()}`,
              locator: event.locator,
              style: { type: 'highlight', tint: color },
            };
            setDecorations((prev) => {
              const group = prev.find((g) => g.name === 'highlights');
              if (group) {
                return prev.map((g) =>
                  g.name === 'highlights'
                    ? { ...g, decorations: [...g.decorations, newDecoration] }
                    : g,
                );
              }
              return [...prev, { name: 'highlights', decorations: [newDecoration] }];
            });
          })
          .catch((err: any) => {
            showToast('error', 'Error', err.message);
          });
      } else if (event.actionId === 'bookmark') {
        addBookmark(
          bookId,
          JSON.stringify(event.locator),
          event.selectedText?.slice(0, 50),
        )
          .then(() => {
            hapticSuccess();
            showToast('success', 'Bookmark added');
          })
          .catch(() => {
            showToast('error', 'Failed to add bookmark');
          });
      }
    },
    [bookId, createHighlight, addBookmark],
  );

  const handleDecorationActivated = useCallback(
    (event: DecorationActivatedEvent) => {
      Alert.alert('Highlight', 'Delete this highlight?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteHighlight(bookId, event.decoration.id)
              .then(() => {
                setDecorations((prev) =>
                  prev.map((g) => ({
                    ...g,
                    decorations: g.decorations.filter(
                      (d) => d.id !== event.decoration.id,
                    ),
                  })),
                );
              })
              .catch(() => {
                showToast('error', 'Failed to delete highlight');
              });
            analytics.trackEvent('highlight_deleted', { book_id: bookId });
          },
        },
      ]);
    },
    [bookId, deleteHighlight],
  );

  const handleAddBookmark = useCallback(async () => {
    if (!book) return;
    const locator = currentLocatorRef.current;
    if (!locator) return;
    try {
      await addBookmark(book.id, JSON.stringify(locator));
      hapticSuccess();
      showToast('success', 'Bookmark added');
    } catch {
      showToast('error', 'Failed to add bookmark');
    }
  }, [book, addBookmark]);

  const handleGoToBookmark = useCallback(
    (cfi: string) => {
      try {
        const locator = JSON.parse(cfi) as Locator;
        readiumRef.current?.goTo(locator);
        setShowOverlay(false);
        setShowBookmarks(false);
      } catch {
        showToast('error', 'Invalid bookmark location');
      }
    },
    [],
  );

  const handleGoToChapter = useCallback(
    (href: string) => {
      readiumRef.current?.goTo({ href, type: 'application/xhtml+xml' });
      setShowOverlay(false);
      setShowChapters(false);
    },
    [],
  );

  const handleGoToHighlight = useCallback(
    (location: string) => {
      try {
        const locator = JSON.parse(location) as Locator;
        readiumRef.current?.goTo(locator);
        setShowHighlights(false);
      } catch {
        showToast('error', 'Invalid highlight location');
      }
    },
    [],
  );

  const renderChapterItem = useCallback(
    ({
      item,
    }: {
      item: { href: string; label: string; depth: number };
    }) => (
      <TouchableOpacity
        style={[styles.chapterItem, { paddingLeft: 16 + item.depth * 16 }]}
        onPress={() => handleGoToChapter(item.href)}
      >
        <Text style={styles.chapterLabel} numberOfLines={1}>
          {item.label}
        </Text>
      </TouchableOpacity>
    ),
    [handleGoToChapter],
  );

  const renderBookmarkItem = useCallback(
    ({ item }: { item: typeof bookmarks[number] }) => (
      <TouchableOpacity
        style={styles.chapterItem}
        onPress={() => handleGoToBookmark(item.cfi)}
        onLongPress={() => {
          Alert.alert(
            'Delete bookmark',
            item.label || 'Remove this bookmark?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => removeBookmark(book?.id ?? '', item.id),
              },
            ],
          );
        }}
      >
        <Text style={styles.chapterLabel} numberOfLines={1}>
          {item.label || 'Bookmark'}
        </Text>
      </TouchableOpacity>
    ),
    [handleGoToBookmark, removeBookmark, book?.id],
  );

  const chaptersKeyExtractor = useCallback(
    (item: { href: string }) => item.href,
    [],
  );
  const bookmarksKeyExtractor = useCallback(
    (b: { id: string }) => b.id,
    [],
  );

  const toggleOverlay = useCallback(() => {
    setShowOverlay((prev) => !prev);
    if (showHighlights) setShowHighlights(false);
  }, [showHighlights]);

  const handleDeleteHighlight = useCallback(
    (highlightId: string) => {
      hapticLight();
      Alert.alert('Delete highlight', 'Remove this highlight?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteHighlight(bookId, highlightId)
              .then(() => {
                setDecorations((prev) =>
                  prev.map((g) => ({
                    ...g,
                    decorations: g.decorations.filter(
                      (d) => d.id !== highlightId,
                    ),
                  })),
                );
              })
              .catch(() => {
                showToast('error', 'Failed to delete highlight');
              });
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
      <TouchableOpacity onPress={() => handleGoToHighlight(item.location)}>
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
    [
      notesByHighlight,
      handleDeleteHighlight,
      handleSaveNote,
      handleDeleteNote,
      handleGoToHighlight,
    ],
  );

  const preferences: Partial<Preferences> = useMemo(
    () => ({
      theme: theme as Preferences['theme'],
      backgroundColor: THEME_MAP[theme]?.backgroundColor,
      textColor: THEME_MAP[theme]?.textColor,
      fontSize,
      fontFamily: fontFamily as Preferences['fontFamily'],
      publisherStyles: false,
    }),
    [theme, fontSize, fontFamily],
  );

  const cycleTheme = useCallback(() => {
    const idx = THEME_OPTIONS.findIndex((t) => t.value === theme);
    const next = THEME_OPTIONS[(idx + 1) % THEME_OPTIONS.length].value;
    setTheme(next);
  }, [theme]);

  if (!book) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const themeBg = THEME_MAP[theme]?.backgroundColor || '#ffffff';
  const isDarkTheme = theme === 'dark';

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: themeBg }]}
      edges={['top', 'bottom']}
    >
      <StatusBar
        barStyle={isDarkTheme ? 'light-content' : 'dark-content'}
        backgroundColor={themeBg}
      />
      {fontPrefsLoaded && file && (
        <ReadiumView
          ref={readiumRef}
          file={file}
          preferences={preferences}
          decorations={decorations}
          selectionActions={selectionActions}
          style={styles.readiumView}
          onLocationChange={handleLocationChange}
          onPublicationReady={handlePublicationReady}
          onSelectionAction={handleSelectionAction}
          onDecorationActivated={handleDecorationActivated}
        />
      )}

      {ready && positions && (
        <>
          <View style={pageBadgeStyle}>
            <Text style={styles.badgeText}>
              Pos. {currentPosition} / {positions.totalCount}
            </Text>
          </View>
          <View style={timeBadgeLeftStyle}>
            <Text style={styles.badgeText}>{overallProgress}%</Text>
          </View>
        </>
      )}

      {ready && (
        <TouchableOpacity
          style={[styles.fab, { top: insets.top + 8 }]}
          onPress={toggleOverlay}
          activeOpacity={0.8}
        >
          <Icon name="dots-vertical" size={22} color="#ffffff" />
        </TouchableOpacity>
      )}

      {showOverlay && ready && (
        <View style={absoluteFillEnd}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              setShowOverlay(false);
            }}
          />
          <Animated.View
            entering={FadeIn.springify()}
            exiting={FadeOut}
            style={[styles.overlayPanel, { paddingBottom: insets.bottom + 16 }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.panelHandle} />

            <View style={styles.fontRow}>
              <TouchableOpacity style={styles.fontBtn} onPress={decreaseSize}>
                <Text style={styles.fontBtnText}>A−</Text>
              </TouchableOpacity>
              <Text style={styles.fontSizeLabel}>
                Zoom {Math.round(fontSize * 100)}%
              </Text>
              <TouchableOpacity style={styles.fontBtn} onPress={increaseSize}>
                <Text style={styles.fontBtnText}>A+</Text>
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity style={styles.fontBtn} onPress={cycleFont}>
                <Text style={styles.fontLabelText}>{fontLabel}</Text>
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity style={styles.fontBtn} onPress={cycleTheme}>
                <Text style={styles.fontLabelText}>
                  {THEME_OPTIONS.find((t) => t.value === theme)?.label}
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
                style={styles.actionBtn}
                onPress={() => setShowHighlights(true)}
              >
                <Text style={styles.actionBtnText}>
                  Highlights ({highlights.length})
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      )}

      {/* Chapters list */}
      {showChapters && toc.length > 0 && (
        <View style={absoluteFillEnd}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowChapters(false)}
          />
          <Animated.View
            entering={FadeIn.springify()}
            exiting={FadeOut}
            style={[styles.chaptersPanel, panelPadding]}
            onStartShouldSetResponder={captureResponder}
          >
            <View style={styles.panelHandle} />
            <Text style={styles.chaptersTitle}>Chapters</Text>
            <FlatList
              data={toc}
              keyExtractor={chaptersKeyExtractor}
              renderItem={renderChapterItem}
              style={styles.chaptersList}
            />
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
                keyExtractor={bookmarksKeyExtractor}
                renderItem={renderBookmarkItem}
                style={styles.chaptersList}
              />
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
              <Text
                style={styles.highlightsCloseText}
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
  readiumView: {
    flex: 1,
    backgroundColor: colors.bg,
  },
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
  fontRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  fontBtn: {
    backgroundColor: 'rgba(0,0,0,0.06)',
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
    color: colors.text,
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
    color: colors.text,
    fontWeight: '600',
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
    color: colors.text,
  },
  highlightsCloseText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '600',
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
  pageBadge: {
    position: 'absolute',
    right: 16,
    zIndex: 999,
    elevation: 10,
  },
  timeBadgeLeft: {
    position: 'absolute',
    left: 16,
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
    color: colors.text,
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
