/**
 * Curoco — Glass Modal
 * Reusable glassmorphism modal with frosted glass effect
 * Fade + scale animation, tap overlay to dismiss
 */

import React, { useEffect, useRef } from 'react';
import {
  View, StyleSheet, Modal, TouchableOpacity, Animated, Dimensions, ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../theme/ThemeProvider';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface GlassModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Alignment of the card within the overlay */
  align?: 'center' | 'bottom';
  /** Additional style for the card */
  cardStyle?: any;
  /** Make content scrollable */
  scrollable?: boolean;
}

export default function GlassModal({ visible, onClose, children, align = 'center', cardStyle, scrollable = false }: GlassModalProps) {
  const { theme, isDark } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const slideAnim = useRef(new Animated.Value(align === 'bottom' ? 60 : 20)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 65, friction: 8, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.95, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const tint = isDark ? 'dark' : 'light';
  const glassBg = isDark ? 'rgba(30, 30, 46, 0.82)' : 'rgba(255, 255, 255, 0.82)';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.5)';

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity style={styles.overlayTouch} activeOpacity={1} onPress={onClose}>
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <Animated.View
              style={[
                styles.card,
                align === 'bottom' && styles.cardBottom,
                {
                  backgroundColor: glassBg,
                  borderColor,
                  transform: [{ scale: scaleAnim }, { translateY: slideAnim }],
                },
                cardStyle,
              ]}
            >
              <BlurView intensity={isDark ? 40 : 60} tint={tint} style={StyleSheet.absoluteFill} />
              <View style={styles.content}>
                {scrollable ? (
                  <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {children}
                  </ScrollView>
                ) : children}
              </View>
            </Animated.View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  overlayTouch: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: {
    borderRadius: 24, overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08, shadowRadius: 24, elevation: 12,
    maxWidth: 340, width: '100%',
  },
  cardBottom: { alignSelf: 'center', marginTop: 'auto', marginBottom: 40 },
  content: { position: 'relative', zIndex: 1 },
  scrollContent: { maxHeight: 500 },
});
