/**
 * PasswordPolicy helpers
 * 抽取自 index.tsx (P2-9 Phase 144)
 */
import { colors } from '@/tokens';

export const COMMON_STYLE = {
  primary: colors.primary[500],
  success: colors.success[500],
  warning: colors.warning[500],
  error: colors.error[500],
  info: colors.info[500],
  neutral: colors.neutral[500],
};

export const calculatePasswordStrength = (
  password: string
): { score: number; label: string; color: string } => {
  let score = 0;
  if (password.length >= 8) score += 20;
  else if (password.length >= 6) score += 10;
  if (/[A-Z]/.test(password)) score += 15;
  if (/[a-z]/.test(password)) score += 15;
  if (/[0-9]/.test(password)) score += 15;
  if (/[^A-Za-z0-9]/.test(password)) score += 20;
  if (password.length >= 12) score += 10;
  if (password.length >= 16) score += 5;

  let label = '弱';
  let color: string = colors.error[500];
  if (score >= 80) {
    label = '非常强';
    color = colors.success[500];
  } else if (score >= 60) {
    label = '强';
    color = colors.info[500];
  } else if (score >= 40) {
    label = '一般';
    color = colors.warning[500];
  }

  return { score, label, color };
};

export const hasConsecutiveChars = (password: string, threshold = 3): boolean => {
  for (let i = 0; i <= password.length - threshold; i++) {
    const slice = password.slice(i, i + threshold);
    if (slice.split('').every((ch) => ch === slice[0])) return true;
  }
  return false;
};

export const COMMON_WORDS = [
  'password',
  'admin',
  '123456',
  'qwerty',
  'letmein',
  'welcome',
  'monkey',
  'dragon',
];

export const containsDictionaryWord = (password: string): boolean => {
  const lower = password.toLowerCase();
  return COMMON_WORDS.some((word) => lower.includes(word));
};

export interface HistoryRecord {
  key: string;
  username: string;
  updatedAt: string;
  oldHash: string;
  status: string;
}

export const MOCK_HISTORY_DATA: HistoryRecord[] = [];
