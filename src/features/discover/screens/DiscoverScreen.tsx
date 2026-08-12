import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useRecommendationStore } from '@/stores/recommendationStore';
import { AnimatedScreen } from '@/shared/animations/AnimatedScreen';
import { showToast } from '@/shared/components/Toast';
import { hapticLight, hapticSuccess } from '@/shared/lib/haptics';
import type { RootStackParamList, BookSuggestion } from '@/types';
import { colors } from '@/shared/theme/colors';
import { radius, iconSize } from '@/shared/theme/tokens';

export function DiscoverScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    suggestions,
    loading,
    generating,
    fetchSuggestions,
    generateSuggestions,
    markAsWantToRead,
    dismissSuggestion,
  } = useRecommendationStore();

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const handleGenerate = async () => {
    hapticLight();
    try {
      await generateSuggestions();
      hapticSuccess();
    } catch {
      showToast('error', 'Error', 'No se pudieron generar recomendaciones');
    }
  };

  const handleWantToRead = async (s: BookSuggestion) => {
    hapticSuccess();
    await markAsWantToRead(s.id);
    showToast('success', 'Guardado', `"${s.title}" añadido a Quiero leer`);
  };

  const handleDismiss = async (s: BookSuggestion) => {
    hapticLight();
    await dismissSuggestion(s.id);
  };

  return (
    <AnimatedScreen>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-left" size={iconSize.md} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Descubre</Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {loading || generating ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.accent} size="large" />
              <Text style={styles.loadingText}>
                {generating ? 'La IA está pensando...' : 'Cargando...'}
              </Text>
            </View>
          ) : suggestions.length === 0 ? (
            <View style={styles.center}>
              <Icon name="compass-outline" size={iconSize.xl} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Sin recomendaciones activas</Text>
              <Text style={styles.emptyText}>
                Genera nuevas sugerencias basadas en tus libros leídos.
              </Text>
              <TouchableOpacity style={styles.generateBtn} onPress={handleGenerate}>
                <Icon name="sparkles" size={iconSize.md} color={colors.white} />
                <Text style={styles.generateBtnText}>Generar recomendaciones</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.subtitle}>Basado en tus libros leídos</Text>
              {suggestions.map((s) => (
                <View key={s.id} style={styles.card}>
                  <Text style={styles.title}>{s.title}</Text>
                  {s.author && <Text style={styles.author}>{s.author}</Text>}

                  <View style={styles.genreRow}>
                    {s.genres.map((g) => (
                      <View key={g} style={styles.genreChip}>
                        <Text style={styles.genreText}>{g}</Text>
                      </View>
                    ))}
                  </View>

                  {s.synopsis && (
                    <Text style={styles.synopsis} numberOfLines={4}>
                      {s.synopsis}
                    </Text>
                  )}

                  {s.reason && (
                    <View style={styles.reasonBox}>
                      <Icon name="lightbulb-on-outline" size={iconSize.sm} color={colors.accent} />
                      <Text style={styles.reasonText}>{s.reason}</Text>
                    </View>
                  )}

                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={styles.wantBtn}
                      onPress={() => handleWantToRead(s)}
                    >
                      <Icon name="bookmark-plus-outline" size={iconSize.sm} color={colors.white} />
                      <Text style={styles.wantBtnText}>Quiero leer</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.dismissBtn}
                      onPress={() => handleDismiss(s)}
                    >
                      <Text style={styles.dismissText}>Descartar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              <TouchableOpacity
                style={styles.regenerateBtn}
                onPress={handleGenerate}
              >
                <Icon name="refresh" size={iconSize.sm} color={colors.accent} />
                <Text style={styles.regenerateText}>Generar nuevas</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
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
  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 16,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
    gap: 12,
    paddingHorizontal: 24,
  },
  loadingText: {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 8,
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
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: radius.md,
    marginTop: 16,
  },
  generateBtnText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500',
    marginBottom: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 18,
    gap: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  author: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: -6,
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
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: 2,
  },
  reasonBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(108,99,255,0.06)',
    borderRadius: radius.sm,
    padding: 10,
    marginTop: 4,
  },
  reasonText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  wantBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    paddingVertical: 11,
    borderRadius: radius.md,
  },
  wantBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  dismissBtn: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: radius.md,
    backgroundColor: colors.border,
  },
  dismissText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  regenerateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 8,
  },
  regenerateText: {
    fontSize: 14,
    color: colors.accent,
    fontWeight: '600',
  },
});
