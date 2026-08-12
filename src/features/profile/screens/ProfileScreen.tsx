import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '@/stores/authStore';
import type { RootStackParamList } from '@/types';
import { colors } from '@/shared/theme/colors';
import { radius, iconSize } from '@/shared/theme/tokens';

const MENU_ITEMS: {
  label: string;
  icon: string;
  screen: keyof RootStackParamList;
  desc: string;
}[] = [
  { label: 'Descubrir', icon: 'compass-outline', screen: 'Discover', desc: 'Recomendaciones personalizadas' },
  { label: 'Lista de deseos', icon: 'bookmark-multiple-outline', screen: 'Wishlist', desc: 'Libros que quieres leer' },
  { label: 'Widget', icon: 'widget-outline', screen: 'WidgetConfig', desc: 'Configurar widget de pantalla de inicio' },
  { label: 'Highlights', icon: 'marker', screen: 'Highlights', desc: 'Tus notas y subrayados' },
];

export function ProfileScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = useAuthStore(s => s.user);
  const signOut = useAuthStore(s => s.signOut);

  const handleNavigate = useCallback(
    (screen: keyof RootStackParamList) => {
      navigation.navigate(screen as any);
    },
    [navigation],
  );

  const handleLogout = useCallback(() => {
    Alert.alert('Cerrar sesión', '¿Estás seguro de que quieres cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión',
        style: 'destructive',
        onPress: () => signOut(),
      },
    ]);
  }, [signOut]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="close" size={iconSize.md} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Profile section */}
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Icon name="account" size={iconSize.xl} color={colors.accent} />
          </View>
          <Text style={styles.displayName}>
            {user?.display_name || user?.email?.split('@')[0]}
          </Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        {/* Menu items */}
        <View style={styles.menuSection}>
          {MENU_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.screen}
              style={styles.menuItem}
              onPress={() => handleNavigate(item.screen)}
              activeOpacity={0.7}
            >
              <View style={styles.menuIcon}>
                <Icon name={item.icon} size={iconSize.md} color={colors.accent} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.menuDesc}>{item.desc}</Text>
              </View>
              <Icon name="chevron-right" size={iconSize.md} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Icon name="logout" size={iconSize.md} color={colors.destructive} />
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: 12,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 32,
    gap: 8,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  displayName: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  email: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  menuSection: {
    gap: 8,
    marginBottom: 32,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 16,
    gap: 14,
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: `${colors.accent}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuContent: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  menuDesc: {
    fontSize: 12,
    color: colors.textMuted,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,107,107,0.12)',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.destructive,
  },
});
