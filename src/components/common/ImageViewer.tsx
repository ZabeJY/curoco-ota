/**
 * Curoco — Full-Screen Image Viewer
 * Tap to zoom, pinch to scale, swipe down to close
 */

import React, { useRef, useState } from 'react';
import {
  View, Modal, StyleSheet, TouchableOpacity, Dimensions,
  Animated, PanResponder,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ImageViewerProps {
  visible: boolean;
  uri: string;
  onClose: () => void;
}

export default function ImageViewer({ visible, uri, onClose }: ImageViewerProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const lastScale = useRef(1);
  const lastTranslateY = useRef(0);

  React.useEffect(() => {
    if (visible) {
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    } else {
      opacity.setValue(0);
      scale.setValue(1);
      translateY.setValue(0);
      lastScale.current = 1;
      lastTranslateY.current = 0;
    }
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        // Swipe down to close (only when not zoomed)
        if (lastScale.current <= 1) {
          translateY.setValue(gestureState.dy);
          opacity.setValue(1 - Math.abs(gestureState.dy) / SCREEN_HEIGHT);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (lastScale.current <= 1 && Math.abs(gestureState.dy) > 100) {
          // Close on swipe down
          Animated.parallel([
            Animated.timing(translateY, { toValue: gestureState.dy > 0 ? SCREEN_HEIGHT : -SCREEN_HEIGHT, duration: 200, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
          ]).start(() => onClose());
        } else {
          // Spring back
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
          Animated.spring(opacity, { toValue: 1, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  // Double tap to zoom
  const lastTap = useRef(0);
  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      const newScale = lastScale.current > 1 ? 1 : 2;
      lastScale.current = newScale;
      Animated.spring(scale, { toValue: newScale, useNativeDriver: true }).start();
    }
    lastTap.current = now;
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Animated.View style={[styles.container, { opacity }]}>
        {/* Close button */}
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>

        {/* Image */}
        <Animated.View
          style={[styles.imageWrap, { transform: [{ translateY }, { scale }] }]}
          {...panResponder.panHandlers}
        >
          <TouchableOpacity activeOpacity={1} onPress={handleDoubleTap}>
            <Image source={{ uri }} style={styles.image} resizeMode="contain" />
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.95)',
    zIndex: 9999,
  },
  closeBtn: {
    position: 'absolute', top: 50, right: 16,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 10,
  },
  imageWrap: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
  },
});
