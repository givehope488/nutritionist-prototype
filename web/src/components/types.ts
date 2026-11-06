// 组件库公共属性类型（SFC 的 <script setup> 内不能声明模块导出，集中放这里）
export interface TabItem {
  value: string;
  label: string;
  count?: number;
}

export interface SegmentedItem {
  value: string;
  label: string;
}

export interface RadioOption {
  value: string;
  label: string;
  hint?: string;
  disabled?: boolean;
  /** 禁用原因：表单项被规则锁住时给出可读解释（如未成年不可减脂） */
  disabledReason?: string;
}

export type Tone = 'neutral' | 'ok' | 'warn' | 'info' | 'danger' | 'brand';
