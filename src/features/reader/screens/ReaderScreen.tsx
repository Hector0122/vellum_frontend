import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  FlatList, Alert,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useLibraryStore } from '@/stores/libraryStore';
import { useHighlightStore } from '@/stores/highlightStore';
import { useNoteStore } from '@/stores/noteStore';
import { EpubReader } from '../components/EpubReader';
import { isEpubCached, getCachedEpubBase64, downloadAndCache } from '@/shared/lib/epubCache';
import { useFontPrefs } from '@/shared/hooks/useFontPrefs';
import { HighlightItem } from '@/features/highlights/components/HighlightItem';
import { analytics } from '@/shared/lib/analytics';
import { hapticLight, hapticSuccess } from '@/shared/lib/haptics';
import { showToast } from '@/shared/components/Toast';
import type { RootStackParamList } from '@/types';

type ReaderRoute = RouteProp<RootStackParamList, 'Reader'>;

const HIGHLIGHT_COLORS = [
  { color: '#FFD700', label: 'Yellow' },
  { color: '#00FF88', label: 'Green' },
  { color: '#4A4AE9', label: 'Blue' },
  { color: '#FF6B9D', label: 'Pink' },
  { color: '#FFAA00', label: 'Orange' },
];

const FLATLIST_CONFIG = {
  initialNumToRender: 8,
  maxToRenderPerBatch: 10,
  windowSize: 5,
  removeClippedSubviews: true,
};

