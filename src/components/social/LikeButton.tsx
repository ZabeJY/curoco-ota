/**
 * Curoco — Like Button with Pop Animation
 * Shrink → expand → bounce back, color transition
 */

import React, { useRef } from 'react';
import { TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface LikeButtonProps {
  liked: boolean;
  onPress: () => void;
  size?: number;
}

export default function LikeButton({ liked, onPress, size = 20 }: LikeButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const colorAnim = useRef(new Animated.Value(liked ? 1 : 0)).current;

  function handlePress() {
    // Pop animation: shrink → expand → settle
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.7, duration: 60, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1.3, friction: 3, tension: 200, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 180, useNativeDriver: true }),
    ]).start();

    // Color transition
    Animated.timing(colorAnim, {
      toValue: liked ? 0 : 1,
      duration: 200,
      useNativeDriver: false,
    }).start();

    onPress();
  }

  const iconColor = colorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#B0B0B0', '#FF4757'],
  });

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.6} style={styles.btn}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons
          name={liked ? 'heart' : 'heart-outline'}
          size={size}
          color={liked ? '#FF4757' : '#B0B0B0'}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { padding: 6 },
});
