/**
 * Curoco — Animated Splash Screen with Sparkle Effect
 * White bg + logo fade in + sparkle particles → hold → fade out
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Dimensions, View } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const LOGO_SIZE = SCREEN_WIDTH * 0.5;

interface Sparkle {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: Animated.Value;
  scale: Animated.Value;
}

interface AnimatedSplashProps {
  visible: boolean;
  onAnimationComplete?: () => void;
}

export default function AnimatedSplash({ visible, onAnimationComplete }: AnimatedSplashProps) {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.95)).current;
  const bgOpacity = useRef(new Animated.Value(1)).current;
  const animPlayed = useRef(false);
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);

  // Generate sparkles around the logo
  useEffect(() => {
    if (visible) {
      const newSparkles: Sparkle[] = Array.from({ length: 12 }, (_, i) => ({
        id: i,
        x: SCREEN_WIDTH * 0.3 + Math.random() * SCREEN_WIDTH * 0.4,
        y: SCREEN_HEIGHT * 0.35 + Math.random() * SCREEN_HEIGHT * 0.3,
        size: 4 + Math.random() * 8,
        opacity: new Animated.Value(0),
        scale: new Animated.Value(0),
      }));
      setSparkles(newSparkles);
    }
  }, [visible]);

  useEffect(() => {
    if (visible && !animPlayed.current) {
      animPlayed.current = true;

      // Phase 1: Fade in logo + sparkles (1000ms)
      const sparkleAnims = sparkles.map((s, i) =>
        Animated.sequence([
          Animated.delay(i * 80),
          Animated.parallel([
            Animated.timing(s.opacity, { toValue: 0.8, duration: 400, useNativeDriver: true }),
            Animated.spring(s.scale, { toValue: 1, tension: 100, friction: 6, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(s.opacity, { toValue: 0, duration: 600, useNativeDriver: true }),
            Animated.timing(s.scale, { toValue: 0, duration: 600, useNativeDriver: true }),
          ]),
        ])
      );

      Animated.sequence([
        Animated.parallel([
          Animated.timing(logoOpacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
          Animated.timing(logoScale, { toValue: 1, duration: 1000, useNativeDriver: true }),
          ...sparkleAnims,
        ]),
        Animated.delay(800),
        Animated.timing(bgOpacity, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]).start(() => {
        onAnimationComplete?.();
      });
    } else if (!visible) {
      logoOpacity.setValue(0);
      logoScale.setValue(0.95);
      bgOpacity.setValue(1);
      animPlayed.current = false;
    }
  }, [visible, sparkles]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, { opacity: bgOpacity }]} pointerEvents="none">
      {/* Sparkles */}
      {sparkles.map((s) => (
        <Animated.View
          key={s.id}
          style={[
            styles.sparkle,
            {
              left: s.x,
              top: s.y,
              width: s.size,
              height: s.size,
              opacity: s.opacity,
              transform: [{ scale: s.scale }, { rotate: '45deg' }],
            },
          ]}
        />
      ))}

      {/* Logo */}
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
  sparkle: {
    position: 'absolute',
    backgroundColor: '#6C63FF',
    borderRadius: 2,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 4,
  },
});
