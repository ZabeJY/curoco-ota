/**
 * Curoco — Version Update Modal
 * Beautiful card shown on first launch after update
 * Fixed: Animated.Value stored in useRef to prevent recreation on re-render
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { SettingsRepository } from '../../db/repositories/SettingsRepository';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 64;

const CURRENT_VERSION = '1.7.6';
const UPDATE_NOTES = [
  '语音通话界面全面重构',
  '高级毛玻璃设计+实时对话转录',
  '语音理解优化',
  '通话中可看到双方对话内容',
];

export default function UpdateModal() {
  const [visible, setVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    checkShouldShow();
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  async function checkShouldShow() {
    try {
      const lastSeen = await SettingsRepository.getSetting('last_update_version_seen');
      if (lastSeen !== CURRENT_VERSION) {
        // Small delay for smooth app launch
        setTimeout(() => {
          setVisible(true);
          Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
          ]).start();

          // Safety: auto-dismiss after 30 seconds if stuck
          dismissTimerRef.current = setTimeout(() => {
            handleDismiss();
          }, 30000);
        }, 800);
      }
    } catch {}
  }

  async function handleDismiss() {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 200, useNativeDriver: true }),
    ]).start(async () => {
      setVisible(false);
      try {
        await SettingsRepository.setSetting('last_update_version_seen', CURRENT_VERSION);
      } catch {}
    });
  }

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        {/* Tap outside card to dismiss */}
        <TouchableOpacity
          style={styles.overlayTouch}
          activeOpacity={1}
          onPress={handleDismiss}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
          <Animated.View
            style={[
              styles.card,
              { transform: [{ scale: scaleAnim }, { translateY: slideAnim }] },
            ]}
          >
            <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
            {/* Decorative top gradient bar */}
            <View style={styles.topBar}>
              <View style={styles.gradientBar} />
            </View>

            {/* App icon & name */}
            <View style={styles.header}>
              <View style={styles.logoCircle}>
                <Text style={styles.logoChar}>C</Text>
              </View>
              <Text style={styles.appName}>Curoco</Text>
              <View style={styles.versionBadge}>
                <Text style={styles.versionText}>v{CURRENT_VERSION}</Text>
              </View>
            </View>

            {/* Update title */}
            <Text style={styles.title}>🎉 新版本更新</Text>
            <Text style={styles.subtitle}>本次更新带来了以下改进</Text>

            {/* Update notes */}
            <View style={styles.notesContainer}>
              {UPDATE_NOTES.map((note, i) => (
                <Animated.View
                  key={i}
                  style={[
                    styles.noteRow,
                    {
                      opacity: fadeAnim,
                      transform: [{
                        translateX: fadeAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [20, 0],
                        }),
                      }],
                    },
                  ]}
                >
                  <View style={styles.noteDot} />
                  <Text style={styles.noteText}>{note}</Text>
                </Animated.View>
              ))}
            </View>

            {/* Dismiss button with micro-interaction */}
            <TouchableOpacity
              onPress={handleDismiss}
              onPressIn={() => {
                Animated.spring(buttonScale, { toValue: 0.95, tension: 100, friction: 8, useNativeDriver: true }).start();
              }}
              onPressOut={() => {
                Animated.spring(buttonScale, { toValue: 1, tension: 100, friction: 8, useNativeDriver: true }).start();
              }}
              activeOpacity={0.8}
            >
              <Animated.View style={[styles.dismissBtn, { transform: [{ scale: buttonScale }] }]}>
                <Text style={styles.dismissText}>我知道了</Text>
              </Animated.View>
            </TouchableOpacity>
          </Animated.View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  overlayTouch: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  topBar: {
    height: 4,
    backgroundColor: '#F0EFF5',
  },
  gradientBar: {
    height: 4,
    backgroundColor: '#6C63FF',
    width: '60%',
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  header: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 8,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#F0EFF5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  logoChar: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1A1A2E',
  },
  appName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A2E',
    marginTop: 10,
    letterSpacing: 0.5,
  },
  versionBadge: {
    backgroundColor: 'rgba(108,99,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
  },
  versionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6C63FF',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
    textAlign: 'center',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  notesContainer: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    gap: 10,
  },
  noteDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6C63FF',
    opacity: 0.6,
  },
  noteText: {
    fontSize: 13,
    color: '#2C2C2E',
    lineHeight: 18,
    flex: 1,
  },
  dismissBtn: {
    marginHorizontal: 24,
    marginVertical: 20,
    backgroundColor: '#6C63FF',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  dismissText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});
