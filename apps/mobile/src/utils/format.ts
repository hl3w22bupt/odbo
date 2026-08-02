/**
 * 纯工具函数（不依赖 React Native，便于单元测试）
 */

/** 生成简易唯一 id（前端占位/乐观消息使用） */
export function genId(prefix = 'id'): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const time = Date.now().toString(36).slice(-6);
  return `${prefix}_${time}${rand}`;
}

/** 手机号简单校验（中国大陆 11 位，1 开头） */
export function isValidPhone(phone: string): boolean {
  return /^1\d{10}$/.test(phone.trim());
}

/** 验证码：4-6 位数字 */
export function isValidCode(code: string): boolean {
  return /^\d{4,6}$/.test(code.trim());
}

/** 金额分 → 元字符串 */
export function centsToYuan(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** 数字 → 千分位字符串 */
export function formatNumber(n: number): string {
  return n.toLocaleString('zh-CN');
}

/** 好感度级别文案 */
export function affectionLevelLabel(level: number): string {
  switch (level) {
    case 1:
      return '初识';
    case 2:
      return '熟悉';
    case 3:
      return '亲近';
    case 4:
      return '信任';
    case 5:
      return '知己';
    default:
      return '初识';
  }
}

/** 距现在多久的中文描述（主动分享卡片/时间戳） */
export function timeAgo(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return '';
  const diff = Math.max(0, Date.now() - date.getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 小时前`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day} 天前`;
  return date.toLocaleDateString('zh-CN');
}

/** 相对时间 HH:mm */
export function clockTime(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** 从完整名取姓氏/首字（头像字母） */
export function avatarLetter(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '伴';
  return trimmed.charAt(0);
}

/** 防沉迷深夜时段是否命中（23:00 - 06:00） */
export function isLateNight(date: Date = new Date()): boolean {
  const h = date.getHours();
  return h >= 23 || h < 6;
}
