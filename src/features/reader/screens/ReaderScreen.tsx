import React, { useMemo } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useLibraryStore } from '@/stores/libraryStore';
import { EpubReaderScreen } from '@/features/reader/screens/EpubReaderScreen';
import { PdfReaderScreen } from '@/features/reader/screens/PdfReaderScreen';
import { MarkdownReaderScreen } from '@/features/reader/screens/MarkdownReaderScreen';
import { colors } from '@/shared/theme/colors';
import type { RootStackParamList } from '@/types';

type ReaderRoute = RouteProp<RootStackParamList, 'Reader'>;

/**
 * Format dispatcher — see openspec/changes/add-multi-format-documents. Picks
 * the renderer by the book's fileType and otherwise stays out of the way;
 * each renderer (EpubReaderScreen, PdfReaderScreen, ...) owns its own route
 * param access, data fetching, and not-found handling.
 */
export function ReaderScreen() {
  const route = useRoute<ReaderRoute>();
  const { bookId } = route.params;
  const books = useLibraryStore((s) => s.books);
  const book = useMemo(() => books.find((b) => b.id === bookId), [books, bookId]);

  if (!book) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (book.file_type === 'pdf') {
    return <PdfReaderScreen />;
  }

  if (book.file_type === 'md') {
    return <MarkdownReaderScreen />;
  }

  return <EpubReaderScreen />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
