import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import type { Highlight, Note } from '@/types';
import { colors } from '@/shared/theme/colors';
import { radius } from '@/shared/theme/tokens';

interface HighlightItemProps {
  item: Highlight;
  index: number;
  notes: Note[];
  onDelete: (highlightId: string) => void;
  onSaveNote: (highlightId: string, text: string) => Promise<void>;
  onDeleteNote: (noteId: string) => void;
}

function HighlightItemInner({
  item, index, notes, onDelete, onSaveNote, onDeleteNote,
}: HighlightItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);

  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const handleLongPress = useCallback(() => {
    Alert.alert('Delete highlight', 'Remove this highlight?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => onDelete(item.id),
      },
    ]);
  }, [item.id, onDelete]);

  const handleSave = useCallback(async () => {
    const text = noteText.trim();
    if (!text) return;
    setSaving(true);
    try {
      await onSaveNote(item.id, text);
      setNoteText('');
    } catch {
      // error handled by parent
    } finally {
      setSaving(false);
    }
  }, [noteText, item.id, onSaveNote]);

  const handleDeleteNote = useCallback((noteId: string) => {
    Alert.alert('Delete note', 'Remove this note?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => onDeleteNote(noteId),
      },
    ]);
  }, [onDeleteNote]);

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 40).springify()}
      exiting={FadeOutUp}
    >
      <TouchableOpacity
        style={styles.highlightItem}
        onPress={handleToggle}
        onLongPress={handleLongPress}
      >
        <View style={[styles.bar, { backgroundColor: item.color }]} />
        <View style={styles.highlightContent}>
          <Text style={styles.highlightText} numberOfLines={expanded ? undefined : 3}>
            {item.text}
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
              <TouchableOpacity onPress={() => handleDeleteNote(n.id)}>
                <Text style={styles.deleteBtn}>{'\u00D7'}</Text>
              </TouchableOpacity>
            </View>
          ))}
          <View style={styles.noteInputRow}>
            <TextInput
              style={styles.noteInput}
              placeholder="Write a note..."
              placeholderTextColor={colors.textMuted}
              value={noteText}
              onChangeText={setNoteText}
              multiline
            />
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Animated.View>
  );
}

export const HighlightItem = React.memo(HighlightItemInner);

const styles = StyleSheet.create({
  highlightItem: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: 12,
    gap: 10,
  },
  bar: {
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
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  noteCount: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  notesSection: {
    backgroundColor: colors.elevated,
    borderRadius: radius.sm,
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
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  deleteBtn: {
    color: colors.destructive,
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
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
    maxHeight: 80,
  },
  saveBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  saveBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
});
