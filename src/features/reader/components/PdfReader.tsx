import React, { useCallback, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import Pdf from 'react-native-pdf';

interface PdfReaderProps {
  fileUrl: string;
  onProgress?: (percent: number) => void;
  onReady?: () => void;
}

export function PdfReader({ fileUrl, onProgress, onReady }: PdfReaderProps) {
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleLoadComplete = useCallback((numberOfPages: number) => {
    setTotalPages(numberOfPages);
    setLoading(false);
    onReady?.();
  }, [onReady]);

  const handlePageChanged = useCallback((page: number) => {
    if (totalPages > 0) {
      const percent = Math.round((page / totalPages) * 100);
      onProgress?.(percent);
    }
  }, [totalPages, onProgress]);

  const handleError = useCallback((err: object) => {
    setError(String((err as any).message || err));
    setLoading(false);
  }, []);

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator color="#4A4AE9" size="large" />
          <Text style={styles.loaderText}>Loading PDF...</Text>
        </View>
      )}
      {error && (
        <View style={styles.loader}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <Pdf
        source={{ uri: fileUrl, cache: true }}
        onLoadComplete={handleLoadComplete}
        onPageChanged={handlePageChanged}
        onError={handleError}
        style={styles.pdf}
        enablePaging
        fitPolicy={0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#12121A' },
  pdf: { flex: 1, backgroundColor: '#12121A' },
  loader: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    gap: 12,
  },
  loaderText: {
    color: '#B0B0CC',
    fontSize: 14,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
