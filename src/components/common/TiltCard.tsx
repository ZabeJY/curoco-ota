/**
 * Curoco — 3D Tilt Card Component
 * Portable glassmorphism card with tilt micro-interaction
 * Uses built-in Animated API (no reanimated needed)
 */

import React, { useRef, type ReactNode } from 'react';
import {
  View, StyleSheet, Animated, PanResponder, Dimensions,
  type ViewStyle,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TILT_FACTOR = 8;

interface TiltCardProps {
  children: ReactNode;
  style?: ViewStyle;
  containerStyle?: ViewStyle;
  disabled?: boolean;
}

export default function TiltCard({ children, style, containerStyle, disabled = false }: TiltCardProps) {
  const rotateX = useRef(new Animated.Value(0)).current;
  const rotateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const longPressedRef = useRef(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: () => !disabled && longPressedRef.current,
      onPanResponderGrant: () => {
        longPressTimerRef.current = setTimeout(() => {
          longPressedRef.current = true;
          Animated.spring(scale, { toValue: 1.02, friction: 8, tension: 100, useNativeDriver: true }).start();
        }, 500);
      },
      onPanResponderMove: (_, gestureState) => {
        if (disabled || !longPressedRef.current) return;
        const { dx, dy } = gestureState;
        const x = Math.max(-1, Math.min(1, dx / (SCREEN_WIDTH * 0.3)));
        const y = Math.max(-1, Math.min(1, dy / 200));
        rotateY.setValue(x * TILT_FACTOR);
        rotateX.setValue(-y * TILT_FACTOR);
      },
      onPanResponderRelease: () => {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        if (longPressedRef.current) {
          longPressedRef.current = false;
          Animated.parallel([
            Animated.spring(rotateX, { toValue: 0, friction: 8, tension: 80, useNativeDriver: true }),
            Animated.spring(rotateY, { toValue: 0, friction: 8, tension: 80, useNativeDriver: true }),
            Animated.spring(scale, { toValue: 1, friction: 8, tension: 80, useNativeDriver: true }),
          ]).start();
        }
      },
      onPanResponderTerminate: () => {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        if (longPressedRef.current) {
          longPressedRef.current = false;
          Animated.parallel([
            Animated.spring(rotateX, { toValue: 0, friction: 8, tension: 80, useNativeDriver: true }),
            Animated.spring(rotateY, { toValue: 0, friction: 8, tension: 80, useNativeDriver: true }),
            Animated.spring(scale, { toValue: 1, friction: 8, tension: 80, useNativeDriver: true }),
          ]).start();
        }
      },
    })
  ).current;

  return (
    <Animated.View
      style={[
        styles.container,
        containerStyle,
        {
          transform: [
            { perspective: 800 },
            { rotateX: rotateX.interpolate({ inputRange: [-10, 10], outputRange: ['-8deg', '8deg'] }) },
            { rotateY: rotateY.interpolate({ inputRange: [-10, 10], outputRange: ['8deg', '-8deg'] }) },
            { scale },
          ],
        },
      ]}
      {...panResponder.panHandlers}
    >
      <View style={[styles.card, style]}>
        {children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
  },
});
