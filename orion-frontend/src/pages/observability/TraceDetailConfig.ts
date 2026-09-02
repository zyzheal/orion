/**
 * TraceDetailConfig (P2-9)
 * Trace 详情页的纯配置和工具函数提取。
 *
 * 包含:
 * - 布局常量 (zoom/row/tree dimensions)
 * - Span 状态映射 (颜色、标签)
 * - 服务条形图颜色配置
 * - 时间/持续时间格式化
 * - Span 树构建与扁平化
 * - Span 状态判断
 */

import type { Span } from '@/api/trace';
import { colors } from '@/tokens/colors';

// ---- 布局与缩放常量 ----

/** 缩放级别最小值 */
export const ZOOM_MIN = 0.25;
/** 缩放级别最大值 */
export const ZOOM_MAX = 8;
/** 每行 span 高度 (px) */
export const ROW_HEIGHT = 36;
/** span 条最小高度 (px) */
export const BAR_MIN_HEIGHT = 18;
/** span 条最小宽度 (px, 防止太短不可见) */
export const BAR_MIN_WIDTH = 2;
/** 左侧树形列宽度 (px) */
export const TREE_COL_WIDTH = 320;
/** 顶部时间轴标题高度 (px) */
export const HEADER_HEIGHT = 40;
/** 底部时间轴坐标轴高度 (px) */
export const AXIS_HEIGHT = 30;
/** 行间间隙 (px) */
export const ROW_GAP = 2;

// ---- 类型定义 ----

/** Span 树节点（含子节点索引和深度） */
export interface SpanNode {
  span: Span;
  children: SpanNode[];
  depth: number;
}

// ---- 服务条形图颜色池 ----

/** 服务条形图颜色数组（按索引分配给不同服务） */
export const serviceBarColors: string[] = [
  colors.primary[500],
  colors.info[500],
  colors.purple[500],
  colors.success[500],
  colors.warning[500],
  '#FF8C00',
  '#00BCD4',
  '#E91E63',
];

// ---- 时间工具函数 ----

/** 将 nanoseconds 转为 milliseconds */
export const nsToMs = (ns: number): number => ns / 1_000_000;

/** 解析 span 的持续时间 (ms) */
export const spanDurationMs = (span: Span): number => {
  if (span.durationMs) return span.durationMs;
  if (span.durationNs) return nsToMs(span.durationNs);
  const start = Date.parse(span.startTime);
  const end = Date.parse(span.endTime);
  return Math.max(0, end - start);
};

/** 解析 span 的开始时间 (ms from epoch) */
export const spanStartMs = (span: Span): number => {
  const t = Date.parse(span.startTime);
  return isNaN(t) ? 0 : t;
};

/** 格式化持续时间为可读字符串 */
export const formatDuration = (durationNs: number): string => {
  const ms = nsToMs(durationNs);
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}min`;
};

/** 格式化 ISO 时间戳为本地可读时间 */
export const formatTime = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleTimeString('zh-CN', { hour12: false });
};

// ---- Span 状态映射 ----

/** 判断 span 是否为错误状态 */
export const isSpanError = (span: Span): boolean => span.statusCode === 'ERROR';

/** Span 状态标签颜色 */
export const statusColor = (statusCode: string): string => {
  switch (statusCode) {
    case 'OK':
      return colors.success[500];
    case 'ERROR':
      return colors.error[500];
    default:
      return colors.neutral[500];
  }
};

/** Span 状态标签文本 */
export const statusLabel = (statusCode: string): string => {
  switch (statusCode) {
    case 'OK':
      return 'OK';
    case 'ERROR':
      return 'ERROR';
    default:
      return 'UNSET';
  }
};

// ---- Span 条形图颜色 ----

/** 为 span 选择条形颜色（优先用服务色，错误状态用红色） */
export const getBarColor = (span: Span, serviceColorMap: Map<string, string>): string => {
  if (isSpanError(span)) return colors.error[500];
  if (span.service && serviceColorMap.has(span.service)) {
    return serviceColorMap.get(span.service)!;
  }
  return colors.primary[500];
};

/** 为 span 选择条形悬停颜色（深色版本） */
export const getBarHoverColor = (color: string): string => {
  if (color === colors.error[500]) return colors.error[700];
  if (color === colors.success[500]) return colors.success[700];
  if (color === colors.primary[500]) return colors.primary[700];
  if (color === colors.info[500]) return colors.info[700];
  if (color === colors.purple[500]) return colors.purple[700];
  return colors.neutral[700];
};

// ---- Span 树构建 ----

/**
 * 构建 Span 树（基于 parentId 建立父子关系）
 * @param spans 扁平的 span 列表
 * @returns 根节点列表
 */
export const buildSpanTree = (spans: Span[]): SpanNode[] => {
  const nodeMap = new Map<string, SpanNode>();
  const roots: SpanNode[] = [];

  // 第一遍：创建节点
  for (const s of spans) {
    nodeMap.set(s.spanId, { span: s, children: [], depth: 0 });
  }

  // 第二遍：建立父子关系
  for (const s of spans) {
    const node = nodeMap.get(s.spanId)!;
    if (s.parentId && nodeMap.has(s.parentId)) {
      nodeMap.get(s.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // 第三遍：计算深度
  const setDepth = (node: SpanNode, d: number) => {
    node.depth = d;
    for (const child of node.children) {
      setDepth(child, d + 1);
    }
  };
  for (const root of roots) setDepth(root, 0);

  return roots;
};

/**
 * 将树扁平化为行列表（保持 DFS 顺序）
 * @param nodes 树根节点列表
 * @returns 扁平化的 SpanNode 数组
 */
export const flattenSpanTree = (nodes: SpanNode[]): SpanNode[] => {
  const result: SpanNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children.length > 0) {
      result.push(...flattenSpanTree(node.children));
    }
  }
  return result;
};
