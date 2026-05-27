import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator,
  TextInput, Alert,
} from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useHighlightStore } from '@/stores/highlightStore';
import { useNoteStore } from '@/stores/noteStore';
import type { RootStackParamList, Highlight, Note } from '@/types';

export function HighlightsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { allHighlights, loading: hLoading, fetchAllHighlights, deleteHighlight } = useHighlightStore();
  const { allNotes, fetchAllNotes, createNote, deleteNote } = useNoteStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAllHighlights();
    fetchAllNotes();
  }, [fetchAllHighlights, fetchAllNotes]);

  const notesByHighlight = useMemo(() => {
    const map: Record<string, Note[]> = {};
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

  const handleOpenBook = (bookId: string) => {
    navigation.navigate('Reader', { bookId });
  };

  const handleSaveNote = async (bookId: string, highlightId: string) => {
    const text = noteText[highlightId]?.trim();
    if (!text) return;
    setSaving(true);
    try {
      await createNote(bookId, text, highlightId);
      setNoteText((prev) => ({ ...prev, [highlightId]: '' }));
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const isExpanded = (id: string) => expandedId === id;
  const notesFor = (highlightId: string) => notesByHighlight[highlightId] || [];

  const renderGroup = ({
    item: [bookId, group],
  }: {
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

      {group.highlights.map((h, idx) => {
        const expanded = isExpanded(h.id);
        const notes = notesFor(h.id);
        return (
          <Animated.View
            key={h.id}
            entering={FadeInDown.delay(idx * 50).springify()}
            exiting={FadeOutUp}
          >
            <TouchableOpacity
              style={styles.highlightItem}
              onPress={() => setExpandedId(expanded ? null : h.id)}
              onLongPress={() => {
                Alert.alert('Delete highlight', 'Remove this highlight?', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => deleteHighlight(bookId, h.id),
                  },
                ]);
              }}
            >
              <View style={[styles.bar, { backgroundColor: h.color }]} />
              <View style={styles.highlightContent}>
                <Text style={styles.highlightText} numberOfLines={expanded ? undefined : 3}>
                  {h.text}
                </Text>
                {notes.length > 0 && !expanded && (
                  <Text style={styles.noteCount}>
                    {notes.length} note{notes.length > 1 ? 's' : ''}
                  </Text>
                )}
              </View>
            </TouchableOpacity>

            {expanded && (
              <View style={styles.notesSection}>
                {notes.map((n) => (
                  <View key={n.id} style={styles.noteItem}>
                    <Text style={styles.noteContent}>{n.content}</Text>
                    <TouchableOpacity
                      onPress={() => {
                        Alert.alert('Delete note', 'Remove this note?', [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: () => deleteNote(bookId, n.id),
                          },
                        ]);
                      }}
                    >
                      <Text style={styles.deleteBtn}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <View style={styles.noteInputRow}>
                  <TextInput
                    style={styles.noteInput}
                    placeholder="Write a note..."
                    placeholderTextColor="#666680"
                    value={noteText[h.id] || ''}
                    onChangeText={(t) => setNoteText((prev) => ({ ...prev, [h.id]: t }))}
                    multiline
                  />
                  <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={() => handleSaveNote(bookId, h.id)}
                    disabled={saving}
                  >
                    {saving ? (
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
      })}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>{'<'} Library</Text>
          </TouchableOpacity>
          <Text style={styles.heading}>Highlights</Text>
          <View style={{ width: 60 }} />
        </View>

        {hLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#4A4AE9" size="large" />
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
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#12121A' },
  container: { flex: 1, paddingHorizontal: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  backText: { fontSize: 16, color: '#4A4AE9', fontWeight: '600' },
  heading: { fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
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
    color: '#FFFFFF',
    marginRight: 12,
  },
  groupCount: { fontSize: 13, color: '#666680' },
  highlightItem: {
    flexDirection: 'row',
    backgroundColor: '#1E1E2E',
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  bar: { width: 4, borderRadius: 2, alignSelf: 'stretch' },
  highlightContent: { flex: 1, gap: 6 },
  highlightText: { flex: 1, color: '#D0D0E0', fontSize: 14, lineHeight: 20 },
  noteCount: { color: '#4A4AE9', fontSize: 12, fontWeight: '600' },
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
  noteContent: { flex: 1, color: '#B0B0CC', fontSize: 13, lineHeight: 18 },
  deleteBtn: { color: '#FF6B6B', fontSize: 18, fontWeight: '700', paddingHorizontal: 4 },
  noteInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 4 },
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
  saveBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: {
    color: '#666680',
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 22,
  },
});
