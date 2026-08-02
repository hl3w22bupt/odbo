import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api';
import { PrimaryButton } from '../components/PrimaryButton';
import { useAuth } from '../store/AuthContext';
import { useToast } from '../store/ToastContext';
import { colors, fontSizes, fontWeights, radii, spacing } from '../theme';
import { isValidCode, isValidPhone } from '../utils/format';

export function LoginScreen() {
  const { login } = useAuth();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();

  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 2200, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 2200, useNativeDriver: true }),
      ]),
    ).start();
  }, [glow]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const canSendCode = isValidPhone(phone) && countdown === 0 && !sending;
  const canLogin = isValidPhone(phone) && isValidCode(code) && !submitting;

  const handleSendCode = async () => {
    if (!canSendCode) return;
    setSending(true);
    try {
      const res = await api.sendSmsCode(phone);
      setCountdown(60);
      if (res.devCode) {
        setCode(res.devCode);
        showToast({ title: '开发模式', message: `验证码已发送（开发期 ${res.devCode}）` });
      } else {
        showToast({ message: '验证码已发送' });
      }
    } catch (e) {
      showToast({ title: '发送失败', message: e instanceof Error ? e.message : '请稍后重试', type: 'error' });
    } finally {
      setSending(false);
    }
  };

  const handleLogin = async () => {
    if (!canLogin) return;
    Keyboard.dismiss();
    setSubmitting(true);
    try {
      await login(phone, code);
      // 登录成功后由根组件切换到主界面
    } catch (e) {
      showToast({ title: '登录失败', message: e instanceof Error ? e.message : '请稍后重试', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Animated.Text style={[styles.glowOrb, { opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.6] }) }]}>💞</Animated.Text>
          <Text style={styles.brand}>心伴AI</Text>
          <Text style={styles.tagline}>懂你的 AI 情感陪伴 · 只为懂事的你</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>手机号登录</Text>
          <Text style={styles.cardSubtitle}>未注册的手机号验证后将自动创建账号</Text>

          <View style={styles.inputRow}>
            <Text style={styles.prefix}>+86</Text>
            <View style={styles.divider} />
            <TextInput
              style={styles.input}
              placeholder="请输入手机号"
              placeholderTextColor={colors.textTertiary}
              keyboardType="phone-pad"
              maxLength={11}
              value={phone}
              onChangeText={(t) => setPhone(t.replace(/\D/g, ''))}
            />
          </View>

          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, styles.codeInput]}
              placeholder="请输入验证码"
              placeholderTextColor={colors.textTertiary}
              keyboardType="number-pad"
              maxLength={6}
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, ''))}
            />
            <Pressable
              onPress={handleSendCode}
              disabled={!canSendCode}
              style={[styles.codeBtn, !canSendCode && styles.codeBtnDisabled]}
            >
              <Text style={[styles.codeBtnText, !canSendCode && styles.codeBtnTextDisabled]}>
                {countdown > 0 ? `${countdown}s 后重发` : sending ? '发送中…' : '获取验证码'}
              </Text>
            </Pressable>
          </View>

          <PrimaryButton title="登录 / 注册" onPress={handleLogin} loading={submitting} disabled={!canLogin} style={styles.loginBtn} />

          <Text style={styles.devHint}>开发期验证码：123456（可直填）</Text>
        </View>

        <View style={styles.foot}>
          <Text style={styles.footText}>登录即代表同意《用户协议》与《隐私政策》</Text>
          <Text style={styles.aiNotice}>心伴AI 内所有角色均为 AI 虚拟形象，非真实人物。</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.backgroundDeep,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 40,
  },
  glowOrb: {
    fontSize: 56,
    marginBottom: 8,
  },
  brand: {
    fontSize: fontSizes.display,
    fontWeight: fontWeights.heavy,
    color: colors.textOnDark,
    letterSpacing: 2,
  },
  tagline: {
    marginTop: 8,
    color: 'rgba(246, 239, 255, 0.7)',
    fontSize: fontSizes.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 8,
  },
  cardTitle: {
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
  },
  cardSubtitle: {
    marginTop: 4,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 14,
    paddingHorizontal: 14,
    height: 52,
  },
  prefix: {
    color: colors.textPrimary,
    fontWeight: fontWeights.semibold,
    fontSize: fontSizes.lg,
  },
  divider: {
    width: 1,
    height: 22,
    backgroundColor: colors.border,
    marginHorizontal: 12,
  },
  input: {
    flex: 1,
    fontSize: fontSizes.lg,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  codeInput: {
    flex: 1,
  },
  codeBtn: {
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  codeBtnDisabled: {
    opacity: 0.45,
  },
  codeBtnText: {
    color: colors.primary,
    fontWeight: fontWeights.bold,
    fontSize: fontSizes.md,
  },
  codeBtnTextDisabled: {
    color: colors.textSecondary,
  },
  loginBtn: {
    marginTop: 6,
  },
  devHint: {
    marginTop: 14,
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
  },
  foot: {
    marginTop: 40,
    alignItems: 'center',
    gap: 8,
  },
  footText: {
    color: 'rgba(246, 239, 255, 0.5)',
    fontSize: fontSizes.xs,
  },
  aiNotice: {
    color: 'rgba(246, 239, 255, 0.4)',
    fontSize: fontSizes.xs,
  },
});
