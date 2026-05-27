import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/shared/theme/colors';

export function SearchScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Search</Text>
      <Text style={styles.subtitle}>Coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.white,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});
