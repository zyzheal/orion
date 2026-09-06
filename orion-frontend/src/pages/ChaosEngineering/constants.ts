/**
 * constants.ts - 混沌工程常量
 * 抽取自 ChaosEngineering/index.tsx (P2-9 Phase 91)
 */
export const faultTypeConfig: Record<string, { label: string; color: string }> = {
  network_latency: { label: '网络延迟', color: 'orange' },
  service_down: { label: '服务下线', color: 'red' },
  cpu_stress: { label: 'CPU 压力', color: 'magenta' },
  memory_stress: { label: '内存压力', color: 'purple' },
  disk_full: { label: '磁盘填充', color: 'gold' },
};

export const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'default' },
  active: { label: '就绪', color: 'green' },
  completed: { label: '已完成', color: 'blue' },
  archived: { label: '已归档', color: 'gold' },
};

export const envConfig: Record<string, { label: string; color: string }> = {
  staging: { label: '预发环境', color: 'blue' },
  production: { label: '生产环境', color: 'red' },
};
