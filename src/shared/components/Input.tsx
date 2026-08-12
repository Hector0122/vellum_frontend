import React from 'react';
import { colors } from '@/shared/theme/colors';
import { radius } from '@/shared/theme/tokens';
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

const InputInner = ({ label, error, style, children: _children, ...props }: InputProps) => {
  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[styles.input, error && styles.inputError, style]}
        placeholderTextColor={colors.textMuted}
        {...props}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};

export const Input = React.memo(InputInner);

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    height: 52,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    color: colors.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputError: {
    borderColor: colors.error,
  },
  error: {
    color: colors.error,
    fontSize: 12,
    marginTop: 2,
  },
});
