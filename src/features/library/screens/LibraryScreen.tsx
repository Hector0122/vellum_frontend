import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { pick } from '@react-native-documents/picker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { useLibraryStore } from '@/stores/libraryStore';
import { api, getToken } from '@/shared/lib/api';
import type { Book, RootStackParamList } from '@/types';

interface UploadResponse {
  uploadUrl: string;
  publicUrl: string;
  objectKey: string;
}

const FILE_TYPES = ['application/epub+zip', 'application/pdf'];

export function LibraryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { books, loading, fetchBooks } = useLibraryStore();
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  const handleUpload = async () => {
    try {
      const [file] = await pick({
        type: ['application/epub+zip', 'application/pdf'],
      });

      if (!file.name) return;
      const fileType = file.type?.includes('pdf') ? 'pdf' : 'epub';
      const title = file.name.replace(/\.(epub|pdf)$/i, '');

      setUploading(true);

      const { uploadUrl, publicUrl } = await api.post<UploadResponse>('/api/upload', {
        fileName: file.name,
        fileType,
      });

      const token = await getToken();

      await ReactNativeBlobUtil.fetch('PUT', uploadUrl, {
        'Content-Type': file.type || (fileType === 'pdf' ? 'application/pdf' : 'application/epub+zip'),
      }, ReactNativeBlobUtil.wrap(file.uri));

      await api.post('/api/books', {
        title,
        file_url: publicUrl,
        file_type: fileType,
      });

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

  const renderBook = ({ item }: { item: Book }) => (
    <TouchableOpacity
      style={styles.bookCard}
      onPress={() => handleBookPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.coverPlaceholder}>
        <Text style={styles.coverEmoji}>📖</Text>
      </View>
      <View style={styles.bookInfo}>
        <Text style={styles.bookTitle} numberOfLines={2}>
          {item.title}
        </Text>
        {item.author && (
          <Text style={styles.bookAuthor}>{item.author}</Text>
        )}
        <View style={styles.progressBar}>
          <View
            style={[styles.progressFill, { width: `${item.progress_percent}%` }]}
          />
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>Your Library</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleUpload}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.addButtonText}>+</Text>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#4A4AE9" size="large" />
        </View>
      ) : books.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>📚</Text>
          <Text style={styles.emptyTitle}>No books yet</Text>
          <Text style={styles.emptyText}>
            Tap + to upload an EPUB or PDF
          </Text>
        </View>
      ) : (
        <FlatList
          data={books}
          keyExtractor={(item) => item.id}
          renderItem={renderBook}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#12121A',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4A4AE9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    fontSize: 28,
    color: '#FFFFFF',
    lineHeight: 30,
  },
  list: {
    gap: 12,
    paddingBottom: 24,
  },
  bookCard: {
    flexDirection: 'row',
    backgroundColor: '#1E1E2E',
    borderRadius: 16,
    padding: 14,
    gap: 14,
    alignItems: 'center',
  },
  coverPlaceholder: {
    width: 60,
    height: 80,
    backgroundColor: '#2A2A3E',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverEmoji: {
    fontSize: 28,
  },
  bookInfo: {
    flex: 1,
    gap: 4,
  },
  bookTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bookAuthor: {
    fontSize: 14,
    color: '#B0B0CC',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#2A2A3E',
    borderRadius: 2,
    marginTop: 8,
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
  emptyEmoji: {
    fontSize: 48,
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
});
