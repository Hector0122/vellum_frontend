import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { AnimatedListItem } from '@/shared/components/AnimatedListItem';
import { CachedImage } from '@/shared/components/CachedImage';
import type { Book } from '@/types';
import { colors } from '@/shared/theme/colors';
import { radius, iconSize } from '@/shared/theme/tokens';

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
            <Icon name="book-open-variant" size={iconSize.md} color={colors.textSecondary} />
          </View>
        )}
        <View style={styles.bookInfo}>
          <View style={styles.titleRow}>
            <Text style={styles.bookTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {item.status === 'read' && (
              <View style={styles.readBadge}>
                <Icon name="check-circle" size={iconSize.sm} color={colors.readIndicator} />
              </View>
            )}
          </View>
          {item.author && <Text style={styles.bookAuthor}>{item.author}</Text>}
          {item.genres && item.genres.length > 0 && (
            <View style={styles.genreRow}>
              {item.genres.slice(0, 3).map((g) => (
                <View key={g} style={styles.genreChip}>
                  <Text style={styles.genreText}>{g}</Text>
                </View>
              ))}
            </View>
          )}
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
          {item.total_pages != null && item.total_pages > 0 && (
            <Text style={styles.pageText}>
              Pág. {item.current_page} / {item.total_pages}
            </Text>
          )}
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
    borderRadius: radius.md,
    padding: 12,
    gap: 12,
    alignItems: 'center',
  },
  coverImage: {
    width: 48,
    height: 64,
    borderRadius: radius.xs,
    backgroundColor: colors.border,
  },
  coverPlaceholder: {
    width: 48,
    height: 64,
    backgroundColor: colors.border,
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookInfo: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bookTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  readBadge: {
    marginLeft: 2,
  },
  bookAuthor: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  genreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  genreChip: {
    backgroundColor: 'rgba(108,99,255,0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  genreText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.accent,
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
  pageText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
});
