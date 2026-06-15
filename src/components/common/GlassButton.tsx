/**
 * Curoco — Glass Button
 * Animated button with scale micro-interaction
 * Supports primary, outline, destructive variants
 */

import React, { useRef } from 'react';
import { TouchableOpacity, Text, Animated, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

interface GlassButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'destructive' | 'ghost';
  icon?: React.ReactNode;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  activeOpacity?: number;
}

export default function GlassButton({
  label, onPress, variant = 'primary', icon, disabled, style, textStyle,
}: GlassButtonProps) {
  const { theme } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  function handlePressIn() {
    Animated.timing(scale, { toValue: 0.95, duration: 120, useNativeDriver: true }).start();
  }

  function handlePressOut() {
    Animated.spring(scale, { toValue: 1, tension: 200, friction: 10, useNativeDriver: true }).start();
  }

  const variantStyles = getVariantStyles(variant, theme);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[styles.btn, variantStyles.btn, disabled && styles.disabled, style]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.8}
        disabled={disabled}
      >
        {icon}
        <Text style={[styles.label, variantStyles.label, textStyle]}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function getVariantStyles(variant: string, theme: any) {
  switch (variant) {
    case 'primary':
      return {
        btn: { backgroundColor: theme.primary } as ViewStyle,
        label: { color: '#FFFFFF' } as TextStyle,
      };
    case 'outline':
      return {
        btn: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: theme.border } as ViewStyle,
        label: { color: theme.textPrimary } as TextStyle,
      };
    case 'destructive':
      return {
        btn: { backgroundColor: theme.danger } as ViewStyle,
        label: { color: '#FFFFFF' } as TextStyle,
      };
    case 'ghost':
      return {
        btn: { backgroundColor: 'transparent' } as ViewStyle,
        label: { color: theme.textSecondary } as TextStyle,
      };
    default:
      return { btn: {} as ViewStyle, label: {} as TextStyle };
  }
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, paddingHorizontal: 24, borderRadius: 16, gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  label: { fontSize: 15, fontWeight: '600', letterSpacing: 0.3 },
  disabled: { opacity: 0.5 },
});
