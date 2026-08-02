import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError, api } from '../api';
import { LoadingView } from '../components/LoadingView';
import { PrimaryButton } from '../components/PrimaryButton';
import { RationalConsumptionModal } from '../components/RationalConsumptionModal';
import { ScreenHeader } from '../components/ScreenHeader';
import { Sheet } from '../components/Sheet';
import { useNavigation } from '../navigation/NavigationContext';
import { useSession } from '../store/SessionContext';
import { useToast } from '../store/ToastContext';
import { colors, fontSizes, fontWeights, radii, shadows, spacing } from '../theme';
import type { MembershipPlan, Order, Product } from '../types';
import { centsToYuan } from '../utils/format';

type Channel = 'WECHAT' | 'ALIPAY';

const CHANNELS: { value: Channel; label: string; emoji: string; color: string }[] = [
  { value: 'WECHAT', label: '微信支付', emoji: '💚', color: '#2FC98C' },
  { value: 'ALIPAY', label: '支付宝', emoji: '💙', color: '#3B82C4' },
];

export function MembersScreen() {
  const insets = useSafeAreaInsets();
  const { pop } = useNavigation();
  const { showToast } = useToast();
  const { refreshStatus, isMember, membershipDaysLeft } = useSession();

  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const [buyingCode, setBuyingCode] = useState<string | null>(null);
  const [pendingOrder, setPendingOrder] = useState<Order | null>(null);
  const [payVisible, setPayVisible] = useState(false);
  const [payChannel, setPayChannel] = useState<Channel>('WECHAT');
  const [paying, setPaying] = useState(false);
  const [rationalVisible, setRationalVisible] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, pr, o] = await Promise.all([api.listMembershipPlans(), api.listProducts(), api.listOrders()]);
      setPlans(p);
      setProducts(pr);
      setOrders(o);
    } catch (e) {
      showToast({ title: '加载失败', message: e instanceof Error ? e.message : '请稍后重试', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
    void refreshStatus();
  }, [load, refreshStatus]);

  // ===================== 购买流程 =====================

  const startBuy = async (productCode: string) => {
    setBuyingCode(productCode);
    try {
      const order = await api.createOrder(productCode);
      setPendingOrder(order);
      setPayVisible(true);
    } catch (e) {
      showToast({ title: '下单失败', message: e instanceof Error ? e.message : '请稍后重试', type: 'error' });
    } finally {
      setBuyingCode(null);
    }
  };

  const handlePaid = async (order: Order) => {
    setPayVisible(false);
    setPendingOrder(null);
    showToast({ title: '支付成功', message: `${order.title} 已到账`, type: 'success' });
    await Promise.all([refreshStatus(), load()]);
  };

  const confirmPay = async (channel: Channel) => {
    if (!pendingOrder) return;
    setPaying(true);
    setPayChannel(channel);
    try {
      const res = await api.payOrder(pendingOrder.id, channel);
      await handlePaid(res.order);
    } catch (e) {
      if (e instanceof ApiError && e.isLargePaymentConfirm()) {
        setPayVisible(false);
        setRationalVisible(true);
        return;
      }
      showToast({ title: '支付失败', message: e instanceof Error ? e.message : '请稍后重试', type: 'error' });
    } finally {
      setPaying(false);
    }
  };

  const confirmLargePayment = async () => {
    if (!pendingOrder) return;
    setRationalVisible(false);
    setPaying(true);
    try {
      await api.confirmLargePayment(pendingOrder.id);
      const res = await api.payOrder(pendingOrder.id, payChannel);
      await handlePaid(res.order);
    } catch (e) {
      showToast({ title: '支付失败', message: e instanceof Error ? e.message : '请稍后重试', type: 'error' });
    } finally {
      setPaying(false);
    }
  };

  // ===================== 权益对比表 =====================

  const benefitKeys = useCallback(() => {
    const seen = new Set<string>();
    const rows: string[] = [];
    for (const p of plans) {
      for (const b of p.benefits) {
        if (!seen.has(b.key)) {
          seen.add(b.key);
          rows.push(b.key);
        }
      }
    }
    return rows.map((key) => ({
      key,
      label: plans.find((p) => p.benefits.some((b) => b.key === key))?.benefits.find((b) => b.key === key)?.label ?? key,
    }));
  }, [plans]);

  if (loading && plans.length === 0) return <LoadingView text="会员中心加载中…" />;

  const compareRows = benefitKeys();

  return (
    <View style={styles.root}>
      <ScreenHeader title="会员中心" subtitle="心伴AI · 尊享权益" onBack={pop} />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        {/* 会员状态卡 */}
        <View style={[styles.statusCard, isMember && styles.statusCardMember]}>
          <Text style={styles.statusEmoji}>{isMember ? '👑' : '💎'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.statusTitle}>{isMember ? '会员生效中' : '尚未开通会员'}</Text>
            <Text style={styles.statusDesc}>
              {isMember ? `剩余有效期 ${membershipDaysLeft} 天 · 无限畅聊中` : '开通后解锁 2 位专属角色、无限消息、限量礼物'}
            </Text>
          </View>
        </View>

        {/* 月/季/年卡 */}
        <Text style={styles.sectionTitle}>会员卡</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.planRow}>
          {plans.map((plan) => {
            const isBuying = buyingCode === plan.plan;
            return (
              <View key={plan.plan} style={[styles.planCard, plan.plan === 'YEARLY' && styles.planCardHot]}>
                {plan.plan === 'YEARLY' ? <View style={styles.hotBadge}><Text style={styles.hotText}>最划算</Text></View> : null}
                <Text style={styles.planName}>{plan.name}</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.priceSymbol}>¥</Text>
                  <Text style={styles.priceNum}>{plan.priceYuan}</Text>
                </View>
                {plan.originalPriceYuan ? (
                  <Text style={styles.originalPrice}>原价 ¥{plan.originalPriceYuan}</Text>
                ) : (
                  <View style={{ height: 16 }} />
                )}
                <PrimaryButton
                  title={isMember ? '续费' : '开通'}
                  onPress={() => startBuy(`MEMBERSHIP_${plan.plan}`)}
                  loading={isBuying}
                  variant={plan.plan === 'YEARLY' ? 'primary' : 'ghost'}
                  style={{ marginTop: 'auto' }}
                />
              </View>
            );
          })}
        </ScrollView>

        {/* 权益对比表 */}
        <Text style={styles.sectionTitle}>权益对比</Text>
        <View style={styles.compareTable}>
          <View style={styles.compareHeader}>
            <Text style={[styles.compareCell, styles.compareFirst]}>权益</Text>
            {plans.map((p) => (
              <Text key={p.plan} style={[styles.compareCell, styles.comparePlan]}>{p.name.slice(0, 2)}</Text>
            ))}
          </View>
          {compareRows.map((row) => (
            <View key={row.key} style={styles.compareRow}>
              <Text style={[styles.compareCell, styles.compareFirst]}>{row.label}</Text>
              {plans.map((p) => {
                const has = p.benefits.some((b) => b.key === row.key && b.value);
                return (
                  <Text key={p.plan} style={[styles.compareCell, styles.comparePlan, has ? styles.compareYes : styles.compareNo]}>
                    {has ? '✓' : '—'}
                  </Text>
                );
              })}
            </View>
          ))}
        </View>

        {/* 单点内购 */}
        <Text style={styles.sectionTitle}>单点内购</Text>
        <View style={styles.productList}>
          {products.map((product) => {
            const isBuying = buyingCode === product.code;
            const owned = product.purchased;
            return (
              <View key={product.id} style={styles.productCard}>
                <View style={styles.productEmojiWrap}>
                  <Text style={styles.productEmoji}>{product.type === 'STORY' ? '📖' : product.type === 'VOICE_PACK' ? '🎙️' : '🎁'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.productName}>{product.name}</Text>
                    {product.memberOnly ? <Text style={styles.vipTag}>VIP</Text> : null}
                  </View>
                  <Text style={styles.productDesc}>{product.description ?? ''}</Text>
                </View>
                {owned ? (
                  <Text style={styles.ownedTag}>已拥有</Text>
                ) : (
                  <Pressable onPress={() => startBuy(product.code)} disabled={isBuying}>
                    <Text style={styles.buyBtn}>
                      {isBuying ? '…' : `¥${product.priceYuan}`}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>

        {/* 理性消费提示 */}
        <View style={styles.rationalCard}>
          <Text style={styles.rationalText}>💡 请理性消费，按需购买，量入为出。未成年人不应使用本服务。</Text>
        </View>

        {/* 最近订单 */}
        {orders.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>最近订单</Text>
            <View style={styles.orderList}>
              {orders.slice(0, 5).map((o) => (
                <View key={o.id} style={styles.orderRow}>
                  <Text style={styles.orderTitle} numberOfLines={1}>{o.title}</Text>
                  <Text style={styles.orderAmount}>¥{o.amountYuan}</Text>
                  <Text style={[styles.orderStatus, o.status === 'PAID' && styles.orderStatusPaid]}>
                    {o.status === 'PAID' ? '已完成' : o.status === 'PENDING_CONFIRM' ? '待确认' : '待支付'}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* 支付弹层 */}
      <Sheet visible={payVisible} onClose={() => !paying && setPayVisible(false)}>
        <View style={styles.paySheet}>
          <Text style={styles.payTitle}>确认支付</Text>
          {pendingOrder ? (
            <>
              <Text style={styles.payOrderTitle}>{pendingOrder.title}</Text>
              <Text style={styles.payAmount}>¥{pendingOrder.amountYuan}</Text>
            </>
          ) : null}
          <View style={styles.channelList}>
            {CHANNELS.map((ch) => (
              <Pressable
                key={ch.value}
                onPress={() => setPayChannel(ch.value)}
                style={[styles.channelRow, payChannel === ch.value && styles.channelRowActive]}
              >
                <Text style={styles.channelEmoji}>{ch.emoji}</Text>
                <Text style={styles.channelLabel}>{ch.label}</Text>
                <Text style={[styles.channelRadio, payChannel === ch.value && styles.channelRadioOn]}>
                  {payChannel === ch.value ? '●' : '○'}
                </Text>
              </Pressable>
            ))}
          </View>
          <PrimaryButton title={`立即支付 ¥${pendingOrder?.amountYuan ?? '0.00'}`} onPress={() => confirmPay(payChannel)} loading={paying} style={{ marginTop: spacing.md }} />
          <Pressable onPress={() => !paying && setPayVisible(false)} style={styles.payCancel}>
            <Text style={styles.payCancelText}>取消</Text>
          </Pressable>
        </View>
      </Sheet>

      {/* 理性消费 / 大额确认 */}
      <RationalConsumptionModal
        visible={rationalVisible}
        onClose={() => setRationalVisible(false)}
        confirmingPayment
        amountYuan={pendingOrder ? centsToYuan(pendingOrder.amount) : undefined}
        onConfirm={confirmLargePayment}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.violetSoft,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.violetLight,
    padding: spacing.lg,
  },
  statusCardMember: {
    backgroundColor: colors.goldLight,
    borderColor: colors.goldLight,
  },
  statusEmoji: {
    fontSize: 30,
  },
  statusTitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
  },
  statusDesc: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  planRow: {
    gap: spacing.md,
    paddingRight: spacing.lg,
  },
  planCard: {
    width: 168,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.lg,
    ...shadows.card,
  },
  planCardHot: {
    borderColor: colors.gold,
    borderWidth: 2,
  },
  hotBadge: {
    position: 'absolute',
    top: -9,
    alignSelf: 'center',
    backgroundColor: colors.gold,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  hotText: {
    color: colors.surface,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
  },
  planName: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 8,
  },
  priceSymbol: {
    color: colors.primary,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
  },
  priceNum: {
    color: colors.primary,
    fontSize: 30,
    fontWeight: fontWeights.heavy,
  },
  originalPrice: {
    color: colors.textTertiary,
    fontSize: fontSizes.sm,
    textDecorationLine: 'line-through',
    marginTop: 2,
  },
  compareTable: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
  },
  compareHeader: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  compareRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  compareCell: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    textAlign: 'center',
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  compareFirst: {
    flex: 1.6,
    textAlign: 'left',
    color: colors.textPrimary,
    fontWeight: fontWeights.medium,
  },
  comparePlan: {
    flex: 0.7,
    color: colors.textPrimary,
    fontWeight: fontWeights.semibold,
  },
  compareYes: {
    color: colors.success,
    fontWeight: fontWeights.bold,
  },
  compareNo: {
    color: colors.textTertiary,
  },
  productList: {
    gap: spacing.sm,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
  },
  productEmojiWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productEmoji: {
    fontSize: 22,
  },
  productName: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
  },
  vipTag: {
    backgroundColor: colors.goldLight,
    color: '#8a6200',
    fontSize: fontSizes.xs,
    fontWeight: '700',
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  productDesc: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  ownedTag: {
    color: colors.success,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
  },
  buyBtn: {
    color: colors.primary,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  rationalCard: {
    marginTop: spacing.xl,
    backgroundColor: colors.violetSoft,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.violetLight,
    padding: spacing.md,
  },
  rationalText: {
    color: colors.violet,
    fontSize: fontSizes.sm,
    lineHeight: 18,
  },
  orderList: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    gap: 10,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderTitle: {
    flex: 1,
    fontSize: fontSizes.md,
    color: colors.textPrimary,
  },
  orderAmount: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
  },
  orderStatus: {
    fontSize: fontSizes.sm,
    color: colors.textTertiary,
  },
  orderStatusPaid: {
    color: colors.success,
  },
  paySheet: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  payTitle: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  payOrderTitle: {
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
  },
  payAmount: {
    fontSize: 32,
    fontWeight: fontWeights.heavy,
    color: colors.primary,
    textAlign: 'center',
    marginTop: 4,
  },
  channelList: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  channelRowActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  channelEmoji: {
    fontSize: 22,
  },
  channelLabel: {
    flex: 1,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.medium,
    color: colors.textPrimary,
  },
  channelRadio: {
    fontSize: 20,
    color: colors.textTertiary,
  },
  channelRadioOn: {
    color: colors.primary,
  },
  payCancel: {
    alignSelf: 'center',
    marginTop: spacing.md,
    paddingVertical: 8,
  },
  payCancelText: {
    color: colors.textSecondary,
    fontSize: fontSizes.md,
  },
});
