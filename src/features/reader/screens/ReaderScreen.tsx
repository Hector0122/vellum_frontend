import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useLibraryStore } from '@/stores/libraryStore';
import { EpubReader } from '../components/EpubReader';
import { PdfReader } from '../components/PdfReader';
import type { RootStackParamList } from '@/types';

type ReaderRoute = RouteProp<RootStackParamList, 'Reader'>;

export function ReaderScreen() {
  const route = useRoute<ReaderRoute>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { bookId } = route.params;
  const { books, updateProgress } = useLibraryStore();
  const [ready, setReady] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);

  const book = books.find((b) => b.id === bookId);

  useEffect(() => {
    if (!book) {
      navigation.goBack();
    }
  }, [book, navigation]);

  const handleProgress = useCallback((percent: number) => {
    if (book && percent >= 0) {
      updateProgress(book.id, percent);
    }
  }, [book, updateProgress]);

  const handleReady = useCallback(() => {
    setReady(true);
  }, []);

  const toggleOverlay = useCallback(() => {
    setShowOverlay((prev) => !prev);
  }, []);

  if (!book) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#4A4AE9" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.readerArea}
        activeOpacity={1}
        onPress={toggleOverlay}
      >
        {book.file_type === 'pdf' ? (
          <PdfReader
            fileUrl={book.file_url}
            onProgress={handleProgress}
            onReady={handleReady}
          />
        ) : (
          <EpubReader
            fileUrl={book.file_url}
            onProgress={handleProgress}
            onReady={handleReady}
          />
        )}
      </TouchableOpacity>

      {showOverlay && (
        <View style={styles.overlay}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backText}>{'<'} Back</Text>
          </TouchableOpacity>

          <View style={styles.info}>
            <Text style={styles.title} numberOfLines={1}>{book.title}</Text>
            {book.author && (
              <Text style={styles.author}>{book.author}</Text>
            )}
          </View>

          {!ready && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator color="#4A4AE9" size="large" />
              <Text style={styles.loadingText}>Loading reader...</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#12121A',
  },
  readerArea: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: 'rgba(18,18,26,0.95)',
  },
  backButton: {
    marginBottom: 12,
  },
  backText: {
    fontSize: 16,
    color: '#4A4AE9',
    fontWeight: '600',
  },
  info: {
    gap: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  author: {
    fontSize: 14,
    color: '#B0B0CC',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#B0B0CC',
    fontSize: 14,
  },
});
