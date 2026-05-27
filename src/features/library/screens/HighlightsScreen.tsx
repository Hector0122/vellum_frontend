import React, { useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useHighlightStore } from '@/stores/highlightStore';
import { useNoteStore } from '@/stores/noteStore';
import { HighlightItem } from '@/features/highlights/components/HighlightItem';
import { analytics } from '@/shared/lib/analytics';
import { hapticLight } from '@/shared/lib/haptics';
import { showToast } from '@/shared/components/Toast';
import type { RootStackParamList, Highlight } from '@/types';
import { colors } from '@/shared/theme/colors';

const FLATLIST_CONFIG = {
  initialNumToRender: 5,
  maxToRenderPerBatch: 10,
  windowSize: 5,
  removeClippedSubviews: true,
};

export function HighlightsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { allHighlights, loading: hLoading, allLoading, allHasMore, fetchAllHighlights, deleteHighlight } = useHighlightStore();
  const { allNotes, fetchAllNotes, createNote, deleteNote } = useNoteStore();

  useEffect(() => {
    fetchAllHighlights(true);
    fetchAllNotes(true);
    analytics.trackPageView('Highlights');
  }, [fetchAllHighlights, fetchAllNotes]);

  const notesByHighlight = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const n of allNotes) {
      if (n.highlight_id) {
        if (!map[n.highlight_id]) map[n.highlight_id] = [];
        map[n.highlight_id].push(n);
      }
    }
    return map;
  }, [allNotes]);

  const grouped = useMemo(() => {
    const map: Record<string, { bookTitle: string; highlights: Highlight[] }> = {};
    for (const h of allHighlights) {
      const key = h.book_id;
      if (!map[key]) {
        map[key] = { bookTitle: h.book_title || 'Unknown', highlights: [] };
      }
      map[key].highlights.push(h);
    }
    return Object.entries(map).sort(
      (a, b) => b[1].highlights.length - a[1].highlights.length,
    );
  }, [allHighlights]);

  const handleOpenBook = useCallback((bookId: string) => {
    navigation.navigate('Reader', { bookId });
  }, [navigation]);

  const handleDeleteHighlight = useCallback((highlightId: string) => {
    const h = allHighlights.find((x) => x.id === highlightId);
    if (h) {
      deleteHighlight(h.book_id, highlightId);
      hapticLight();
      showToast('info', 'Highlight deleted');
      analytics.trackEvent('highlight_deleted', { book_id: h.book_id });
    }
  }, [allHighlights, deleteHighlight]);

  const handleSaveNote = useCallback(async (highlightId: string, text: string) => {
    const h = allHighlights.find((x) => x.id === highlightId);
    if (!h) return;
    await createNote(h.book_id, text, highlightId);
    hapticLight();
    showToast('success', 'Note saved');
    analytics.trackEvent('note_created', { book_id: h.book_id });
  }, [allHighlights, createNote]);

  const handleDeleteNote = useCallback((noteId: string) => {
    const n = allNotes.find((x) => x.id === noteId);
    if (n) {
      deleteNote(n.book_id, noteId);
      hapticLight();
      analytics.trackEvent('note_deleted', { book_id: n.book_id });
    }
  }, [allNotes, deleteNote]);

  const handleLoadMore = useCallback(() => {
    if (!allLoading && allHasMore) {
      fetchAllHighlights();
    }
  }, [allLoading, allHasMore, fetchAllHighlights]);

  const renderGroup = useCallback(({ item: [bookId, group] }: {
    item: [string, { bookTitle: string; highlights: Highlight[] }];
  }) => (
    <View style={styles.group}>
      <TouchableOpacity
        style={styles.groupHeader}
        onPress={() => handleOpenBook(bookId)}
      >
        <Text style={styles.groupTitle} numberOfLines={1}>
          {group.bookTitle}
        </Text>
        <Text style={styles.groupCount}>
          {group.highlights.length} highlight{group.highlights.length !== 1 ? 's' : ''}
        </Text>
      </TouchableOpacity>

      {group.highlights.map((h, idx) => (
        <HighlightItem
          key={h.id}
          item={h}
          index={idx}
          notes={notesByHighlight[h.id] || []}
          bookId={bookId}
          onDelete={handleDeleteHighlight}
          onSaveNote={handleSaveNote}
          onDeleteNote={handleDeleteNote}
        />
      ))}
    </View>
  ), [handleOpenBook, handleDeleteHighlight, handleSaveNote, handleDeleteNote, notesByHighlight]);

  const renderFooter = useCallback(() => {
    if (!allLoading) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator color={colors.accent} size="small" />
      </View>
    );
  }, [allLoading]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>{'<'} Library</Text>
          </TouchableOpacity>
          <Text style={styles.heading}>Highlights</Text>
          <View style={styles.headerSpacer} />
        </View>

        {hLoading && allHighlights.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        ) : allHighlights.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>
              No highlights yet. Select text while reading to create one.
            </Text>
          </View>
        ) : (
          <FlatList
            data={grouped}
            keyExtractor={([id]) => id}
            renderItem={renderGroup}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            initialNumToRender={FLATLIST_CONFIG.initialNumToRender}
            maxToRenderPerBatch={FLATLIST_CONFIG.maxToRenderPerBatch}
            windowSize={FLATLIST_CONFIG.windowSize}
            removeClippedSubviews={FLATLIST_CONFIG.removeClippedSubviews}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.3}
            ListFooterComponent={renderFooter}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, paddingHorizontal: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  backText: { fontSize: 16, color: colors.accent, fontWeight: '600' },
  heading: { fontSize: 22, fontWeight: '700', color: colors.white },
  headerSpacer: { width: 60 },
  list: { gap: 20, paddingBottom: 40 },
  group: { gap: 8 },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  groupTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
    marginRight: 12,
  },
  groupCount: { fontSize: 13, color: colors.textMuted },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 22,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
