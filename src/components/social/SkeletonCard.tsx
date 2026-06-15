/**
 * Curoco — Skeleton Card with Shimmer Effect
 * Breathing wave gradient for loading states
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function SkeletonCard() {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1200, useNativeDriver: false }),
        Animated.timing(shimmer, { toValue: 0, duration: 1200, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const bgColor = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: ['#F0F0F2', '#E8E8EA'],
  });

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Animated.View style={[styles.avatarSkel, { backgroundColor: bgColor }]} />
        <View style={styles.headerText}>
          <Animated.View style={[styles.lineShort, { backgroundColor: bgColor }]} />
          <Animated.View style={[styles.lineTiny, { backgroundColor: bgColor, marginTop: 6 }]} />
        </View>
      </View>
      <Animated.View style={[styles.lineLong, { backgroundColor: bgColor }]} />
      <Animated.View style={[styles.lineMedium, { backgroundColor: bgColor, marginTop: 8 }]} />
      <Animated.View style={[styles.imageSkel, { backgroundColor: bgColor, marginTop: 12 }]} />
    </View>
  );
}

export function SkeletonFeed() {
  return (
    <View>
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FEFEFE',
    marginHorizontal: 14,
    marginTop: 12,
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  avatarSkel: { width: 40, height: 40, borderRadius: 20 },
  headerText: { marginLeft: 10, flex: 1 },
  lineShort: { width: 80, height: 14, borderRadius: 4 },
  lineTiny: { width: 50, height: 10, borderRadius: 3 },
  lineLong: { width: '100%', height: 14, borderRadius: 4 },
  lineMedium: { width: '60%', height: 14, borderRadius: 4 },
  imageSkel: { width: '100%', height: 160, borderRadius: 10 },
});
