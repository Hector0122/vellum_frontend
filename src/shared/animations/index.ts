import { useSharedValue, withSpring, withTiming, Easing } from 'react-native-reanimated';

/**
 * Spring Animation Config - bouncy feel
 */
export const SPRING_CONFIG = {
  damping: 10,
  mass: 1,
  overshootClamping: false,
  restSpeedThreshold: 2,
  restDisplacementThreshold: 2,
};

/**
 * Timing Animation Config - smooth linear
 */
export const TIMING_CONFIG = {
  duration: 300,
  easing: Easing.inOut(Easing.ease),
};

/**
 * Fast timing for micro-interactions
 */
export const FAST_TIMING_CONFIG = {
  duration: 150,
  easing: Easing.out(Easing.quad),
};

/**
 * Screen transition config
 */
export const SCREEN_TRANSITION_CONFIG = {
  duration: 400,
  easing: Easing.inOut(Easing.cubic),
};

/**
 * Hook para controlar animación de fade
 */
export function useFadeAnimation(initialValue = 0) {
  const opacity = useSharedValue(initialValue);

  const fadeIn = (duration = 300) => {
    opacity.value = withTiming(1, { duration, easing: Easing.inOut(Easing.ease) });
  };

  const fadeOut = (duration = 300) => {
    opacity.value = withTiming(0, { duration, easing: Easing.inOut(Easing.ease) });
  };

  return { opacity, fadeIn, fadeOut };
}

/**
 * Hook para controlar animación de scale
 */
export function useScaleAnimation(initialValue = 1) {
  const scale = useSharedValue(initialValue);

  const scaleUp = () => {
    scale.value = withSpring(1, SPRING_CONFIG);
  };

  const scaleDown = () => {
    scale.value = withSpring(0.8, SPRING_CONFIG);
  };

  return { scale, scaleUp, scaleDown };
}

/**
 * Hook para controlar animación de slide
 */
export function useSlideAnimation(initialValue = 0) {
  const translateY = useSharedValue(initialValue);

  const slideIn = (fromValue = 300) => {
    translateY.value = fromValue;
    translateY.value = withTiming(0, SCREEN_TRANSITION_CONFIG);
  };

  const slideOut = (toValue = 300) => {
    translateY.value = withTiming(toValue, SCREEN_TRANSITION_CONFIG);
  };

  return { translateY, slideIn, slideOut };
}

/**
 * Hook para controlar animación de spring bounce
 */
export function useSpringAnimation(initialValue = 0) {
  const value = useSharedValue(initialValue);

  const bounce = () => {
    value.value = withSpring(initialValue, SPRING_CONFIG);
  };

  return { value, bounce };
}
