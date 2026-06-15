/**
 * Curoco — Badge (Redesigned)
 */

import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';

interface BadgeProps { count: number; style?: ViewStyle; }

export default function Badge({ count, style }: BadgeProps) {
  if (count <= 0) return null;
  const txt = count > 99 ? '99+' : String(count);
  return (
    <View style={[styles.badge, txt.length === 1 ? styles.single : styles.multi, style]}>
      <Text style={styles.text}>{txt}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: '#FF4757',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 18,
    paddingHorizontal: 5,
    height: 18,
    borderRadius: 9,
  },
  single: { width: 18 },
  multi: {},
  text: { color: '#fff', fontSize: 11, fontWeight: '600', includeFontPadding: false },
});
