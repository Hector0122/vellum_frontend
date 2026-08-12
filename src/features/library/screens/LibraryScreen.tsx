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
import { api } from '@/shared/lib/api';
import { removeCachedEpub } from '@/shared/lib/epubCache';
import { analytics } from '@/shared/lib/analytics';
import { hapticLight, hapticSuccess } from '@/shared/lib/haptics';
import { showToast } from '@/shared/components/Toast';
import { useReadingStats } from '@/shared/hooks/useReadingStats';
import { AnimatedScreen } from '@/shared/animations/AnimatedScreen';
import { AnimatedFAB } from '@/shared/components/AnimatedFAB';
import { BookCard } from '@/features/library/components/BookCard';
import {
  useLibraryFilters,
  SORT_LABELS,
  type FilterMode,
  type SortMode,
} from '@/features/library/hooks/useLibraryFilters';
import type { Book, RootStackParamList } from '@/types';
import { colors } from '@/shared/theme/colors';
import { radius, iconSize } from '@/shared/theme/tokens';

interface UploadResponse {
  uploadUrl: string;
  publicUrl: string;
  objectKey: string;
}

const FLATLIST_CONFIG = {
  initialNumToRender: 10,
  maxToRenderPerBatch: 10,
  windowSize: 5,
  removeClippedSubviews: true,
};

