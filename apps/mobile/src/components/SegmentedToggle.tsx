import React, { useEffect, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, fontWeights, radii } from '../theme';

interface SegmentedToggleProps<T extends string> {
  options: Array<{ value: T; label: string; icon?: string }>;
  value: T;
  onChange: (value: T) => void;
}

/** 分段开关（含滑动滑块动画） */
export function SegmentedToggle<T extends string>({ options, value, onChange }: SegmentedToggleProps<T>) {
  const [trackWidth, setTrackWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const offset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (trackWidth <= 0) return;
    const thumbWidth = trackWidth / options.length;
    Animated.spring(offset, { toValue: index * thumbWidth, useNativeDriver: true, friction: 8, tension: 60 }).start();
  }, [index, trackWidth, options.length, offset]);

  const onLayout = (e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  };

  return (
    <View style={styles.track} onLayout={onLayout}>
      {trackWidth > 0 ? (
        <Animated.View
          style={[
            styles.thumb,
            { width: trackWidth / options.length, transform: [{ translateX: offset }] },
          ]}
        />
      ) : null}
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable key={opt.value} style={styles.option} onPress={() => onChange(opt.value)}>
            <Text style={[styles.optionText, active && styles.optionTextActive]}>
              {opt.icon ? `${opt.icon} ` : ''}
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
  },
  thumb: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    shadowColor: '#3A2A18',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 2,
  },
  option: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    color: colors.textSecondary,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.medium,
  },
  optionTextActive: {
    color: colors.primaryDark,
    fontWeight: fontWeights.bold,
  },
});
