import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  TextInput,
  Modal,
  RefreshControl,
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
import { AnimatedScreen } from '@/shared/animations/AnimatedScreen';
import { AnimatedFAB } from '@/shared/components/AnimatedFAB';
import { AnimatedListItem } from '@/shared/components/AnimatedListItem';
import type { Book, RootStackParamList } from '@/types';

interface UploadResponse {
  uploadUrl: string;
  publicUrl: string;
  objectKey: string;
}

type FilterMode = 'all' | 'reading' | 'unread';
type SortMode = 'last' | 'az' | 'progress' | 'added';

const SORT_LABELS: Record<SortMode, string> = {
  last: 'Recent',
  az: 'A — Z',
  progress: 'Progress',
  added: 'Added',
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

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

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

  const handleUpload = async () => {
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
    } catch (err: any) {
      Alert.alert('Upload failed', err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleBookPress = (book: Book) => {
    navigation.navigate('Reader', { bookId: book.id });
  };

  const handleDeleteBook = (book: Book) => {
    Alert.alert('Delete book', `Remove "${book.title}" from your library?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteBook(book.id);
            removeCachedEpub(book.id);
          } catch (err: any) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => signOut(),
      },
    ]);
  };

  const renderBook = ({ item, index }: { item: Book; index: number }) => (
    <AnimatedListItem index={index}>
      <TouchableOpacity
        style={styles.bookCard}
        onPress={() => handleBookPress(item)}
        onLongPress={() => handleDeleteBook(item)}
        activeOpacity={0.7}
      >
        {item.cover_url ? (
          <Image source={{ uri: item.cover_url }} style={styles.coverImage} />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Icon name="book-open-variant" size={24} color="#B0B0CC" />
          </View>
        )}
        <View style={styles.bookInfo}>
          <Text style={styles.bookTitle} numberOfLines={1}>
            {item.title}
          </Text>
          {item.author && <Text style={styles.bookAuthor}>{item.author}</Text>}
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${item.progress_percent}%` },
              ]}
            />
          </View>
        </View>
      </TouchableOpacity>
    </AnimatedListItem>
  );

  return (
    <AnimatedScreen>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.heading}>Library</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.headerBtn}
                onPress={() => navigation.navigate('Highlights')}
              >
                <Icon name="marker" size={24} color="#B0B0CC" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerBtn}
                onPress={() => setShowProfile(true)}
              >
                <Icon name="account-circle-outline" size={24} color="#B0B0CC" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Search */}
          <View style={styles.searchRow}>
            <Icon name="magnify" size={18} color="#666680" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by title or author..."
              placeholderTextColor="#666680"
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Icon name="close-circle" size={18} color="#666680" />
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
              <Icon name="sort-variant" size={18} color="#B0B0CC" />
              <Text style={styles.sortLabel}>{SORT_LABELS[sort]}</Text>
              <Icon
                name={showSort ? 'chevron-up' : 'chevron-down'}
                size={16}
                color="#666680"
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
                    <Icon name="check" size={16} color="#4A4AE9" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Book list */}
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color="#4A4AE9" size="large" />
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.center}>
              <Icon name="bookshelf" size={48} color="#666680" />
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
              refreshControl={
                <RefreshControl
                  refreshing={loading}
                  onRefresh={fetchBooks}
                  tintColor="#4A4AE9"
                  colors={['#4A4AE9']}
                />
              }
            />
          )}
        </View>

        {/* FAB */}
        <AnimatedFAB
          icon={uploading ? 'loading' : 'plus'}
          onPress={handleUpload}
          backgroundColor="#4A4AE9"
          color="#FFFFFF"
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
                  <Icon name="close" size={24} color="#B0B0CC" />
                </TouchableOpacity>
              </View>

              <View style={styles.profileSection}>
                <View style={styles.avatar}>
                  <Icon name="account" size={36} color="#4A4AE9" />
                </View>
                <Text style={styles.displayName}>
                  {user?.display_name || user?.email?.split('@')[0]}
                </Text>
                <Text style={styles.email}>{user?.email}</Text>
              </View>

              <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                <Icon name="logout" size={20} color="#FF6B6B" />
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
    backgroundColor: '#12121A',
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
    color: '#FFFFFF',
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
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4A4AE9',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#4A4AE9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E2E',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
    gap: 10,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
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
    backgroundColor: '#1E1E2E',
  },
  chipActive: {
    backgroundColor: '#4A4AE9',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#B0B0CC',
  },
  chipTextActive: {
    color: '#FFFFFF',
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
    color: '#B0B0CC',
  },
  sortDropdown: {
    backgroundColor: '#1E1E2E',
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
    color: '#B0B0CC',
  },
  sortOptionTextActive: {
    color: '#4A4AE9',
    fontWeight: '600',
  },
  list: {
    gap: 10,
    paddingBottom: 90,
  },
  bookCard: {
    flexDirection: 'row',
    backgroundColor: '#1E1E2E',
    borderRadius: 12,
    padding: 12,
    gap: 12,
    alignItems: 'center',
  },
  coverImage: {
    width: 48,
    height: 64,
    borderRadius: 6,
    backgroundColor: '#2A2A3E',
  },
  coverPlaceholder: {
    width: 48,
    height: 64,
    backgroundColor: '#2A2A3E',
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
    color: '#FFFFFF',
  },
  bookAuthor: {
    fontSize: 13,
    color: '#B0B0CC',
  },
  progressBar: {
    height: 3,
    backgroundColor: '#2A2A3E',
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4A4AE9',
    borderRadius: 2,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyText: {
    fontSize: 14,
    color: '#B0B0CC',
    textAlign: 'center',
  },
  modalSafe: {
    flex: 1,
    backgroundColor: '#12121A',
  },
  modalContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1E1E2E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  displayName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  email: {
    fontSize: 14,
    color: '#B0B0CC',
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
    color: '#FF6B6B',
  },
});
