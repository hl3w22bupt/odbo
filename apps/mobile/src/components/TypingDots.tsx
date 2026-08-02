import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors } from '../theme';

/** 「输入中」三点 blink 动画 */
export function TypingDots({ color = colors.primary, size = 7 }: { color?: string; size?: number }) {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    const anims = dots.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(v, { toValue: 1, duration: 380, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 380, useNativeDriver: true }),
        ]),
      ),
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.row}>
      {dots.map((v, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
            { opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }), transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }] },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  dot: {},
});
