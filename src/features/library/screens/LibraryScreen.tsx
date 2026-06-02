import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  RefreshControl,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { pick } from '@react-native-documents/picker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { useLibraryStore } from '@/stores/libraryStore';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/shared/lib/api';
import { removeCachedEpub } from '@/shared/lib/epubCache';
import { analytics } from '@/shared/lib/analytics';
import { hapticLight, hapticSuccess } from '@/shared/lib/haptics';
import { showToast } from '@/shared/components/Toast';
import { useReadingStats } from '@/shared/hooks/useReadingStats';
import { AnimatedScreen } from '@/shared/animations/AnimatedScreen';
import { AnimatedFAB } from '@/shared/components/AnimatedFAB';
import { BookCard } from '@/features/library/components/BookCard';
import type { Book, RootStackParamList } from '@/types';
import { colors } from '@/shared/theme/colors';

interface UploadResponse {
  uploadUrl: string;
  publicUrl: string;
  objectKey: string;
}

type FilterMode = 'all' | 'reading' | 'unread';
type SortMode = 'last' | 'az' | 'progress' | 'added';

const SORT_LABELS: Record<SortMode, string> = {
  last: 'Recent',
  az: 'A \u2014 Z',
  progress: 'Progress',
  added: 'Added',
};

const FLATLIST_CONFIG = {
  initialNumToRender: 10,
  maxToRenderPerBatch: 10,
  windowSize: 5,
  removeClippedSubviews: true,
};

