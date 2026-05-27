import React, { useEffect } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  Easing,
  withTiming,
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface AnimatedFABProps {
  onPress: () => void;
  icon: string;
  color?: string;
  backgroundColor?: string;
}

export function AnimatedFAB({
  onPress,
  icon,
  color = '#FFFFFF',
  backgroundColor = '#FF6B35',
}: AnimatedFABProps) {
  const scale = useSharedValue(0);
  const rotation = useSharedValue(0);

  // Entrance animation (spring)
  useEffect(() => {
    scale.value = withSpring(1, {
      damping: 10,
      mass: 1,
      overshootClamping: false,
    });
  }, []);

  // Press animation
  const handlePress = () => {
    // Pulse effect
    scale.value = withTiming(0.95, { duration: 100, easing: Easing.inOut(Easing.ease) });
    scale.value = withSpring(1, {
      damping: 10,
      mass: 1,
    });
    onPress();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  return (
    <AnimatedTouchable
      onPress={handlePress}
      style={[styles.fab, { backgroundColor }, animatedStyle]}
      activeOpacity={0.8}
    >
      <Icon name={icon} size={28} color={color} />
    </AnimatedTouchable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});
