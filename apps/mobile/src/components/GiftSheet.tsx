import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontSizes, fontWeights, radii, spacing } from '../theme';
import type { Gift } from '../types';
import { LoadingView } from './LoadingView';
import { PrimaryButton } from './PrimaryButton';
import { Sheet } from './Sheet';

interface GiftSheetProps {
  visible: boolean;
  onClose: () => void;
  gifts: Gift[];
  loading?: boolean;
  sending?: boolean;
  onSend: (giftId: string, quantity: number) => void;
  onRequireMember: () => void;
}

/** 送礼弹层：选礼物 → 数量 → 发送 */
export function GiftSheet({ visible, onClose, gifts, loading = false, sending = false, onSend, onRequireMember }: GiftSheetProps) {
  const insets = useSafeAreaInsets();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  const selected = gifts.find((g) => g.id === selectedId) ?? null;

  const handleTap = (gift: Gift) => {
    if (gift.locked) {
      onRequireMember();
      return;
    }
    if (selectedId === gift.id) {
      setSelectedId(null);
      setQuantity(1);
    } else {
      setSelectedId(gift.id);
      setQuantity(1);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.wrap}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>送 TA 一份心意</Text>
            <Text style={styles.subtitle}>礼物会带来即时情绪反馈与好感度提升</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={{ height: 220 }}>
            <LoadingView text="礼物加载中…" />
          </View>
        ) : (
          <ScrollView style={styles.list} contentContainerStyle={styles.grid}>
            {gifts.map((gift) => {
              const isSelected = selectedId === gift.id;
              const isLocked = Boolean(gift.locked);
              return (
                <Pressable
                  key={gift.id}
                  onPress={() => handleTap(gift)}
                  style={[styles.giftCard, isSelected && styles.giftCardSelected, isLocked && styles.giftCardLocked]}
                >
                  <View style={styles.giftIconWrap}>
                    <Text style={styles.giftIcon}>{gift.icon ?? '🎁'}</Text>
                    {isLocked ? (
                      <View style={styles.lockBadge}>
                        <Text style={styles.lockText}>🔒</Text>
                      </View>
                    ) : null}
                    {gift.isLimited ? (
                      <View style={styles.limitedBadge}>
                        <Text style={styles.limitedText}>限量</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.giftName} numberOfLines={1}>{gift.name}</Text>
                  <Text style={styles.giftPrice}>¥{gift.priceYuan}</Text>
                  <Text style={styles.giftDesc} numberOfLines={1}>{gift.description ?? ''}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {selected ? (
          <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.stepper}>
              <Pressable onPress={() => setQuantity((q) => Math.max(1, q - 1))} style={styles.stepBtn}>
                <Text style={styles.stepText}>−</Text>
              </Pressable>
              <Text style={styles.stepNum}>×{quantity}</Text>
              <Pressable onPress={() => setQuantity((q) => Math.min(99, q + 1))} style={styles.stepBtn}>
                <Text style={styles.stepText}>＋</Text>
              </Pressable>
            </View>
            <PrimaryButton
              title={`送出 · ¥${(Number(selected.priceYuan) * quantity).toFixed(2)}`}
              onPress={() => onSend(selected.id, quantity)}
              loading={sending}
              style={{ flex: 1 }}
            />
          </View>
        ) : (
          <View style={[styles.footerHint, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.footerHintText}>👑 限量礼物需会员身份，点击解锁</Text>
          </View>
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  title: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: 2,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: colors.textSecondary,
    fontSize: fontSizes.md,
  },
  list: {
    maxHeight: 320,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  giftCard: {
    width: '30%',
    flexGrow: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    alignItems: 'center',
  },
  giftCardSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.primarySoft,
  },
  giftCardLocked: {
    opacity: 0.92,
  },
  giftIconWrap: {
    position: 'relative',
    marginBottom: 4,
  },
  giftIcon: {
    fontSize: 30,
  },
  lockBadge: {
    position: 'absolute',
    right: -8,
    top: -6,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 1,
  },
  lockText: {
    fontSize: 12,
  },
  limitedBadge: {
    position: 'absolute',
    left: -6,
    bottom: -6,
    backgroundColor: colors.goldLight,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  limitedText: {
    color: '#8a6200',
    fontSize: 9,
    fontWeight: '700',
  },
  giftName: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
    marginTop: 2,
  },
  giftPrice: {
    fontSize: fontSizes.sm,
    color: colors.primary,
    fontWeight: fontWeights.bold,
    marginTop: 2,
  },
  giftDesc: {
    fontSize: fontSizes.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    color: colors.textPrimary,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
  },
  stepNum: {
    minWidth: 36,
    textAlign: 'center',
    color: colors.textPrimary,
    fontWeight: fontWeights.bold,
    fontSize: fontSizes.md,
  },
  footerHint: {
    paddingTop: spacing.md,
    alignItems: 'center',
  },
  footerHintText: {
    color: colors.textTertiary,
    fontSize: fontSizes.sm,
  },
});
