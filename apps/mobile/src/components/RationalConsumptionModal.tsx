import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, fontWeights, spacing } from '../theme';
import { AppModal } from './AppModal';
import { PrimaryButton } from './PrimaryButton';

interface RationalConsumptionModalProps {
  visible: boolean;
  onClose: () => void;
  /** 是否处于大额支付二次确认流程 */
  confirmingPayment?: boolean;
  amountYuan?: string;
  notice?: string;
  onConfirm?: () => void;
}

/**
 * 理性消费提示 / 大额支付二次确认弹窗
 */
export function RationalConsumptionModal({
  visible,
  onClose,
  confirmingPayment = false,
  amountYuan,
  notice,
  onConfirm,
}: RationalConsumptionModalProps) {
  const content =
    notice ??
    '请理性消费，按需购买，量入为出。未成年人不应使用本服务。若您感到经济压力，建议暂停购买并多与身边亲友沟通。';

  return (
    <AppModal visible={visible} onClose={onClose}>
      <View style={styles.body}>
        <Text style={styles.emoji}>💡</Text>
        <Text style={styles.title}>{confirmingPayment ? '确认这笔支付？' : '理性消费提醒'}</Text>
        {confirmingPayment && amountYuan ? (
          <Text style={styles.amount}>¥{amountYuan}</Text>
        ) : null}
        <Text style={styles.desc}>{content}</Text>
        <PrimaryButton
          title={confirmingPayment ? '确认支付' : '我知道了'}
          onPress={onConfirm ?? onClose}
          style={{ width: '100%' }}
        />
        {confirmingPayment ? (
          <PrimaryButton title="再想想" onPress={onClose} variant="ghost" style={{ width: '100%', marginTop: 10 }} />
        ) : null}
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  body: {
    alignItems: 'center',
  },
  emoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  title: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
  },
  amount: {
    marginTop: 8,
    fontSize: fontSizes.hero,
    fontWeight: fontWeights.heavy,
    color: colors.primary,
  },
  desc: {
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginVertical: spacing.lg,
  },
});
