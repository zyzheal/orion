/**
 * ServiceCatalog constants
 */
export const SLA_STATUS_MAP: Record<string, { color: string; label: string }> = {
  breached: { color: 'red', label: '已违规' },
  warning: { color: 'orange', label: '接近违规' },
  ok: { color: 'green', label: '正常' },
};
