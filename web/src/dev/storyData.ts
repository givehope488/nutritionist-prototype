// 故事页元数据：把 tokens 变成可走查的清单（设计系统交付物的一部分）
import type { ApiErrorCode } from '@shared/types';

export interface Swatch {
  token: string;
  use: string;
}

export const SWATCHES: Swatch[] = [
  { token: '--color-brand-500', use: '主操作' },
  { token: '--color-brand-50', use: '选中底色' },
  { token: '--color-text-primary', use: '正文' },
  { token: '--color-text-secondary', use: '次要文字' },
  { token: '--color-text-tertiary', use: '说明文字' },
  { token: '--color-bg-page', use: '页面底色' },
  { token: '--color-bg-surface', use: '卡片底色' },
  { token: '--color-ok', use: '判定 ok' },
  { token: '--color-warn', use: '判定 warn' },
  { token: '--color-danger', use: '错误' },
  { token: '--color-info', use: '提示' },
  { token: '--color-macro-kcal', use: '热量条' },
  { token: '--color-macro-protein', use: '蛋白条' },
  { token: '--color-macro-fat', use: '脂肪条' },
  { token: '--color-macro-carbs', use: '碳水条' },
  { token: '--color-macro-sodium', use: '钠条' },
];

export interface TypographyRow {
  token: string;
  sample: string;
  use: string;
}

export const TYPOGRAPHY_ROWS: TypographyRow[] = [
  { token: '--font-size-2xl', sample: '22 页面主标题', use: '首屏数字' },
  { token: '--font-size-xl', sample: '18 卡片标题', use: '判定标题' },
  { token: '--font-size-lg', sample: '16 正文基准，防 iOS 输入缩放', use: '正文 / 按钮' },
  { token: '--font-size-md', sample: '14 次级信息：菜品名、表单值', use: '列表' },
  { token: '--font-size-sm', sample: '13 辅助说明与数值', use: '元信息' },
  { token: '--font-size-xs', sample: '12 免责/提示文案，仅非关键', use: '提示' },
];

export const APP_ERROR_CODES: ApiErrorCode[] = [
  'UNAUTHORIZED',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'INTERNAL',
];
