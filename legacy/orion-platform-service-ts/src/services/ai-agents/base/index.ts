/**
 * AI Agent 基础模块导出
 *
 * 提供：
 * - types.ts: Agent 相关类型定义
 * - ToolAdapter.ts: AI → 业务服务适配器
 * - BaseAgent.ts: Agent 抽象基类
 */

export * from './types';
export { ToolAdapter } from './ToolAdapter';
export { BaseAgent } from './BaseAgent';