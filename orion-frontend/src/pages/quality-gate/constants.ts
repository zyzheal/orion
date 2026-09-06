/**
 * constants.ts - 质量门禁常量映射
 * 抽取自 quality-gate/QualityGatePage.tsx (P2-9 Phase 77)
 */

export const severityColorMap: Record<string, string> = {
  block: 'red',
  warning: 'orange',
  info: 'blue',
};

export const severityLabelMap: Record<string, string> = {
  block: '阻止',
  warning: '警告',
  info: '信息',
};

export const violationStatusColorMap: Record<string, string> = {
  open: 'red',
  waived: 'gold',
  resolved: 'green',
};

export const violationStatusLabelMap: Record<string, string> = {
  open: '未处理',
  waived: '已豁免',
  resolved: '已解决',
};

export const categoryColorMap: Record<string, string> = {
  security: 'red',
  cost: 'blue',
  quality: 'green',
  governance: 'purple',
};
