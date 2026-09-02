import { colors } from '@/tokens';

export const scriptTypeLabel: Record<string, string> = {
  shell: 'Shell',
  python: 'Python',
  powershell: 'PowerShell',
  ansible: 'Ansible',
};

export const scriptTypeColor: Record<string, string> = {
  shell: 'green',
  python: 'blue',
  powershell: 'purple',
  ansible: 'orange',
};

export const paramTypeLabel: Record<string, string> = {
  string: '字符串',
  number: '数字',
  boolean: '布尔',
  secret: '密钥',
};

export const statusColor: Record<string, string> = {
  pending: colors.neutral[400],
  running: colors.primary[500],
  completed: colors.success[500],
  failed: colors.error[500],
};

export const statusLabel: Record<string, string> = {
  pending: '待执行',
  running: '执行中',
  completed: '已完成',
  failed: '失败',
};

export const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
};
