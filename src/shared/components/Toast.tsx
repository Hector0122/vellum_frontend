import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ToastMessage, { BaseToastProps } from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const toastConfig = {
  success: ({ text1, text2 }: BaseToastProps) => (
    <View style={[styles.base, styles.success]}>
      <Icon name="check-circle" size={20} color="#00FF88" />
      <View style={styles.textContainer}>
        <Text style={styles.text1} numberOfLines={1}>{text1}</Text>
        {text2 && <Text style={styles.text2} numberOfLines={2}>{text2}</Text>}
      </View>
    </View>
  ),
  error: ({ text1, text2 }: BaseToastProps) => (
    <View style={[styles.base, styles.error]}>
      <Icon name="alert-circle" size={20} color="#FF6B6B" />
      <View style={styles.textContainer}>
        <Text style={styles.text1} numberOfLines={1}>{text1}</Text>
        {text2 && <Text style={styles.text2} numberOfLines={2}>{text2}</Text>}
      </View>
    </View>
  ),
  info: ({ text1, text2 }: BaseToastProps) => (
    <View style={[styles.base, styles.info]}>
      <Icon name="information" size={20} color="#4A4AE9" />
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
    backgroundColor: '#1A2E1A',
    borderLeftWidth: 3,
    borderLeftColor: '#00FF88',
  },
  error: {
    backgroundColor: '#2E1A1A',
    borderLeftWidth: 3,
    borderLeftColor: '#FF6B6B',
  },
  info: {
    backgroundColor: '#1A1A2E',
    borderLeftWidth: 3,
    borderLeftColor: '#4A4AE9',
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  text1: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  text2: {
    fontSize: 13,
    color: '#B0B0CC',
  },
});
