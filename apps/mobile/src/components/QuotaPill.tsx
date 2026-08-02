import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, fontWeights, radii } from '../theme';

interface QuotaPillProps {
  remaining: number;
  unlimited?: boolean;
}

export function QuotaPill({ remaining, unlimited = false }: QuotaPillProps) {
  const text = unlimited ? '会员畅聊中' : `今日剩 ${Math.max(0, remaining)} 条`;
  return (
    <View style={[styles.pill, unlimited && styles.pillUnlimited]}>
      <View style={[styles.dot, unlimited && styles.dotUnlimited]} />
      <Text style={[styles.text, unlimited && styles.textUnlimited]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryLight,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillUnlimited: {
    backgroundColor: colors.violetSoft,
    borderColor: colors.violetLight,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  dotUnlimited: {
    backgroundColor: colors.violet,
  },
  text: {
    color: colors.primaryDark,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
  },
  textUnlimited: {
    color: colors.violet,
  },
});
