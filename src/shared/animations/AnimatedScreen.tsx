import React from 'react';
import Animated, {
  FadeInUp,
  FadeOutDown,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';

interface AnimatedScreenProps {
  children: React.ReactNode;
  entering?: typeof FadeInUp;
  exiting?: typeof FadeOutDown;
  style?: any;
}

const flexOne = { flex: 1 } as const;

/**
 * Screen wrapper con fade-in animado por defecto
 */
export function AnimatedScreen({
  children,
  entering = FadeIn,
  exiting = FadeOut,
  style,
}: AnimatedScreenProps) {
  return (
    <Animated.View entering={entering} exiting={exiting} style={[flexOne, style]}>
      {children}
    </Animated.View>
  );
}

/**
 * Slide-up animation para modals
 */
export function AnimatedModal({ children, style }: { children: React.ReactNode; style?: any }) {
  return (
    <Animated.View
      entering={FadeInUp.duration(300)}
      exiting={FadeOutDown.duration(300)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}
