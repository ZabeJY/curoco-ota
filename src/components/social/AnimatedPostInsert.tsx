/**
 * Curoco — Animated Post Insert
 * New card slides down from top with fade-in after publishing
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

interface AnimatedPostInsertProps {
  visible: boolean;
  children: React.ReactNode;
  onComplete?: () => void;
}

export default function AnimatedPostInsert({ visible, children, onComplete }: AnimatedPostInsertProps) {
  const translateY = useRef(new Animated.Value(-60)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      translateY.setValue(-60);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 7,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => onComplete?.());
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={{ transform: [{ translateY }], opacity }}>
      {children}
    </Animated.View>
  );
}
