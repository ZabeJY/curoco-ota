/**
 * Curoco — Animated Beams Background
 * Dynamic light beams rising upward, adapted from Web Canvas to RN Animated
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, Dimensions, StyleSheet } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BEAM_COUNT = 8;

interface Beam {
  x: Animated.Value;
  y: Animated.Value;
  width: number;
  opacity: Animated.Value;
  hue: number;
}

function createBeam(index: number): Beam {
  const spacing = SCREEN_WIDTH / BEAM_COUNT;
  return {
    x: new Animated.Value(index * spacing + spacing * 0.2 + Math.random() * spacing * 0.6),
    y: new Animated.Value(SCREEN_HEIGHT + 50),
    width: 30 + Math.random() * 50,
    opacity: new Animated.Value(0.06 + Math.random() * 0.08),
    hue: 220 + Math.random() * 40,
  };
}

interface BeamsBackgroundProps {
  style?: any;
}

export default function BeamsBackground({ style }: BeamsBackgroundProps) {
  const beamsRef = useRef<Beam[]>([]);
  const animRefs = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    beamsRef.current = Array.from({ length: BEAM_COUNT }, (_, i) => createBeam(i));

    // Animate each beam upward in a loop
    beamsRef.current.forEach((beam, i) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(beam.y, {
            toValue: -200,
            duration: 4000 + Math.random() * 3000,
            useNativeDriver: true,
          }),
          Animated.timing(beam.y, {
            toValue: SCREEN_HEIGHT + 50,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
      animRefs.current.push(loop);
      loop.start();
    });

    return () => {
      animRefs.current.forEach((a) => a.stop());
      animRefs.current = [];
    };
  }, []);

  return (
    <View style={[styles.container, style]}>
      {beamsRef.current.map((beam, i) => (
        <Animated.View
          key={i}
          style={[
            styles.beam,
            {
              left: beam.x,
              top: beam.y,
              width: beam.width,
              height: 300,
              opacity: beam.opacity,
              backgroundColor: `hsla(${beam.hue}, 70%, 60%, 0.3)`,
              transform: [{ rotate: '-25deg' }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  beam: {
    position: 'absolute',
    borderRadius: 20,
  },
});
