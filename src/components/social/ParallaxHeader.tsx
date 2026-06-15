/**
 * Curoco — Parallax Header
 * Rubber-band stretch on pull, parallax scroll, blur transition
 */

import React from 'react';
import { View, Animated, Dimensions, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COVER_HEIGHT = 280;

interface ParallaxHeaderProps {
  coverUri: string | null;
  scrollY: Animated.Value;
  onChangeCover?: () => void;
}

export default function ParallaxHeader({
  coverUri, scrollY, onChangeCover,
}: ParallaxHeaderProps) {
  // Parallax: cover moves at 0.5x scroll speed
  const coverTranslateY = scrollY.interpolate({
    inputRange: [-COVER_HEIGHT, 0, COVER_HEIGHT],
    outputRange: [-COVER_HEIGHT * 0.5, 0, COVER_HEIGHT * 0.3],
    extrapolate: 'clamp',
  });

  // Rubber-band: pull down stretches the image
  const coverScale = scrollY.interpolate({
    inputRange: [-COVER_HEIGHT, 0],
    outputRange: [1.6, 1],
    extrapolate: 'clamp',
  });

  // Blur simulation: opacity overlay increases as scroll up
  const blurOverlay = scrollY.interpolate({
    inputRange: [0, COVER_HEIGHT * 0.6, COVER_HEIGHT],
    outputRange: [0, 0.3, 0.6],
    extrapolate: 'clamp',
  });

  // Curved bottom radius animation
  const borderRadius = scrollY.interpolate({
    inputRange: [-COVER_HEIGHT, 0],
    outputRange: [0, 30],
    extrapolate: 'clamp',
  });

  return (
    <View>
      <TouchableOpacity onPress={onChangeCover} activeOpacity={0.9}>
        <Animated.View
          style={[
            styles.cover,
            {
              transform: [{ translateY: coverTranslateY }, { scale: coverScale }],
              borderBottomLeftRadius: borderRadius,
              borderBottomRightRadius: borderRadius,
            },
          ]}
        >
          {coverUri ? (
            <Image source={{ uri: coverUri }} style={styles.coverImg} />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Ionicons name="image-outline" size={36} color="#C0C0C0" />
              <Text style={styles.coverHint}>点击设置封面</Text>
            </View>
          )}
          {/* Gradient overlay */}
          <View style={styles.gradient} />
          {/* Blur overlay */}
          <Animated.View style={[styles.blurOverlay, { opacity: blurOverlay }]} />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    height: COVER_HEIGHT,
    overflow: 'hidden',
    backgroundColor: '#D8D8E0',
  },
  coverImg: { width: SCREEN_WIDTH, height: COVER_HEIGHT },
  coverPlaceholder: {
    width: SCREEN_WIDTH, height: COVER_HEIGHT,
    alignItems: 'center', justifyContent: 'center',
  },
  coverHint: { fontSize: 13, color: '#A0A0A0', marginTop: 8 },
  gradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 100,
    backgroundColor: 'transparent',
  },
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
});
