import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, shadows, zIndex } from '../theme';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** 是否允许点背景关闭（默认 true） */
  dismissable?: boolean;
}

/** 底部弹出层（礼物/会员/支付等） */
export function Sheet({ visible, onClose, children, style, dismissable = true }: SheetProps) {
  const translateY = useRef(new Animated.Value(400)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      translateY.setValue(400);
      backdrop.setValue(0);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 9, tension: 60 }),
        Animated.timing(backdrop, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, translateY, backdrop]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={dismissable ? onClose : undefined} />
        </Animated.View>
        <Animated.View style={[styles.sheet, style, { transform: [{ translateY }] }]}>{children}</Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(26, 16, 38, 0.5)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    paddingBottom: 24,
    paddingTop: 12,
    ...shadows.sheet,
    zIndex: zIndex.sheet,
    maxHeight: '88%',
  },
});
