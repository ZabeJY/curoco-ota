/**
 * Curoco — High-Performance Slider with Tooltip
 * Shows floating value above thumb during drag
 */

import React, { useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, PanResponder, Dimensions } from 'react-native';

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange?: (value: number) => void;
  onSlidingComplete?: (value: number) => void;
  trackColor?: string;
  thumbColor?: string;
  label?: string;
  unit?: string;
  disabled?: boolean;
}

export default function Slider({
  value, min, max, step = 1,
  onChange, onSlidingComplete,
  trackColor = '#6C63FF', thumbColor = '#6C63FF',
  label, unit = '', disabled = false,
}: SliderProps) {
  const [trackWidth, setTrackWidth] = useState(280);
  const localValueRef = useRef(value);
  const [displayValue, setDisplayValue] = useState(value);
  const isDragging = useRef(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const percentage = (displayValue - min) / (max - min);
  const thumbLeft = percentage * (trackWidth - 24);

  const updateValue = useCallback((locationX: number) => {
    const clampedX = Math.max(0, Math.min(locationX, trackWidth));
    const pct = clampedX / trackWidth;
    let newValue = Math.round(min + pct * (max - min));
    newValue = Math.round(newValue / step) * step;
    newValue = Math.max(min, Math.min(max, newValue));

    if (newValue !== localValueRef.current) {
      localValueRef.current = newValue;
      setDisplayValue(newValue);
      onChange?.(newValue);
    }
  }, [trackWidth, min, max, step, onChange]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: (evt) => {
        isDragging.current = true;
        setShowTooltip(true);
        updateValue(evt.nativeEvent.locationX);
      },
      onPanResponderMove: (evt) => {
        if (isDragging.current) {
          updateValue(evt.nativeEvent.locationX);
        }
      },
      onPanResponderRelease: () => {
        isDragging.current = false;
        setShowTooltip(false);
        onSlidingComplete?.(localValueRef.current);
      },
      onPanResponderTerminate: () => {
        isDragging.current = false;
        setShowTooltip(false);
      },
    })
  ).current;

  React.useEffect(() => {
    if (!isDragging.current) {
      setDisplayValue(value);
      localValueRef.current = value;
    }
  }, [value]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        <Text style={[styles.valueText, { color: trackColor }]}>
          {displayValue}{unit ? ` ${unit}` : ''}
        </Text>
      </View>

      <View
        style={styles.trackContainer}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        {...panResponder.panHandlers}
      >
        <View style={[styles.track, { backgroundColor: '#E8E8F0' }]} />
        <View style={[styles.track, styles.trackActive, { backgroundColor: trackColor, width: thumbLeft + 12 }]} />

        {/* Tooltip */}
        {showTooltip && (
          <View style={[styles.tooltip, { left: thumbLeft + 12 - 20 }]}>
            <Text style={styles.tooltipText}>{displayValue}</Text>
            <View style={[styles.tooltipArrow, { borderTopColor: trackColor }]} />
          </View>
        )}

        <View style={[styles.thumb, { left: thumbLeft, backgroundColor: thumbColor, transform: showTooltip ? [{ scale: 1.2 }] : [] }]} />
      </View>

      <View style={styles.rangeRow}>
        <Text style={styles.rangeText}>{min}{unit}</Text>
        <Text style={styles.rangeText}>{max}{unit}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 },
  label: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  valueText: { fontSize: 22, fontWeight: '700' },
  trackContainer: { height: 40, justifyContent: 'center', position: 'relative' },
  track: { position: 'absolute', left: 0, right: 0, height: 6, borderRadius: 3 },
  trackActive: { borderRadius: 3 },
  thumb: {
    position: 'absolute', width: 24, height: 24, borderRadius: 12, top: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4, elevation: 4,
  },
  tooltip: {
    position: 'absolute', top: -8,
    backgroundColor: '#6C63FF', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
    alignItems: 'center', zIndex: 10,
  },
  tooltipText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  tooltipArrow: {
    width: 0, height: 0,
    borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 5,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: '#6C63FF',
    marginTop: -1,
  },
  rangeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  rangeText: { fontSize: 11, color: '#A0A0B8' },
});