export function LibraryScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { books, loading, fetchBooks, deleteBook } = useLibraryStore();
  const { user, signOut } = useAuthStore();

  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [sort, setSort] = useState<SortMode>('last');
  const [showSort, setShowSort] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const { streak, streakChanged, fetchStreak } =
    useReadingStats();
  const flameScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fetchBooks();
    fetchStreak();
    analytics.trackPageView('Library');
  }, [fetchBooks, fetchStreak]);

  useEffect(() => {
    if (streakChanged && streak > 0) {
      Animated.sequence([
        Animated.timing(flameScale, {
          toValue: 1.4,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(flameScale, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [streak, streakChanged, flameScale]);

  const filtered = useMemo(() => {
    let result = [...books];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        b =>
          b.title.toLowerCase().includes(q) ||
          (b.author && b.author.toLowerCase().includes(q)),
      );
    }

    if (filter === 'reading') {
      result = result.filter(
        b => b.progress_percent > 0 && b.progress_percent < 100,
      );
    } else if (filter === 'unread') {
      result = result.filter(b => b.progress_percent === 0);
    }

    switch (sort) {
      case 'az':
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'progress':
        result.sort((a, b) => b.progress_percent - a.progress_percent);
        break;
      case 'added':
        result.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        break;
      case 'last':
      default:
        result.sort(
          (a, b) =>
            new Date(b.last_opened_at || b.created_at).getTime() -
            new Date(a.last_opened_at || a.created_at).getTime(),
        );
        result.reverse();
        break;
    }

    return result;
  }, [books, search, filter, sort]);

  const handleUpload = useCallback(async () => {
    try {
      const [file] = await pick({
        type: ['application/epub+zip', 'application/pdf'],
      });

      if (!file.name) return;
      const fileType = file.type?.includes('pdf') ? 'pdf' : 'epub';
      const title = file.name.replace(/\.(epub|pdf)$/i, '');

      setUploading(true);

      const { uploadUrl, publicUrl } = await api.post<UploadResponse>(
        '/api/upload',
        {
          fileName: file.name,
          fileType,
        },
      );

      await ReactNativeBlobUtil.fetch(
        'PUT',
        uploadUrl,
        {
          'Content-Type':
            file.type ||
            (fileType === 'pdf' ? 'application/pdf' : 'application/epub+zip'),
        },
        ReactNativeBlobUtil.wrap(file.uri),
      );

      const { book } = await api.post<{ book: Book }>('/api/books', {
        title,
        file_url: publicUrl,
        file_type: fileType,
      });

      if (fileType === 'epub') {
        api.post('/api/upload/cover', { bookId: book.id }).catch(() => {});
      }

      await fetchBooks();
      hapticSuccess();
      showToast('success', 'Book uploaded', `"${title}" added to your library`);
      analytics.trackEvent('book_upload', { file_type: fileType });
    } catch (err: any) {
      showToast('error', 'Upload failed', err.message);
    } finally {
      setUploading(false);
    }
  }, [fetchBooks]);

  const handleBookPress = useCallback((book: Book) => {
    hapticLight();
    analytics.trackBookOpen(book.id, book.title);
    navigation.navigate('Reader', { bookId: book.id });
  }, [navigation]);

  const handleDeleteBook = useCallback((book: Book) => {
    hapticLight();
    Alert.alert('Delete book', `Remove "${book.title}" from your library?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteBook(book.id);
            removeCachedEpub(book.id);
            showToast('info', 'Book deleted', `"${book.title}" removed`);
            analytics.trackEvent('book_delete', { book_id: book.id });
          } catch (err: any) {
            showToast('error', 'Error', err.message);
          }
        },
      },
    ]);
  }, [deleteBook]);

  const handleLogout = useCallback(() => {
    Alert.alert('Log out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => signOut(),
      },
    ]);
  }, [signOut]);

  const renderBook = useCallback(
    ({ item, index }: { item: Book; index: number }) => (
      <BookCard
        item={item}
        index={index}
        onPress={handleBookPress}
        onLongPress={handleDeleteBook}
      />
    ),
    [handleBookPress, handleDeleteBook],
  );

  return (
    <AnimatedScreen>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.heading}>Library</Text>
              <Animated.View
                style={[
                  styles.streakBadge,
                  { transform: [{ scale: flameScale }] },
                ]}
              >
                <Icon
                  name="fire"
                  size={18}
                  color={streak > 0 ? '#FF6B35' : colors.textMuted}
                />
                {streak > 0 && (
                  <Text style={styles.streakText}>{streak}</Text>
                )}
              </Animated.View>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.headerBtn}
                onPress={() => navigation.navigate('WidgetConfig')}
              >
                <Icon name="widget-outline" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerBtn}
                onPress={() => navigation.navigate('Highlights')}
              >
                <Icon name="marker" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerBtn}
                onPress={() => setShowProfile(true)}
              >
                <Icon name="account-circle-outline" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Search */}
          <View style={styles.searchRow}>
              <Icon name="magnify" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by title or author..."
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Icon name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Filters + Sort */}
          <View style={styles.toolbar}>
            <View style={styles.filterRow}>
              {(['all', 'reading', 'unread'] as FilterMode[]).map(f => (
                <TouchableOpacity
                  key={f}
                  style={[styles.chip, filter === f && styles.chipActive]}
                  onPress={() => setFilter(f)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      filter === f && styles.chipTextActive,
                    ]}
                  >
                    {f === 'all'
                      ? 'All'
                      : f === 'reading'
                      ? 'Reading'
                      : 'Unread'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.sortBtn}
              onPress={() => setShowSort(!showSort)}
            >
              <Icon name="sort-variant" size={18} color={colors.textSecondary} />
              <Text style={styles.sortLabel}>{SORT_LABELS[sort]}</Text>
              <Icon
                name={showSort ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          </View>

          {/* Sort dropdown */}
          {showSort && (
            <View style={styles.sortDropdown}>
              {(Object.keys(SORT_LABELS) as SortMode[]).map(mode => (
                <TouchableOpacity
                  key={mode}
                  style={[
                    styles.sortOption,
                    sort === mode && styles.sortOptionActive,
                  ]}
                  onPress={() => {
                    setSort(mode);
                    setShowSort(false);
                  }}
                >
                  <Text
                    style={[
                      styles.sortOptionText,
                      sort === mode && styles.sortOptionTextActive,
                    ]}
                  >
                    {SORT_LABELS[mode]}
                  </Text>
                  {sort === mode && (
                    <Icon name="check" size={16} color={colors.accent} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Book list */}
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.accent} size="large" />
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.center}>
              <Icon name="bookshelf" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>
                {books.length === 0 ? 'No books yet' : 'No matches'}
              </Text>
              <Text style={styles.emptyText}>
                {books.length === 0
                  ? 'Tap + to upload an EPUB'
                  : 'Try a different search or filter'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={item => item.id}
              renderItem={renderBook}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              initialNumToRender={FLATLIST_CONFIG.initialNumToRender}
              maxToRenderPerBatch={FLATLIST_CONFIG.maxToRenderPerBatch}
              windowSize={FLATLIST_CONFIG.windowSize}
              removeClippedSubviews={FLATLIST_CONFIG.removeClippedSubviews}
              refreshControl={
                <RefreshControl
                  refreshing={loading}
                  onRefresh={fetchBooks}
                  tintColor={colors.accent}
                  colors={[colors.accent]}
                />
              }
            />
          )}
        </View>

        {/* FAB */}
        <AnimatedFAB
          icon={uploading ? 'loading' : 'plus'}
          onPress={handleUpload}
          backgroundColor={colors.accent}
          color={colors.white}
        />

        {/* Profile Modal */}
        <Modal
          visible={showProfile}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowProfile(false)}
        >
          <SafeAreaView style={styles.modalSafe} edges={['bottom']}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Profile</Text>
                <TouchableOpacity onPress={() => setShowProfile(false)}>
                  <Icon name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.profileSection}>
                <View style={styles.avatar}>
                  <Icon name="account" size={36} color={colors.accent} />
                </View>
                <Text style={styles.displayName}>
                  {user?.display_name || user?.email?.split('@')[0]}
                </Text>
                <Text style={styles.email}>{user?.email}</Text>
              </View>

              <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                <Icon name="logout" size={20} color={colors.destructive} />
                <Text style={styles.logoutText}>Log out</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  heading: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,107,53,0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 2,
  },
  streakText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF6B35',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    padding: 0,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  chipActive: {
    backgroundColor: colors.accent,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.white,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  sortLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  sortDropdown: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  sortOptionActive: {
    backgroundColor: 'rgba(74,74,233,0.15)',
  },
  sortOptionText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  sortOptionTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyTitle: {
    color: colors.textSecondary,
    fontSize: 17,
    fontWeight: '600',
    marginTop: 16,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  list: {
    gap: 10,
    paddingBottom: 20,
  },
  modalSafe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  modalContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 8,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  displayName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  email: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginTop: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255,107,107,0.12)',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.destructive,
  },
});
