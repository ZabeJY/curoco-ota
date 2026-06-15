/**
 * Curoco — Sparkle Text Effect
 * Animated sparkle particles around text, adapted from web framer-motion design
 * Uses RN Animated API for performance
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, StyleSheet, type TextStyle } from 'react-native';

interface Sparkle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  opacity: Animated.Value;
  scale: Animated.Value;
}

interface SparkleTextProps {
  text: string;
  style?: TextStyle | TextStyle[];
  sparklesCount?: number;
  colors?: [string, string];
}

export default function SparkleText({
  text,
  style,
  sparklesCount = 8,
  colors = ['#6C63FF', '#FE8BBB'],
}: SparkleTextProps) {
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);
  const containerRef = useRef<View>(null);

  useEffect(() => {
    const newSparkles: Sparkle[] = Array.from({ length: sparklesCount }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 4 + Math.random() * 6,
      color: Math.random() > 0.5 ? colors[0] : colors[1],
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0),
    }));
    setSparkles(newSparkles);
  }, []);

  useEffect(() => {
    if (sparkles.length === 0) return;

    const animations = sparkles.map((s, i) => {
      const loop = () => {
        Animated.sequence([
          Animated.delay(i * 200 + Math.random() * 1000),
          Animated.parallel([
            Animated.timing(s.opacity, { toValue: 0.9, duration: 400, useNativeDriver: true }),
            Animated.spring(s.scale, { toValue: 1, tension: 100, friction: 6, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(s.opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
            Animated.timing(s.scale, { toValue: 0, duration: 500, useNativeDriver: true }),
          ]),
        ]).start(() => {
          // Randomize position for next sparkle
          s.x = Math.random() * 100;
          s.y = Math.random() * 100;
          loop();
        });
      };
      return loop;
    });

    animations.forEach((loop, i) => {
      setTimeout(loop, i * 300);
    });
  }, [sparkles.length]);

  return (
    <View ref={containerRef} style={styles.container}>
      {sparkles.map((s) => (
        <Animated.View
          key={s.id}
          style={[
            styles.sparkle,
            {
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.size,
              height: s.size,
              backgroundColor: s.color,
              shadowColor: s.color,
              opacity: s.opacity,
              transform: [{ scale: s.scale }, { rotate: '45deg' }],
            },
          ]}
        />
      ))}
      <Text style={style}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
  },
  sparkle: {
    position: 'absolute',
    borderRadius: 1,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 3,
    elevation: 3,
  },
});
