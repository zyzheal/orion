/**
 * 微前端事件总线
 *
 * 直接使用 @orion-mf/core 的 EventBus Channel 机制。
 * 主应用与子应用统一使用 Channel API 通信。
 */
import { eventBus as coreEventBus } from '@orion-mf/core';

/**
 * 默认 Channel 名称（主应用与子应用公共通信通道）
 */
export const DEFAULT_CHANNEL = 'microfrontend';

let defaultChannelInstance: ReturnType<typeof coreEventBus.createChannel> | null = null;

/**
 * 获取默认 Channel 实例（单例，避免竞态条件）
 */
export function getDefaultChannel() {
  if (!defaultChannelInstance) {
    const existing = coreEventBus.getChannel(DEFAULT_CHANNEL);
    defaultChannelInstance = existing ?? coreEventBus.createChannel(DEFAULT_CHANNEL);
  }
  return defaultChannelInstance;
}

/**
 * 为指定子应用创建独立 Channel
 */
export function createSubAppChannel(subAppKey: string) {
  return coreEventBus.createChannel(`subapp:${subAppKey}`);
}

/**
 * 按 Owner 批量清理所有 Channel 中的订阅
 */
export function cleanupByOwner(owner: string) {
  coreEventBus.cleanupByOwner(owner);
}

/**
 * 直接暴露 core EventBus 实例（高级用法）
 */
export { coreEventBus };

export default {
  DEFAULT_CHANNEL,
  getDefaultChannel,
  createSubAppChannel,
  cleanupByOwner,
  coreEventBus,
};
