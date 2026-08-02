import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, fontWeights, radii } from '../theme';
import { affectionLevelLabel } from '../utils/format';

interface HeartbeatBarProps {
  value: number;
  level: number;
  progress: number;
  /** 是否触发一次心跳动画 */
  heartbeat?: number;
  compact?: boolean;
}

/** 好感度进度条（带心跳动画） */
export function HeartbeatBar({ value, level, progress, heartbeat = 0, compact = false }: HeartbeatBarProps) {
  const beat = useRef(new Animated.Value(0)).current;
  const widthAnim = useRef(new Animated.Value(progress)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: Math.min(1, Math.max(0, progress)),
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [progress, widthAnim]);

  useEffect(() => {
    if (heartbeat === 0) return;
    beat.setValue(0);
    Animated.sequence([
      Animated.timing(beat, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.timing(beat, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(beat, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.timing(beat, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [heartbeat, beat]);

  const heartScale = beat.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] });

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={styles.topRow}>
        <Text style={[styles.label, compact && styles.labelCompact]}>好感度</Text>
        <View style={styles.right}>
          <Animated.Text style={[styles.heart, { transform: [{ scale: heartScale }] }]}>💗</Animated.Text>
          <Text style={[styles.value, compact && styles.valueCompact]}>{affectionLevelLabel(level)} · {value}</Text>
        </View>
      </View>
      <View style={[styles.track, compact && styles.trackCompact]}>
        <Animated.View style={[styles.fill, { width: widthAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  wrapCompact: {
    paddingVertical: 6,
    borderRadius: radii.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  label: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
  },
  labelCompact: {
    fontSize: fontSizes.xs,
  },
  heart: {
    fontSize: 14,
  },
  value: {
    color: colors.primaryDark,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
  },
  valueCompact: {
    fontSize: fontSizes.xs,
  },
  track: {
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.primaryLight,
    overflow: 'hidden',
  },
  trackCompact: {
    height: 6,
  },
  fill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
});
