/**
 * PerformanceFlameGraphConfig (P2-9)
 * 性能火焰图页面的纯配置和工具函数提取。
 *
 * 包含:
 * - 布局常量 (zoom/frame/panel dimensions)
 * - 火焰图配色方案 (FLAME_COLORS / FLAME_TEXT_COLORS)
 * - 深度颜色选择工具
 * - 火焰图展平算法 (flattenFlameGraph)
 * - 数值/百分比格式化工具
 * - 标签截断工具
 * - 类别统计计算
 */

import type { FlameGraphFrame } from '@/api/flamegraph';

// ---- 布局与缩放常量 ----

/** 缩放级别最小值 */
export const ZOOM_MIN = 0.5;
/** 缩放级别最大值 */
export const ZOOM_MAX = 6;
/** 每层帧高度 (px) */
export const FRAME_HEIGHT = 22;
/** 帧间间隙 (px) */
export const FRAME_GAP = 1;
/** 最小帧宽度 (px) */
export const MIN_FRAME_WIDTH = 3;
/** 显示标签的最小宽度 (px) */
export const MIN_LABEL_WIDTH = 30;
/** 顶部工具栏高度 (px) */
export const HEADER_HEIGHT = 56;
/** 底部图例高度 (px) */
export const LEGEND_HEIGHT = 44;
/** 右侧详情面板宽度 (px) */
export const DETAIL_PANEL_WIDTH = 360;

// ---- 类型定义 ----

/** 火焰图渲染行信息 */
export interface RenderRow {
  frame: FlameGraphFrame;
  depth: number;
  x: number; // 在该行中的 x 偏移（相对行宽的比例 0~1）
  w: number; // 在该行中的宽度比例 0~1
}

// ---- 火焰图经典配色 (热度由浅到深) ----

/** 火焰图颜色数组（按深度索引选择） */
export const FLAME_COLORS: string[] = [
  '#F5C77E', // 浅 - 低层 (叶子)
  '#E07A5F',
  '#C44536',
  '#9E2A2B',
  '#821F20', // 深 - 高层 (根)
];

/** 对应文字颜色（浅色帧用深色文字，深色帧用白色文字） */
export const FLAME_TEXT_COLORS: string[] = [
  '#1f1f1f',
  '#1f1f1f',
  '#ffffff',
  '#ffffff',
  '#ffffff',
];

// ---- 深度颜色选择 ----

/** 根据深度选择帧背景颜色（深度 = 0 为根节点） */
export const colorByDepth = (depth: number): string => {
  const i = Math.min(
    FLAME_COLORS.length - 1,
    Math.max(0, depth % FLAME_COLORS.length)
  );
  return FLAME_COLORS[i];
};

/** 根据深度选择文字颜色 */
export const textColorByDepth = (depth: number): string => {
  const i = Math.min(
    FLAME_TEXT_COLORS.length - 1,
    Math.max(0, depth % FLAME_TEXT_COLORS.length)
  );
  return FLAME_TEXT_COLORS[i];
};

// ---- 数值/百分比格式化 ----

/** 格式化数值（自动添加 K/M 后缀） */
export const formatValue = (v: number): string => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(2)}K`;
  return v.toString();
};

/** 格式化百分比 */
export const formatPct = (pct: number): string => `${pct.toFixed(1)}%`;

// ---- 标签截断 ----

/** 截断标签以适应帧宽度 */
export const truncateLabel = (name: string, availableWidth: number): string => {
  // 每个字符大约 5.5px (fontSize=10)
  const maxChars = Math.floor((availableWidth - 8) / 5.5);
  if (maxChars <= 0) return '';
  if (name.length <= maxChars) return name;
  // 优先截取最后一个 "." 之前的部分
  const dotIdx = name.lastIndexOf('.', maxChars);
  if (dotIdx > 4) return '\u2026' + name.substring(dotIdx);
  return name.substring(0, maxChars - 1) + '\u2026';
};

// ---- 火焰图数据算法 ----

/** 计算节点总 value（包含子节点） */
export const getTotalValue = (frame: FlameGraphFrame): number => {
  const sum = (f: FlameGraphFrame): number => {
    if (f.children && f.children.length > 0) {
      return f.children.reduce((acc, c) => acc + sum(c), 0);
    }
    return f.value;
  };
  return sum(frame);
};

/**
 * 将火焰图递归展平为 RenderRow 列表。
 * 算法：DFS 遍历，每层累积 value 占比。
 * 支持 collapsed 节点（展开/收起）。
 */
export const flattenFlameGraph = (
  frame: FlameGraphFrame,
  collapsed: Set<string>,
  depth: number = 0,
  parentValue: number = 0
): RenderRow[] => {
  const rows: RenderRow[] = [];

  const processLayer = (f: FlameGraphFrame, d: number, layerRows: RenderRow[]) => {
    const total = parentValue > 0 ? parentValue : getTotalValue(f);
    let accum = 0;

    const children = collapsed.has(f.name) ? [] : f.children || [];

    if (children.length === 0 || total <= 0) {
      layerRows.push({ frame: f, depth: d, x: 0, w: 1 });
    } else {
      for (const child of children) {
        const childTotal = getTotalValue(child);
        const ratio = childTotal / total;
        layerRows.push({ frame: child, depth: d + 1, x: accum, w: ratio });
        accum += ratio;
        processLayer(child, d + 1, layerRows);
      }
    }
  };

  processLayer(frame, depth, rows);
  return rows;
};

/** 计算最大深度（用于图例） */
export const getMaxDepth = (rows: RenderRow[]): number =>
  rows.length > 0 ? Math.max(...rows.map((r) => r.depth)) : 0;

/**
 * 计算类别统计（叶子节点按 category 分组）。
 * @returns 每个类别的 value 和百分比
 */
export const getCategoryStats = (
  frame: FlameGraphFrame,
  totalValue: number
): Record<string, { value: number; pct: number }> => {
  const stats: Record<string, { value: number; pct: number }> = {};
  const collect = (f: FlameGraphFrame) => {
    if (f.children && f.children.length > 0) {
      for (const c of f.children) collect(c);
    } else {
      const cat = f.category || 'uncategorized';
      if (!stats[cat]) stats[cat] = { value: 0, pct: 0 };
      stats[cat].value += f.value;
    }
  };
  collect(frame);
  for (const cat of Object.keys(stats)) {
    stats[cat].pct = totalValue > 0 ? (stats[cat].value / totalValue) * 100 : 0;
  }
  return stats;
};
