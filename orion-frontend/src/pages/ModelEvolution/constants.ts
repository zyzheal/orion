/**
 * ModelEvolution constants
 * 抽取自 index.tsx (P2-9 Phase 199)
 */
export const CAPABILITY_COLORS: Record<string, string> = {
  text: 'blue',
  vision: 'purple',
  code: 'green',
  multimodal: 'orange',
};

export const CAPABILITY_LABEL: Record<string, string> = {
  text: '文本',
  vision: '视觉',
  code: '代码',
  multimodal: '多模态',
};

export const STATUS_MAP: Record<string, { color: string; label: string }> = {
  stable: { color: 'green', label: '稳定' },
  beta: { color: 'orange', label: '灰度' },
  deprecated: { color: 'default', label: '弃用' },
};
