import React, { useState } from 'react';
import {
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useAuth } from '../hooks/useAuth';
import { Button } from '@/shared/components/Button';
import { Input } from '@/shared/components/Input';
import { AnimatedScreen } from '@/shared/animations/AnimatedScreen';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/types';
import { colors } from '@/shared/theme/colors';
import { fontFamily } from '@/shared/theme/tokens';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

export function SignInScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) return;
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatedScreen>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            style={styles.header}
            entering={FadeInDown.delay(100).springify()}
          >
            <Text style={styles.title}>Vellum</Text>
            <Text style={styles.subtitle}>Welcome back</Text>
          </Animated.View>

          <Animated.View
            style={styles.form}
            entering={FadeInUp.delay(200).springify()}
          >
            <Input
              label="Email"
              placeholder="your@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
            />
            <Input
              label="Password"
              placeholder="Your password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <Button title="Sign In" loading={loading} onPress={handleSignIn} />
            <Button
              title="Forgot password?"
              variant="outline"
              onPress={() => navigation.navigate('ForgotPassword')}
            />
          </Animated.View>

          <Animated.View
            style={styles.footer}
            entering={FadeInUp.delay(300).springify()}
          >
            <Text style={styles.footerText}>Don't have an account?</Text>
            <Button
              title="Sign Up"
              variant="secondary"
              onPress={() => navigation.navigate('SignUp')}
            />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AnimatedScreen>
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
    fontFamily: fontFamily.display,
    fontSize: 36,
    color: colors.accent,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 8,
  },
  form: {
    gap: 16,
  },
  footer: {
    alignItems: 'center',
    marginTop: 32,
    gap: 12,
  },
  footerText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
});
