import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, fontWeights, radii, shadows } from '../theme';
import type { Message } from '../types';
import { Avatar } from './Avatar';
import { TypingDots } from './TypingDots';

interface MessageBubbleProps {
  message: Message;
  companionName: string;
  companionAvatar?: string | null;
  animate?: boolean;
}

export function MessageBubble({ message, companionName, companionAvatar, animate = true }: MessageBubbleProps) {
  const isUser = message.role === 'USER';
  const isTyping = message.status === 'TYPING';
  const isProactive = message.type === 'PROACTIVE';
  const isGift = message.type === 'GIFT';

  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animate) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  }, [animate, progress]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  const opacity = progress;

  // 主动分享卡片
  if (isProactive) {
    return (
      <Animated.View style={[styles.proactiveWrap, { opacity, transform: [{ translateY }] }]}>
        <View style={styles.proactiveTag}>
          <Text style={styles.proactiveTagText}>✨ 主动分享见闻</Text>
        </View>
        <View style={styles.proactiveCard}>
          <Text style={styles.proactiveText}>{isTyping ? '' : message.content || '……'}</Text>
          {isTyping ? <TypingDots color={colors.violet} /> : null}
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant, { opacity, transform: [{ translateY }] }]}>
      {!isUser && <Avatar name={companionName} avatarUrl={companionAvatar} size={32} />}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant, isGift && styles.bubbleGift]}>
        {isGift ? <Text style={styles.giftIcon}>{message.metadata.giftIcon ?? '🎁'}</Text> : null}
        {isTyping ? (
          <TypingDots color={isUser ? colors.textOnPrimary : colors.primary} />
        ) : (
          <Text style={[styles.text, isUser ? styles.textUser : styles.textAssistant]}>{message.content}</Text>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 6,
    paddingHorizontal: 14,
    gap: 8,
  },
  rowUser: {
    justifyContent: 'flex-end',
  },
  rowAssistant: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...shadows.card,
  },
  bubbleUser: {
    backgroundColor: colors.primary,
    borderTopRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  bubbleGift: {
    backgroundColor: colors.violetSoft,
    borderWidth: 1,
    borderColor: colors.violetLight,
  },
  giftIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  text: {
    fontSize: fontSizes.lg,
    lineHeight: 22,
  },
  textUser: {
    color: colors.textOnPrimary,
    fontWeight: fontWeights.medium,
  },
  textAssistant: {
    color: colors.textPrimary,
  },
  proactiveWrap: {
    alignItems: 'center',
    marginVertical: 10,
    paddingHorizontal: 24,
  },
  proactiveTag: {
    backgroundColor: colors.violetLight,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 8,
  },
  proactiveTagText: {
    color: colors.violet,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
  },
  proactiveCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.violetLight,
    borderRadius: radii.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    maxWidth: '90%',
  },
  proactiveText: {
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    lineHeight: 20,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
