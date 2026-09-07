/**
 * CodeScan constants
 */
import type { ScanStatus, SeverityLevel, VulnCategory } from './types';

export const SEVERITY_CONFIG: Record<SeverityLevel, { label: string; color: string }> = {
  critical: { label: '严重', color: 'red' },
  high: { label: '高危', color: 'orange' },
  medium: { label: '中危', color: 'gold' },
  low: { label: '低危', color: 'blue' },
  info: { label: '信息', color: 'default' },
};

export const STATUS_CONFIG: Record<ScanStatus, { label: string; color: string }> = {
  pending: { label: '待扫描', color: 'default' },
  running: { label: '扫描中', color: 'processing' },
  completed: { label: '已完成', color: 'success' },
  failed: { label: '失败', color: 'error' },
};

export const CATEGORY_CONFIG: Record<VulnCategory, { label: string; owasp: string }> = {
  injection: { label: '注入攻击', owasp: 'A03:2021' },
  auth: { label: '身份认证失败', owasp: 'A07:2021' },
  xss: { label: '跨站脚本', owasp: 'A03:2021' },
  csrf: { label: 'CSRF 攻击', owasp: 'A05:2021' },
  security_misconfig: { label: '安全配置错误', owasp: 'A05:2021' },
  sensitive_data: { label: '敏感数据泄露', owasp: 'A02:2021' },
  aam: { label: '访问控制失效', owasp: 'A01:2021' },
  vulnerable_components: { label: '漏洞组件', owasp: 'A06:2021' },
  integrity: { label: '完整性校验失败', owasp: 'A06:2021' },
  logging: { label: '日志审计不足', owasp: 'A09:2021' },
};
