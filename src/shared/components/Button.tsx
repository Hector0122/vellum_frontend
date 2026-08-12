import React from 'react';
import { colors } from '@/shared/theme/colors';
import { motion } from '@/shared/theme/tokens';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  type PressableProps,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ButtonProps extends PressableProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline';
  loading?: boolean;
}

const ButtonInner = ({
  title,
  variant = 'primary',
  loading = false,
  style,
  disabled,
  ...props
}: ButtonProps) => {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      style={[
        styles.base,
        styles[variant],
        (disabled || loading) && styles.disabled,
        animatedStyle,
        style,
      ]}
      disabled={disabled || loading}
      onPressIn={() => {
        scale.value = withSpring(0.96, motion.spring.press);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, motion.spring.press);
      }}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? colors.accent : colors.white} />
      ) : (
        <Text
          style={[
            styles.text,
            variant === 'outline' && styles.textOutline,
          ]}
        >
          {title}
        </Text>
      )}
    </AnimatedPressable>
  );
};

export const Button = React.memo(ButtonInner);

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  primary: {
    backgroundColor: colors.accent,
  },
  secondary: {
    backgroundColor: colors.surface,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  textOutline: {
    color: colors.accent,
  },
});
