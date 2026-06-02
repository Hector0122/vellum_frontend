import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { AnimatedListItem } from '@/shared/components/AnimatedListItem';
import { CachedImage } from '@/shared/components/CachedImage';
import type { Book } from '@/types';
import { colors } from '@/shared/theme/colors';

interface BookCardProps {
  item: Book;
  index: number;
  onPress: (book: Book) => void;
  onLongPress: (book: Book) => void;
}

function BookCardInner({ item, index, onPress, onLongPress }: BookCardProps) {
  return (
    <AnimatedListItem index={index}>
      <TouchableOpacity
        style={styles.bookCard}
        onPress={() => onPress(item)}
        onLongPress={() => onLongPress(item)}
        activeOpacity={0.7}
      >
        {item.cover_url ? (
          <CachedImage uri={item.cover_url} style={styles.coverImage} />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Icon name="book-open-variant" size={24} color={colors.textSecondary} />
          </View>
        )}
        <View style={styles.bookInfo}>
          <Text style={styles.bookTitle} numberOfLines={1}>
            {item.title}
          </Text>
          {item.author && <Text style={styles.bookAuthor}>{item.author}</Text>}
          <View style={styles.progressRow}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(item.progress_percent, 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {item.progress_percent > 0
                ? `${Math.round(item.progress_percent)}%`
                : '—'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </AnimatedListItem>
  );
}

export const BookCard = React.memo(BookCardInner);

const styles = StyleSheet.create({
  bookCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    gap: 12,
    alignItems: 'center',
  },
  coverImage: {
    width: 48,
    height: 64,
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  coverPlaceholder: {
    width: 48,
    height: 64,
    backgroundColor: colors.border,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookInfo: {
    flex: 1,
    gap: 2,
  },
  bookTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  bookAuthor: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    minWidth: 32,
    textAlign: 'right',
  },
});
