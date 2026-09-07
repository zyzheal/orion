/**
 * ComplianceScan constants
 * 抽取自 index.tsx (P2-9 Phase 188)
 */
import type { ComplianceLevel, ScanStatus, FrameworkType } from './types';

export const levelConfig: Record<ComplianceLevel, { label: string; color: string }> = {
  critical: { label: '严重', color: 'red' },
  high: { label: '高危', color: 'orange' },
  medium: { label: '中危', color: 'gold' },
  low: { label: '低危', color: 'blue' },
  info: { label: '信息', color: 'default' },
};

export const statusConfig: Record<ScanStatus, { label: string; color: string }> = {
  pending: { label: '待扫描', color: 'default' },
  running: { label: '扫描中', color: 'processing' },
  completed: { label: '已完成', color: 'success' },
  failed: { label: '失败', color: 'error' },
};

export const frameworkConfig: Record<FrameworkType, { label: string; color: string }> = {
  owasp: { label: 'OWASP Top 10', color: 'red' },
  cis: { label: 'CIS Benchmark', color: 'blue' },
  pci: { label: 'PCI DSS', color: 'purple' },
  hipaa: { label: 'HIPAA', color: 'cyan' },
  soc2: { label: 'SOC 2', color: 'green' },
  internal: { label: '内部基线', color: 'default' },
};
