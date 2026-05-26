import React from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  type TextInputProps,
} from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, style, ...props }: InputProps) {
  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[styles.input, error && styles.inputError, style]}
        placeholderTextColor="#666680"
        {...props}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  label: {
    color: '#B0B0CC',
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    height: 52,
    backgroundColor: '#2A2A3E',
    borderRadius: 14,
    paddingHorizontal: 16,
    color: '#FFFFFF',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputError: {
    borderColor: '#E94560',
  },
  error: {
    color: '#E94560',
    fontSize: 12,
    marginTop: 2,
  },
});
