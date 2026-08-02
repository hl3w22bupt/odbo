import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, radii } from '../theme';

/** 会员专属皇冠角标 */
export function CrownBadge({ small = false }: { small?: boolean }) {
  return (
    <View style={[styles.badge, small && styles.badgeSmall]}>
      <Text style={[styles.crown, small && styles.crownSmall]}>👑</Text>
      <Text style={[styles.label, small && styles.labelSmall]}>VIP</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.goldLight,
    borderColor: colors.gold,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 3,
  },
  badgeSmall: {
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  crown: {
    fontSize: 12,
  },
  crownSmall: {
    fontSize: 10,
  },
  label: {
    color: '#8a6200',
    fontSize: fontSizes.xs,
    fontWeight: '700',
  },
  labelSmall: {
    fontSize: 9,
  },
});
