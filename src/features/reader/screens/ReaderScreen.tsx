import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  FlatList, TextInput, Alert,
} from 'react-native';
import Animated, { FadeInDown, FadeOutUp, FadeIn, FadeOut } from 'react-native-reanimated';
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
import type { RootStackParamList, Highlight, Note } from '@/types';

type ReaderRoute = RouteProp<RootStackParamList, 'Reader'>;

const HIGHLIGHT_COLORS = [
  { color: '#FFD700', label: 'Yellow' },
  { color: '#00FF88', label: 'Green' },
  { color: '#4A4AE9', label: 'Blue' },
  { color: '#FF6B9D', label: 'Pink' },
  { color: '#FFAA00', label: 'Orange' },
];

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
  const [expandedHighlight, setExpandedHighlight] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [cachedData, setCachedData] = useState<string | null | undefined>(undefined);
  const { fontSize, fontFamily, increaseSize, decreaseSize, cycleFont, fontLabel } = useFontPrefs(); // null = no cache, string = ready, undefined = loading

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
      setSelected(null);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setCreatingHighlight(false);
    }
  }, [bookId, selected, createHighlight]);

  const handleDeleteHighlight = useCallback((highlightId: string) => {
    Alert.alert('Delete highlight', 'Remove this highlight?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteHighlight(bookId, highlightId),
      },
    ]);
  }, [bookId, deleteHighlight]);

  const handleSaveNote = useCallback(async () => {
    const text = noteText.trim();
    if (!text || !expandedHighlight) return;
    setSavingNote(true);
    try {
      await createNote(bookId, text, expandedHighlight);
      setNoteText('');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSavingNote(false);
    }
  }, [bookId, noteText, expandedHighlight, createNote]);

  const handleDeleteNote = useCallback((noteId: string) => {
    Alert.alert('Delete note', 'Remove this note?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteNote(bookId, noteId),
      },
    ]);
  }, [bookId, deleteNote]);

  const highlightLocations = highlights.map((h) => ({
    location: h.location,
    color: h.color,
  }));

  const notesByHighlight = useMemo(() => {
    const map: Record<string, Note[]> = {};
    for (const n of notes) {
      if (n.highlight_id) {
        if (!map[n.highlight_id]) map[n.highlight_id] = [];
        map[n.highlight_id].push(n);
      }
    }
    return map;
  }, [notes]);

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
            Highlight: "{selected.text}"
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
        <View style={[styles.overlay, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backText}>{'<'} Back</Text>
          </TouchableOpacity>
          <View style={styles.infoRow}>
            <View style={styles.info}>
              <Text style={styles.title} numberOfLines={1}>{book.title}</Text>
              {book.author && (
                <Text style={styles.author}>{book.author}</Text>
              )}
            </View>
            <View style={styles.fontControls}>
              <TouchableOpacity style={styles.fontBtn} onPress={decreaseSize}>
                <Text style={styles.fontBtnText}>A-</Text>
              </TouchableOpacity>
              <Text style={styles.fontSizeLabel}>{Math.round(fontSize * 100)}%</Text>
              <TouchableOpacity style={styles.fontBtn} onPress={increaseSize}>
                <Text style={styles.fontBtnText}>A+</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.fontBtn} onPress={cycleFont}>
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
        </View>
      )}

      {/* Highlights list */}
      {showHighlights && (
        <View style={[styles.highlightsPanel, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.highlightsHeader}>
            <Text style={styles.highlightsTitle}>Highlights</Text>
            <TouchableOpacity onPress={() => { setShowHighlights(false); setExpandedHighlight(null); }}>
              <Text style={styles.backText}>Close</Text>
            </TouchableOpacity>
          </View>
          {highlights.length === 0 ? (
            <Text style={styles.noHighlights}>Select text to create a highlight</Text>
          ) : (
            <FlatList
              data={highlights}
              keyExtractor={(h) => h.id}
              renderItem={({ item, index }: { item: Highlight; index: number }) => {
                const isExpanded = expandedHighlight === item.id;
                const hNotes = notesByHighlight[item.id] || [];
                return (
                  <Animated.View
                    entering={FadeInDown.delay(index * 40).springify()}
                    exiting={FadeOutUp}
                  >
                    <TouchableOpacity
                      style={styles.highlightItem}
                      onPress={() => setExpandedHighlight(isExpanded ? null : item.id)}
                      onLongPress={() => handleDeleteHighlight(item.id)}
                    >
                      <View style={[styles.highlightBar, { backgroundColor: item.color }]} />
                      <View style={styles.highlightContent}>
                        <Text style={styles.highlightText} numberOfLines={isExpanded ? undefined : 3}>
                          {item.text}
                        </Text>
                        {hNotes.length > 0 && !isExpanded && (
                          <Text style={styles.noteCount}>{hNotes.length} note{hNotes.length > 1 ? 's' : ''}</Text>
                        )}
                      </View>
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={styles.notesSection}>
                        {hNotes.map((n) => (
                          <View key={n.id} style={styles.noteItem}>
                            <Text style={styles.noteContent}>{n.content}</Text>
                            <TouchableOpacity onPress={() => handleDeleteNote(n.id)}>
                              <Text style={styles.deleteBtn}>×</Text>
                            </TouchableOpacity>
                            </View>
                        ))}
                        <View style={styles.noteInputRow}>
                          <TextInput
                            style={styles.noteInput}
                            placeholder="Write a note..."
                            placeholderTextColor="#666680"
                            value={noteText}
                            onChangeText={setNoteText}
                            multiline
                          />
                          <TouchableOpacity
                            style={styles.saveBtn}
                            onPress={handleSaveNote}
                            disabled={savingNote}
                          >
                            {savingNote ? (
                              <ActivityIndicator color="#FFF" size="small" />
                            ) : (
                              <Text style={styles.saveBtnText}>Save</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </Animated.View>
                );
              }}
              contentContainerStyle={styles.highlightsList}
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
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: 'rgba(18,18,26,0.95)',
  },
  backButton: {
    marginBottom: 12,
  },
  backText: {
    fontSize: 16,
    color: '#4A4AE9',
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 8,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  fontControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fontBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  fontBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B0B0CC',
  },
  fontSizeLabel: {
    fontSize: 11,
    color: '#666680',
    minWidth: 32,
    textAlign: 'center',
    fontWeight: '600',
  },
  fontLabelText: {
    fontSize: 11,
    color: '#B0B0CC',
    fontWeight: '700',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  author: {
    fontSize: 14,
    color: '#B0B0CC',
  },
  highlightsBtn: {
    backgroundColor: 'rgba(74,74,233,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
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
  highlightItem: {
    flexDirection: 'row',
    backgroundColor: '#1E1E2E',
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  highlightBar: {
    width: 4,
    borderRadius: 2,
    alignSelf: 'stretch',
  },
  highlightContent: {
    flex: 1,
    gap: 6,
  },
  highlightText: {
    flex: 1,
    color: '#D0D0E0',
    fontSize: 14,
    lineHeight: 20,
  },
  noteCount: {
    color: '#4A4AE9',
    fontSize: 12,
    fontWeight: '600',
  },
  notesSection: {
    backgroundColor: '#1A1A28',
    borderRadius: 10,
    padding: 12,
    gap: 8,
    marginTop: 4,
  },
  noteItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 4,
    gap: 8,
  },
  noteContent: {
    flex: 1,
    color: '#B0B0CC',
    fontSize: 13,
    lineHeight: 18,
  },
  deleteBtn: {
    color: '#FF6B6B',
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 4,
  },
  noteInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  noteInput: {
    flex: 1,
    backgroundColor: '#1E1E2E',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
    maxHeight: 80,
  },
  saveBtn: {
    backgroundColor: '#4A4AE9',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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
