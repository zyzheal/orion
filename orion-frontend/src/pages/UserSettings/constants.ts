/**
 * constants.ts - UserSettings 类型与默认数据
 * 抽取自 UserSettings/index.tsx (P2-9 Phase 101)
 */

export interface ProfileFormValues {
  displayName?: string;
  phone?: string;
}

export interface PasswordFormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface NotificationFormValues {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  webhookEnabled: boolean;
  webhookUrl?: string;
  notifyFrequency: string;
}

export interface OAuthBinding {
  provider: string;
  bound: boolean;
  bindTime?: string;
}

export const DEFAULT_OAUTH_BINDINGS: OAuthBinding[] = [
  { provider: 'github', bound: false },
  { provider: 'gitlab', bound: false },
];

export const NOTIFICATION_FREQUENCY_OPTIONS = [
  { label: '实时', value: 'realtime' },
  { label: '每日汇总', value: 'daily' },
  { label: '每周汇总', value: 'weekly' },
];
