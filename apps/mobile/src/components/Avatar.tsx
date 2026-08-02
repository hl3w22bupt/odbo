import React from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fontWeights, shadows } from '../theme';
import { avatarLetter } from '../utils/format';

export interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
}

const PALETTE = [
  '#F6D9E4',
  '#F8E0C8',
  '#E8DCF2',
  '#DCEBF4',
  '#DDF2E4',
  '#F7E7CE',
];

function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length] ?? PALETTE[0]!;
}

export function Avatar({ name, avatarUrl, size = 48, backgroundColor, style }: AvatarProps) {
  const letter = avatarLetter(name);
  const bg = backgroundColor ?? colorForName(name);

  if (avatarUrl) {
    return (
      <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2 }, style]}>
        <Image source={{ uri: avatarUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} resizeMode="cover" />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
        },
        style,
      ]}
    >
      <Text style={[styles.letter, { fontSize: size * 0.42 }]}>{letter}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  letter: {
    color: colors.primaryDark,
    fontWeight: fontWeights.heavy,
  },
});
