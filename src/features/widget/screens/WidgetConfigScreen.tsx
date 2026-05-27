import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useLibraryStore } from '@/stores/libraryStore';
import { api } from '@/shared/lib/api';
import { VellumWidgetModule } from '@/native/VellumWidget';
import { analytics } from '@/shared/lib/analytics';
import { hapticLight, hapticSuccess } from '@/shared/lib/haptics';
import { showToast } from '@/shared/components/Toast';
import { colors } from '@/shared/theme/colors';
import type { Book, Highlight } from '@/types';

interface BookWithHighlights extends Book {
  highlightsCount: number;
}

export function WidgetConfigScreen() {
  const navigation = useNavigation();
  const { books, fetchBooks, loading } = useLibraryStore();

  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchBooks();
    analytics.trackPageView('WidgetConfig');
    (async () => {
      const bookId = await VellumWidgetModule.getWidgetBookId();
      if (bookId) setSelectedBookId(bookId);
    })();
  }, [fetchBooks]);

  const handleSave = useCallback(async () => {
    if (!selectedBookId) {
      showToast('error', 'Select a book');
      return;
    }

    setSaving(true);
    try {
      const data = await api.get<{
        book: Book;
        highlights: Highlight[];
        bookmarks: any[];
      }>(`/api/widget/book/${selectedBookId}`);

      const highlightsJson = JSON.stringify(data.highlights.slice(0, 5));

      await VellumWidgetModule.pushWidgetData(
        highlightsJson,
        selectedBookId,
        data.book.title,
      );

      hapticSuccess();
      showToast(
        'success',
        'Widget updated',
        `${data.highlights.length} highlights shown`,
      );
      navigation.goBack();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update widget');
    } finally {
      setSaving(false);
    }
  }, [selectedBookId, navigation]);

  const renderBookItem = useCallback(
    ({ item }: { item: Book }) => {
      const isSelected = item.id === selectedBookId;
      return (
        <TouchableOpacity
          style={[styles.bookItem, isSelected && styles.bookItemSelected]}
          onPress={() => {
            hapticLight();
            setSelectedBookId(item.id);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.bookCoverPlaceholder}>
            <Text style={styles.bookCoverEmoji}>
              {item.title.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.bookInfo}>
            <Text style={styles.bookTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.bookAuthor} numberOfLines={1}>
              {item.author || 'Unknown author'}
            </Text>
          </View>
          <Icon
            name={isSelected ? 'radiobox-marked' : 'radiobox-blank'}
            size={24}
            color={isSelected ? colors.accent : colors.textMuted}
          />
        </TouchableOpacity>
      );
    },
    [selectedBookId],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Icon name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Widget</Text>
        <View style={styles.backButton} />
      </View>

      <Text style={styles.description}>
        Select a book to display its highlights on your home screen widget.
      </Text>

      <Text style={styles.sectionTitle}>Your books</Text>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={styles.loader} />
      ) : (
        <FlatList
          data={books}
          keyExtractor={(item) => item.id}
          renderItem={renderBookItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              No books yet. Upload a book first.
            </Text>
          }
        />
      )}

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.saveButton,
            (!selectedBookId || saving) && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={!selectedBookId || saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Apply to Widget</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: {
    fontSize: 13,
    color: colors.textSecondary,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    lineHeight: 20,
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    backgroundColor: colors.accentSoft,
    borderRadius: 12,
    gap: 10,
  },
  previewText: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  loader: {
    marginTop: 40,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 40,
  },
  bookItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bookItemSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  bookCoverPlaceholder: {
    width: 40,
    height: 56,
    backgroundColor: colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    marginRight: 12,
  },
  bookCoverEmoji: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.accent,
  },
  bookInfo: {
    flex: 1,
    marginRight: 8,
  },
  bookTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  bookAuthor: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveButton: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
});
