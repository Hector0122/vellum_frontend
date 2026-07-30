import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { Button } from '@/shared/components/Button';
import { Input } from '@/shared/components/Input';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/types';
import { colors } from '@/shared/theme/colors';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation }: Props) {
  const { requestPasswordReset, confirmPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [requestLoading, setRequestLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleRequestCode = async () => {
    if (!email) return;
    setRequestLoading(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setRequestLoading(false);
    }
  };

  const handleConfirmReset = async () => {
    if (!code || !newPassword) return;
    setConfirmLoading(true);
    try {
      await confirmPasswordReset(email, code.trim(), newPassword);
      Alert.alert('Success', 'Your password has been reset. Please sign in.', [
        { text: 'OK', onPress: () => navigation.navigate('SignIn') },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setConfirmLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            {sent
              ? `Enter the code we sent to ${email}`
              : "Enter your email and we'll send you a reset code"}
          </Text>
        </View>

        <View style={styles.form}>
          {sent ? (
            <>
              <Input
                label="Reset Code"
                placeholder="123456"
                keyboardType="number-pad"
                maxLength={6}
                value={code}
                onChangeText={setCode}
              />
              <Input
                label="New Password"
                placeholder="At least 8 characters"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <Button
                title="Reset Password"
                loading={confirmLoading}
                onPress={handleConfirmReset}
              />
              <Button
                title="Resend Code"
                variant="secondary"
                loading={requestLoading}
                onPress={handleRequestCode}
              />
            </>
          ) : (
            <>
              <Input
                label="Email"
                placeholder="your@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
              />
              <Button
                title="Send Reset Code"
                loading={requestLoading}
                onPress={handleRequestCode}
              />
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
});