export function ReaderScreen() {
  const route = useRoute<ReaderRoute>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { bookId } = route.params;
  const { books, updateProgress } = useLibraryStore();
  const { highlights, fetchHighlights, createHighlight, deleteHighlight } = useHighlightStore();
  const { notes, fetchNotes, createNote, deleteNote } = useNoteStore();
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [showHighlights, setShowHighlights] = useState(false);
  const [readerError, setReaderError] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ cfiRange: string; text: string } | null>(null);
  const [creatingHighlight, setCreatingHighlight] = useState(false);
  const [cachedData, setCachedData] = useState<string | null | undefined>(undefined);
  const { fontSize, fontFamily, increaseSize, decreaseSize, cycleFont, fontLabel } = useFontPrefs();

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

  const book = books.find((b) => b.id === bookId);

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

  const handleProgress = useCallback((percent: number, cfi: string) => {
    if (book && percent >= 0) {
      updateProgress(book.id, percent, cfi || undefined);
    }
  }, [book, updateProgress]);

  const handleReady = useCallback(() => {
    setReady(true);
  }, []);

  const handleReaderError = useCallback((msg: string) => {
    setReaderError(msg);
  }, []);

  const toggleOverlay = useCallback(() => {
    setShowOverlay((prev) => !prev);
    if (showHighlights) setShowHighlights(false);
  }, [showHighlights]);

  const handleSelected = useCallback((cfiRange: string, text: string) => {
    setSelected({ cfiRange, text });
    setShowOverlay(false);
    setShowHighlights(false);
  }, []);

  const handleCreateHighlight = useCallback(async (color: string) => {
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
  }, [bookId, selected, createHighlight, fetchNotes]);

  const handleDeleteHighlight = useCallback((highlightId: string) => {
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
  }, [bookId, deleteHighlight]);

  const handleSaveNote = useCallback(async (highlightId: string, text: string) => {
    await createNote(bookId, text, highlightId);
    hapticLight();
    showToast('success', 'Note saved');
    analytics.trackEvent('note_created', { book_id: bookId });
  }, [bookId, createNote]);

  const handleDeleteNote = useCallback((noteId: string) => {
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
  }, [bookId, deleteNote]);

  const highlightLocations = useMemo(() =>
    highlights.map((h) => ({
      location: h.location,
      color: h.color,
    })),
  [highlights]);

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
    [notesByHighlight, bookId, handleDeleteHighlight, handleSaveNote, handleDeleteNote],
  );

  if (!book) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#4A4AE9" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <EpubReader
        bookId={book.id}
        initialCfi={book.progress_cfi}
        data={cachedData}
        fontSize={fontSize}
        fontFamily={fontFamily}
        highlights={highlightLocations}
        onProgress={handleProgress}
        onReady={handleReady}
        onError={handleReaderError}
        onTapped={toggleOverlay}
        onSelected={handleSelected}
      />

      {/* Color picker — show when text is selected */}
      {selected && (
        <Animated.View
          entering={FadeIn.springify()}
          exiting={FadeOut}
          style={[styles.pickerContainer, { bottom: insets.bottom + 16 }]}
        >
          <Text style={styles.pickerTitle} numberOfLines={2}>
            Highlight: &quot;{selected.text}&quot;
          </Text>
          <View style={styles.pickerRow}>
            {HIGHLIGHT_COLORS.map((c) => (
              <TouchableOpacity
                key={c.color}
                style={[styles.colorDot, { backgroundColor: c.color }]}
                onPress={() => handleCreateHighlight(c.color)}
                disabled={creatingHighlight}
              />
            ))}
            <TouchableOpacity
              style={styles.pickerCancel}
              onPress={() => setSelected(null)}
            >
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
      {showOverlay && ready && (
        <View style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end' }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowOverlay(false)}
          />
          <Animated.View
            entering={FadeIn.springify()}
            exiting={FadeOut}
            style={[styles.overlayPanel, { paddingBottom: insets.bottom + 16 }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.panelHandle} />
            <View style={styles.panelRow}>
              <View style={styles.fontControls}>
                <TouchableOpacity style={styles.fontBtn} onPress={trackedDecrease}>
                  <Text style={styles.fontBtnText}>A−</Text>
                </TouchableOpacity>
                <Text style={styles.fontSizeLabel}>{Math.round(fontSize * 100)}%</Text>
                <TouchableOpacity style={styles.fontBtn} onPress={trackedIncrease}>
                  <Text style={styles.fontBtnText}>A+</Text>
                </TouchableOpacity>
                <View style={styles.divider} />
                <TouchableOpacity style={styles.fontBtn} onPress={trackedCycleFont}>
                  <Text style={styles.fontLabelText}>{fontLabel}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.highlightsBtn}
                onPress={() => setShowHighlights((p) => !p)}
              >
                <Text style={styles.highlightsBtnText}>
                  Notes ({highlights.length})
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      )}

      {/* Highlights list */}
      {showHighlights && (
        <View style={[styles.highlightsPanel, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.highlightsHeader}>
            <Text style={styles.highlightsTitle}>Highlights</Text>
            <TouchableOpacity onPress={() => { setShowHighlights(false); }}>
              <Text style={{ color: '#4A4AE9', fontSize: 15, fontWeight: '600' }}>Close</Text>
            </TouchableOpacity>
          </View>
          {highlights.length === 0 ? (
            <Text style={styles.noHighlights}>Select text to create a highlight</Text>
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
          <ActivityIndicator color="#4A4AE9" size="large" />
          <Text style={styles.loadingText}>Loading reader...</Text>
          {readerError && (
            <Text style={styles.errorText}>{readerError}</Text>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#12121A',
  },
  overlayBackdrop: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    zIndex: 10,
  },
  overlayPanel: {
    backgroundColor: '#1A1A28',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 16,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  panelHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#2A2A3E',
    borderRadius: 2,
    alignSelf: 'center',
  },
  panelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  fontControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fontBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 36,
    alignItems: 'center',
  },
  fontBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  fontSizeLabel: {
    fontSize: 12,
    color: '#B0B0CC',
    minWidth: 36,
    textAlign: 'center',
    fontWeight: '600',
  },
  fontLabelText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: '#2A2A3E',
    marginHorizontal: 4,
  },
  highlightsBtn: {
    backgroundColor: 'rgba(74,74,233,0.25)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  highlightsBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4A4AE9',
  },
  highlightsPanel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#12121A',
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
    color: '#FFFFFF',
  },
  noHighlights: {
    color: '#666680',
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
    backgroundColor: '#1E1E2E',
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
    color: '#B0B0CC',
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
    color: '#666680',
    fontSize: 14,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#12121A',
  },
  loadingText: {
    color: '#B0B0CC',
    fontSize: 14,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginTop: 8,
  },
});
