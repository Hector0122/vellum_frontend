import React from 'react';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';

interface AnimatedListItemProps {
  children: React.ReactNode;
  index: number;
  style?: any;
}

/**
 * List item con fade-in staggered (cada item entra con delay)
 */
const AnimatedListItemInner = ({ children, index, style }: AnimatedListItemProps) => {
  return (
    <Animated.View
      entering={FadeInRight.delay(index * 50).springify()}
      exiting={FadeOutLeft}
      style={style}
    >
      {children}
    </Animated.View>
  );
};

export const AnimatedListItem = React.memo(AnimatedListItemInner);

/**
 * Fade-in general para cualquier contenido
 */
export function AnimatedFadeIn({ children, delay = 0, style }: any) {
  return (
    <Animated.View
      entering={FadeInRight.delay(delay).springify()}
      exiting={FadeOutLeft}
      style={style}
    >
      {children}
    </Animated.View>
  );
}
