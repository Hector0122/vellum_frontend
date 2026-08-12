import { useSharedValue, withSpring, withTiming, Easing } from 'react-native-reanimated';
import { motion } from '@/shared/theme/tokens';

/**
 * Spring Animation Config - bouncy feel
 * Tomado de `motion.spring.gentle` (brand-kit) — el mismo spring que usan
 * cards/modales en las 6 apps. Antes era un config propio de Vellum
 * (damping 10) que no coincidía con el resto.
 */
export const SPRING_CONFIG = {
  ...motion.spring.gentle,
  overshootClamping: false,
  restSpeedThreshold: 2,
  restDisplacementThreshold: 2,
};

/**
 * Timing Animation Config - smooth linear
 * `motion.duration.base` + `motion.easing.standard` (brand-kit).
 */
export const TIMING_CONFIG = {
  duration: motion.duration.base,
  easing: Easing.bezier(...motion.easing.standard),
};

/**
 * Fast timing for micro-interactions
 * `motion.duration.fast` (brand-kit).
 */
export const FAST_TIMING_CONFIG = {
  duration: motion.duration.fast,
  easing: Easing.out(Easing.quad),
};

/**
 * Screen transition config
 * `motion.duration.slow` (brand-kit) — transición de pantalla completa.
 */
export const SCREEN_TRANSITION_CONFIG = {
  duration: motion.duration.slow,
  easing: Easing.bezier(...motion.easing.standard),
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
