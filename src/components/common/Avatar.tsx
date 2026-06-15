/**
 * Curoco — Avatar (Redesigned)
 * Colorful, rounded, modern
 */

import React from 'react';
import { View, Image, Text, StyleSheet, type ViewStyle } from 'react-native';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl' | number;
type AvatarShape = 'circle' | 'rounded';
interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: AvatarSize;
  shape?: AvatarShape;
  style?: ViewStyle;
}

const SIZE_MAP: Record<AvatarSize, number> = { sm: 36, md: 44, lg: 60, xl: 80 };
const FONT_MAP: Record<AvatarSize, number> = { sm: 14, md: 17, lg: 22, xl: 28 };

const COLORS = ['#FF6B6B', '#FFA94D', '#FFD43B', '#69DB7C', '#4DABF7', '#9775FA', '#F783AC'];

function getColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

const FONT_SIZE_MAP: Record<AvatarSize, number> = FONT_MAP;

export default function Avatar({ uri, name = '', size = 'md', shape = 'circle', style }: AvatarProps) {
  // 支持自定义数字尺寸或预设尺寸
  const dim = typeof size === 'number' ? size : SIZE_MAP[size];
  const fs = typeof size === 'number' ? size * 0.37 : FONT_SIZE_MAP[size];
  const initials = name.slice(0, 1).toUpperCase();
  const bgColor = getColor(name);

  // 圆形或圆角方形
  const borderRadius = shape === 'rounded' ? dim * 0.2 : dim / 2;
  const cs: ViewStyle = { width: dim, height: dim, borderRadius };

  if (uri) {
    return <Image source={{ uri }} style={[styles.img, cs, style] as any} resizeMode="cover" />;
  }
  return (
    <View style={[styles.fb, { backgroundColor: bgColor }, cs, style]}>
      <Text style={[styles.ini, { fontSize: fs }]}>{initials || '?'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  img: { backgroundColor: '#D8D8D8' },
  fb: { alignItems: 'center', justifyContent: 'center' },
  ini: { color: '#FFFFFF', fontWeight: '600' },
});
