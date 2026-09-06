/**
 * constants.ts - RunnerManagement 常量配置
 * 抽取自 RunnerManagement/index.tsx (P2-9 Phase 59)
 */
import type { RunnerStatus } from '@/api/runners';

export const STATUS_CONFIG: Record<RunnerStatus, { color: string; label: string }> = {
  online: { color: 'green', label: '在线' },
  busy: { color: 'gold', label: '忙碌' },
  offline: { color: 'default', label: '离线' },
  draining: { color: 'red', label: '下线中' },
};

export const HEARTBEAT_TIMEOUT_MINUTES = 5;

export function isHeartbeatStale(lastHeartbeat: string): boolean {
  const timeoutMs = HEARTBEAT_TIMEOUT_MINUTES * 60 * 1000;
  return Date.now() - new Date(lastHeartbeat).getTime() > timeoutMs;
}
