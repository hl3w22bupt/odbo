import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors } from '../theme';

/** 在线状态绿点呼吸动画 */
export function BreathingDot({ size = 8 }: { size?: number }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.6, duration: 900, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.35, duration: 900, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 900, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 900, useNativeDriver: true }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scale, opacity]);

  return (
    <View style={[styles.dot, { width: size, height: size, borderRadius: size / 2 }]}>
      <Animated.View
        style={[
          styles.pulse,
          { width: size, height: size, borderRadius: size / 2 },
          { transform: [{ scale }], opacity },
        ]}
      />
      <View style={[styles.core, { width: size * 0.55, height: size * 0.55, borderRadius: size * 0.28 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    backgroundColor: colors.onlineBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: {
    position: 'absolute',
    backgroundColor: colors.online,
  },
  core: {
    backgroundColor: colors.online,
  },
});
