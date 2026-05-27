import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ToastMessage, { BaseToastProps } from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '@/shared/theme/colors';

const toastConfig = {
  success: ({ text1, text2 }: BaseToastProps) => (
    <View style={[styles.base, styles.success]}>
      <Icon name="check-circle" size={20} color={colors.success} />
      <View style={styles.textContainer}>
        <Text style={styles.text1} numberOfLines={1}>{text1}</Text>
        {text2 && <Text style={styles.text2} numberOfLines={2}>{text2}</Text>}
      </View>
    </View>
  ),
  error: ({ text1, text2 }: BaseToastProps) => (
    <View style={[styles.base, styles.error]}>
      <Icon name="alert-circle" size={20} color={colors.destructive} />
      <View style={styles.textContainer}>
        <Text style={styles.text1} numberOfLines={1}>{text1}</Text>
        {text2 && <Text style={styles.text2} numberOfLines={2}>{text2}</Text>}
      </View>
    </View>
  ),
  info: ({ text1, text2 }: BaseToastProps) => (
    <View style={[styles.base, styles.info]}>
      <Icon name="information" size={20} color={colors.accent} />
      <View style={styles.textContainer}>
        <Text style={styles.text1} numberOfLines={1}>{text1}</Text>
        {text2 && <Text style={styles.text2} numberOfLines={2}>{text2}</Text>}
      </View>
    </View>
  ),
};

export function Toast() {
  return <ToastMessage config={toastConfig} />;
}

export function showToast(type: 'success' | 'error' | 'info', text1: string, text2?: string) {
  ToastMessage.show({ type, text1, text2, visibilityTime: 3000, topOffset: 50 });
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 10,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  success: {
    backgroundColor: 'rgba(0,255,136,0.08)',
    borderLeftWidth: 3,
    borderLeftColor: colors.success,
  },
  error: {
    backgroundColor: 'rgba(255,107,107,0.08)',
    borderLeftWidth: 3,
    borderLeftColor: colors.destructive,
  },
  info: {
    backgroundColor: 'rgba(108,99,255,0.08)',
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  text1: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
  },
  text2: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});
