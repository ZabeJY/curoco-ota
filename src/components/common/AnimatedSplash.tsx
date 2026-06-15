/**
 * Curoco — Animated Splash Screen (v1.6.1)
 * Pure white bg + reallogo.png fade in → hold → fade out
 * Native splash is also pure white → seamless handoff, no flash
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const LOGO_SIZE = SCREEN_WIDTH * 0.5;

interface AnimatedSplashProps {
  visible: boolean;
  onAnimationComplete?: () => void;
}

export default function AnimatedSplash({ visible, onAnimationComplete }: AnimatedSplashProps) {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.95)).current;
  const bgOpacity = useRef(new Animated.Value(1)).current;
  const animPlayed = useRef(false);

  useEffect(() => {
    if (visible && !animPlayed.current) {
      animPlayed.current = true;

      // Start from invisible — native splash (pure white) is still showing
      // Phase 1: Fade in logo (1000ms) + scale 0.95→1.0
      // Phase 2: Hold (800ms)
      // Phase 3: Fade out entire splash (800ms)
      Animated.sequence([
        Animated.parallel([
          Animated.timing(logoOpacity, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(logoScale, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(800),
        Animated.timing(bgOpacity, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onAnimationComplete?.();
      });
    } else if (!visible) {
      logoOpacity.setValue(0);
      logoScale.setValue(0.95);
      bgOpacity.setValue(1);
      animPlayed.current = false;
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.container, { opacity: bgOpacity }]}
      pointerEvents="none"
    >
      <Animated.Image
        source={require('../../../reallogo.png')}
        style={[
          styles.logo,
          {
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          },
        ]}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
});
