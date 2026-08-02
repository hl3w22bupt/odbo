import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text } from 'react-native';
import { colors, fontSizes, fontWeights } from '../theme';

interface Particle {
  id: number;
  x: Animated.Value;
  y: Animated.Value;
  opacity: Animated.Value;
  scale: Animated.Value;
  emoji: string;
  label?: string;
}

let particleSeq = 0;

interface GiftFloatLayerProps {
  /** 变化即触发一次上浮 */
  burst: number;
  emoji: string;
  label?: string;
  intensity?: 'medium' | 'high';
}

/** 送礼后上浮飘动动画层 */
export function GiftFloatLayer({ burst, emoji, label, intensity = 'medium' }: GiftFloatLayerProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const count = intensity === 'high' ? 5 : 3;

  useEffect(() => {
    if (burst === 0) return;
    const newParticles: Particle[] = Array.from({ length: count }, (_, i) => ({
      id: particleSeq++,
      x: new Animated.Value((Math.random() - 0.5) * 60),
      y: new Animated.Value(0),
      opacity: new Animated.Value(1),
      scale: new Animated.Value(0.6 + Math.random() * 0.5),
      emoji: i === 0 ? emoji : ['💗', '✨', '💕', '🌟'][(i + burst) % 4]!,
      label: i === 0 ? label : undefined,
    }));
    setParticles((prev) => [...prev.slice(-6), ...newParticles]);

    newParticles.forEach((p, i) => {
      const delay = i * 120;
      const rise = 160 + Math.random() * 60;
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(p.y, { toValue: -rise, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(p.opacity, { toValue: 0, duration: 1800, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(p.scale, { toValue: 1.4, duration: 1800, useNativeDriver: true }),
        ]),
      ]).start(() => {
        setParticles((prev) => prev.filter((x) => x.id !== p.id));
      });
    });
  }, [burst, emoji, label, count]);

  return (
    <Animated.View pointerEvents="none" style={styles.layer}>
      {particles.map((p) => (
        <Animated.View
          key={p.id}
          style={[
            styles.particle,
            {
              transform: [{ translateX: p.x }, { translateY: p.y }, { scale: p.scale }],
              opacity: p.opacity,
            },
          ]}
        >
          <Text style={styles.emoji}>{p.emoji}</Text>
          {p.label ? <Text style={styles.label}>{p.label}</Text> : null}
        </Animated.View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  particle: {
    position: 'absolute',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 34,
  },
  label: {
    marginTop: 2,
    color: colors.primaryDark,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
});
