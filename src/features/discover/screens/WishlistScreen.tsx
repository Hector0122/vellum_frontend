import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useRecommendationStore } from '@/stores/recommendationStore';
import { AnimatedScreen } from '@/shared/animations/AnimatedScreen';
import { hapticLight } from '@/shared/lib/haptics';
import type { RootStackParamList, BookSuggestion } from '@/types';
import { colors } from '@/shared/theme/colors';
import { radius, iconSize } from '@/shared/theme/tokens';

export function WishlistScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const wishlist = useRecommendationStore(s => s.wishlist);
  const loading = useRecommendationStore(s => s.loading);
  const fetchWishlist = useRecommendationStore(s => s.fetchWishlist);
  const dismissSuggestion = useRecommendationStore(s => s.dismissSuggestion);

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  const handleDismissFromWishlist = useCallback(async (id: string) => {
    hapticLight();
    await dismissSuggestion(id);
    await fetchWishlist();
  }, [dismissSuggestion, fetchWishlist]);

  const renderItem = useCallback(
    ({ item }: { item: BookSuggestion }) => (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderText}>
            <Text style={styles.title}>{item.title}</Text>
            {item.author && <Text style={styles.author}>{item.author}</Text>}
          </View>
          <TouchableOpacity onPress={() => handleDismissFromWishlist(item.id)}>
            <Icon name="close-circle-outline" size={iconSize.md} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.genreRow}>
          {item.genres.map((g) => (
            <View key={g} style={styles.genreChip}>
              <Text style={styles.genreText}>{g}</Text>
            </View>
          ))}
        </View>

        {item.synopsis && (
          <Text style={styles.synopsis} numberOfLines={3}>
            {item.synopsis}
          </Text>
        )}
      </View>
    ),
    [handleDismissFromWishlist],
  );

  return (
    <AnimatedScreen>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-left" size={iconSize.md} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Quiero leer</Text>
          <View style={styles.backBtn} />
        </View>

        {wishlist.length === 0 && !loading ? (
          <View style={styles.center}>
            <Icon name="bookmark-outline" size={iconSize.xl} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Tu lista está vacía</Text>
            <Text style={styles.emptyText}>
              Explora la sección Descubrir para encontrar tu siguiente lectura.
            </Text>
            <TouchableOpacity
              style={styles.discoverBtn}
              onPress={() => navigation.navigate('Discover')}
            >
              <Text style={styles.discoverBtnText}>Ir a Descubrir</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={wishlist}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  discoverBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: radius.md,
    marginTop: 16,
  },
  discoverBtnText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 16,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardHeaderText: {
    flex: 1,
    paddingRight: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  author: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  genreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  genreChip: {
    backgroundColor: 'rgba(108,99,255,0.10)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  genreText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
  },
  synopsis: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