export function LibraryScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const books = useLibraryStore(s => s.books);
  const loading = useLibraryStore(s => s.loading);
  const fetchBooks = useLibraryStore(s => s.fetchBooks);
  const deleteBook = useLibraryStore(s => s.deleteBook);
  const markAsRead = useLibraryStore(s => s.markAsRead);
  const updatePages = useLibraryStore(s => s.updatePages);

  const [uploading, setUploading] = useState(false);
  const { search, setSearch, filter, setFilter, sort, setSort, filtered } =
    useLibraryFilters(books);
  const [showSort, setShowSort] = useState(false);
  const [contextBook, setContextBook] = useState<Book | null>(null);
  const [showContext, setShowContext] = useState(false);
  const [showEditPages, setShowEditPages] = useState(false);
  const [editCurrentPage, setEditCurrentPage] = useState('');
  const [editTotalPages, setEditTotalPages] = useState('');
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

  const refreshCtrl = useMemo(
    () => (
      <RefreshControl
        refreshing={loading}
        onRefresh={fetchBooks}
        tintColor={colors.accent}
        colors={[colors.accent]}
      />
    ),
    [loading, fetchBooks],
  );

  const handleUpload = useCallback(async () => {
    try {
      const [file] = await pick({
        type: ['application/epub+zip', 'application/pdf'],
      });

      if (!file.name) return;
      const fileType = file.type?.includes('pdf') ? 'pdf' : 'epub';
      const title = file.name.replace(/\.(epub|pdf)$/i, '');

      // Check for duplicate title
      const duplicate = useLibraryStore.getState().books.find(
        (b) => b.title.toLowerCase() === title.toLowerCase(),
      );
      if (duplicate) {
        Alert.alert(
          'Libro duplicado',
          `Ya tienes "${duplicate.title}" en tu biblioteca.`,
          [{ text: 'OK' }],
        );
        return;
      }

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

  const handleContextMenu = useCallback((book: Book) => {
    hapticLight();
    setContextBook(book);
    setShowContext(true);
  }, []);

  const handleMarkAsRead = useCallback(async () => {
    if (!contextBook) return;
    setShowContext(false);
    try {
      await markAsRead(contextBook.id);
      hapticSuccess();
      showToast('success', 'Marked as read', `"${contextBook.title}" marcado como leído`);
      analytics.trackEvent('book_mark_read', { book_id: contextBook.id });
    } catch (err: any) {
      showToast('error', 'Error', err.message);
    }
  }, [contextBook, markAsRead]);

  const handleOpenEditPages = useCallback(() => {
    if (!contextBook) return;
    setShowContext(false);
    setEditCurrentPage(String(contextBook.current_page || 0));
    setEditTotalPages(String(contextBook.total_pages || ''));
    setShowEditPages(true);
  }, [contextBook]);

  const handleSavePages = useCallback(async () => {
    if (!contextBook) return;
    const currentPage = parseInt(editCurrentPage, 10) || 0;
    const totalPages = editTotalPages ? parseInt(editTotalPages, 10) || 0 : undefined;
    try {
      await updatePages(contextBook.id, currentPage, totalPages);
      setShowEditPages(false);
      hapticSuccess();
      showToast('success', 'Pages updated');
      analytics.trackEvent('book_update_pages', { book_id: contextBook.id });
    } catch (err: any) {
      showToast('error', 'Error', err.message);
    }
  }, [contextBook, editCurrentPage, editTotalPages, updatePages]);

  const handleDeleteFromMenu = useCallback(async () => {
    if (!contextBook) return;
    setShowContext(false);
    hapticLight();
    Alert.alert('Delete book', `Remove "${contextBook.title}" from your library?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteBook(contextBook.id);
            removeCachedEpub(contextBook.id);
            showToast('info', 'Book deleted', `"${contextBook.title}" removed`);
            analytics.trackEvent('book_delete', { book_id: contextBook.id });
          } catch (err: any) {
            showToast('error', 'Error', err.message);
          }
        },
      },
    ]);
  }, [contextBook, deleteBook]);

  const renderBook = useCallback(
    ({ item, index }: { item: Book; index: number }) => (
      <BookCard
        item={item}
        index={index}
        onPress={handleBookPress}
        onLongPress={handleContextMenu}
      />
    ),
    [handleBookPress, handleContextMenu],
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
                  size={iconSize.sm}
                  color={streak > 0 ? colors.streak : colors.textMuted}
                />
                {streak > 0 && (
                  <Text style={styles.streakText}>{streak}</Text>
                )}
              </Animated.View>
            </View>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => navigation.navigate('Profile')}
            >
              <Icon name="account-circle-outline" size={iconSize.lg} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={styles.searchRow}>
              <Icon name="magnify" size={iconSize.sm} color={colors.textMuted} />
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
                <Icon name="close-circle" size={iconSize.sm} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Filters + Sort */}
          <View style={styles.toolbar}>
            <View style={styles.filterRow}>
              {(['reading', 'all', 'unread', 'read'] as FilterMode[]).map(f => (
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
                      : f === 'unread'
                      ? 'Unread'
                      : 'Read'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.sortBtn}
              onPress={() => setShowSort(!showSort)}
            >
              <Icon name="sort-variant" size={iconSize.sm} color={colors.textSecondary} />
              <Text style={styles.sortLabel}>{SORT_LABELS[sort]}</Text>
              <Icon
                name={showSort ? 'chevron-up' : 'chevron-down'}
                size={iconSize.sm}
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
                    <Icon name="check" size={iconSize.sm} color={colors.accent} />
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
              <Icon name="bookshelf" size={iconSize.xl} color={colors.textMuted} />
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
              refreshControl={refreshCtrl}
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

        {/* Context Menu Modal */}
        <Modal
          visible={showContext}
          transparent
          animationType="fade"
          onRequestClose={() => setShowContext(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowContext(false)}
          >
            <View style={styles.contextMenu}>
              {contextBook && contextBook.status !== 'read' && (
                <TouchableOpacity style={styles.contextOption} onPress={handleMarkAsRead}>
                  <Icon name="check-circle-outline" size={iconSize.md} color={colors.readIndicator} />
                  <Text style={styles.contextOptionText}>Marcar como leído</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.contextOption} onPress={handleOpenEditPages}>
                <Icon name="book-open-page-variant-outline" size={iconSize.md} color={colors.accent} />
                <Text style={styles.contextOptionText}>Editar páginas</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.contextOption} onPress={handleDeleteFromMenu}>
                <Icon name="delete-outline" size={iconSize.md} color={colors.destructive} />
                <Text style={[styles.contextOptionText, { color: colors.destructive }]}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Edit Pages Modal */}
        <Modal
          visible={showEditPages}
          transparent
          animationType="fade"
          onRequestClose={() => setShowEditPages(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowEditPages(false)}
          >
            <View style={styles.pagesModal} onStartShouldSetResponder={() => true}>
              <Text style={styles.pagesModalTitle}>Editar páginas</Text>
              {contextBook && (
                <Text style={styles.pagesModalSubtitle}>{contextBook.title}</Text>
              )}

              <View style={styles.pagesInputRow}>
                <View style={styles.pagesInputGroup}>
                  <Text style={styles.pagesLabel}>Página actual</Text>
                  <TextInput
                    style={styles.pagesInput}
                    value={editCurrentPage}
                    onChangeText={setEditCurrentPage}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <Text style={styles.pagesSeparator}>/</Text>
                <View style={styles.pagesInputGroup}>
                  <Text style={styles.pagesLabel}>Total páginas</Text>
                  <TextInput
                    style={styles.pagesInput}
                    value={editTotalPages}
                    onChangeText={setEditTotalPages}
                    keyboardType="number-pad"
                    placeholder="—"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              <View style={styles.pagesActions}>
                <TouchableOpacity
                  style={styles.pagesCancelBtn}
                  onPress={() => setShowEditPages(false)}
                >
                  <Text style={styles.pagesCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.pagesSaveBtn} onPress={handleSavePages}>
                  <Text style={styles.pagesSaveText}>Guardar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
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
    borderRadius: radius.sm,
    gap: 2,
  },
  streakText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.streak,
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
    borderRadius: radius.md,
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
    borderRadius: radius.pill,
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
    borderRadius: radius.md,
    padding: 4,
    marginBottom: 12,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.sm,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  contextMenu: {
    backgroundColor: colors.elevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 4,
  },
  contextOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: radius.md,
  },
  contextOptionText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  pagesModal: {
    backgroundColor: colors.elevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  pagesModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  pagesModalSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  pagesInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    marginBottom: 24,
  },
  pagesInputGroup: {
    flex: 1,
  },
  pagesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  pagesInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  pagesSeparator: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textMuted,
    paddingBottom: 12,
  },
  pagesActions: {
    flexDirection: 'row',
    gap: 12,
  },
  pagesCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  pagesCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  pagesSaveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  pagesSaveText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.white,
  },
});
