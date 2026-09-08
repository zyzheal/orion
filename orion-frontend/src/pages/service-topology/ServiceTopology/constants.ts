/**
 * constants.ts - ServiceTopology 常量定义
 * 抽取自 index.tsx (P2-9 Phase 226)
 */
import { colors } from '@/tokens';

export const DEPENDENCY_TYPE_COLORS: Record<string, string> = {
  database: colors.primary[500],
  cache: colors.success[500],
  queue: colors.warning[500],
  external: colors.purple[500],
  calls: colors.info[500],
};

export const DEPENDENCY_DESCRIPTIONS: Record<string, string> = {
  database: '数据库依赖',
  cache: '缓存依赖',
  queue: '消息队列依赖',
  external: '外部服务依赖',
  calls: '服务间调用',
};
