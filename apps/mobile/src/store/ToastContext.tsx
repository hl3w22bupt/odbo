import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { colors, fontSizes, radii, zIndex } from '../theme';

interface ToastOptions {
  title?: string;
  message: string;
  type?: 'info' | 'success' | 'error';
}

interface ToastContextValue {
  showToast: (options: string | ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION = 2600;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<(ToastOptions & { id: number }) | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(
    (options: string | ToastOptions) => {
      const opts: ToastOptions = typeof options === 'string' ? { message: options } : options;
      if (timer.current) clearTimeout(timer.current);
      setToast({ ...opts, id: Date.now() });
      opacity.setValue(0);
      translateY.setValue(12);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 8 }),
      ]).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
          setToast(null);
        });
      }, TOAST_DURATION);
    },
    [opacity, translateY],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <Animated.View pointerEvents="none" style={[styles.wrap, { opacity, transform: [{ translateY }] }]}>
          <Text style={styles.title}>{toast.title ?? ''}</Text>
          <Text style={styles.message}>{toast.message}</Text>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast 必须在 <ToastProvider> 内使用');
  return ctx;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 32,
    right: 32,
    top: 64,
    zIndex: zIndex.toast,
    backgroundColor: 'rgba(43, 27, 61, 0.94)',
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  title: {
    color: colors.goldLight,
    fontSize: fontSizes.sm,
    fontWeight: '600',
    marginBottom: 2,
  },
  message: {
    color: colors.textOnDark,
    fontSize: fontSizes.md,
    textAlign: 'center',
  },
});
