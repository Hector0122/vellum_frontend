import React, { useEffect, useRef } from 'react';
import { StatusBar, Linking } from 'react-native';
import { NavigationContainer, type NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { SignInScreen } from '@/features/auth/screens/SignInScreen';
import { SignUpScreen } from '@/features/auth/screens/SignUpScreen';
import { ForgotPasswordScreen } from '@/features/auth/screens/ForgotPasswordScreen';
import { LibraryScreen } from '@/features/library/screens/LibraryScreen';
import { HighlightsScreen } from '@/features/library/screens/HighlightsScreen';
import { ReaderScreen } from '@/features/reader/screens/ReaderScreen';
import { WidgetConfigScreen } from '@/features/widget/screens/WidgetConfigScreen';
import { colors } from '@/shared/theme/colors';
import type { RootStackParamList, AuthStackParamList } from '@/types';

const linking = {
  prefixes: ['vellum://'],
  config: {
    screens: {
      Reader: 'reader/:bookId',
    },
  },
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <AuthStack.Screen name="SignIn" component={SignInScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
      <AuthStack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
      />
    </AuthStack.Navigator>
  );
}

export function AppNavigator() {
  const { isAuthenticated, loading, loadSession } = useAuth();
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const sub = Linking.addEventListener('url', ({ url }) => {
      if (url.startsWith('vellum://reader/')) {
        const bookId = url.replace('vellum://reader/', '');
        navigationRef.current?.navigate('Reader', { bookId });
      }
    });

    Linking.getInitialURL().then((url) => {
      if (url && url.startsWith('vellum://reader/')) {
        const bookId = url.replace('vellum://reader/', '');
        navigationRef.current?.navigate('Reader', { bookId });
      }
    });

    return () => sub.remove();
  }, [isAuthenticated]);

  if (loading) {
    return null;
  }

  return (
    <NavigationContainer ref={navigationRef} linking={linking}>
      <StatusBar barStyle="light-content" />
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <>
            <RootStack.Screen name="Main" component={LibraryScreen} />
            <RootStack.Screen name="Highlights" component={HighlightsScreen} />
            <RootStack.Screen name="WidgetConfig" component={WidgetConfigScreen} />
            <RootStack.Screen
              name="Reader"
              component={ReaderScreen}
              options={{ animation: 'slide_from_bottom' }}
            />
          </>
        ) : (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
