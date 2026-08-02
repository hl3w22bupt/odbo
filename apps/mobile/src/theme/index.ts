/**
 * 心伴AI · 视觉主题
 * 米白底 + 玫红主色 + 深紫氛围背景
 */
export const colors = {
  // 背景
  background: '#FBF6F1',
  backgroundDeep: '#2A1B3D',
  backgroundDeepLight: '#3B2A57',
  surface: '#FFFFFF',
  surfaceAlt: '#F6EFE9',

  // 主色（玫红）
  primary: '#E8486F',
  primaryDark: '#C93356',
  primaryLight: '#FCE4EC',
  primarySoft: '#FDEFF4',

  // 紫色氛围
  violet: '#7C5CBF',
  violetLight: '#EDE7F7',
  violetSoft: '#F4F0FB',

  // 文字
  textPrimary: '#2E2437',
  textSecondary: '#8A7F93',
  textTertiary: '#B4A9BE',
  textOnDark: '#F6EFFF',
  textOnPrimary: '#FFFFFF',

  // 状态
  success: '#2FC98C',
  warning: '#F5A623',
  danger: '#E5484D',
  info: '#3B82C4',

  // 边框与描边
  border: '#EFE2D8',
  borderLight: '#F7EDE6',
  divider: '#F0E6DF',

  // 品牌金（皇冠/限量）
  gold: '#F5B93A',
  goldLight: '#FDEEC9',

  // 在线状态
  online: '#2FC98C',
  onlineBg: '#DCF7EB',
} as const;

export type ColorKey = keyof typeof colors;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  hero: 40,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
} as const;

export const fontSizes = {
  xs: 11,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 22,
  hero: 30,
  display: 38,
} as const;

export const fontWeights = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  heavy: '800' as const,
};

export const shadows = {
  card: {
    shadowColor: '#3A2A18',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  sheet: {
    shadowColor: '#1B1226',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
  },
} as const;

export const zIndex = {
  base: 0,
  card: 1,
  header: 10,
  sheet: 100,
  modal: 200,
  toast: 300,
} as const;

export const layout = {
  screenPadding: spacing.lg,
  headerHeight: 56,
  inputBarHeight: 64,
  cardGap: spacing.md,
} as const;
