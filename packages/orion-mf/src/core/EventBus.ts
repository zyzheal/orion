/**
 * EventBus - 带版本控制的跨子应用通信模块
 *
 * 提供基于 Channel 的事件通信机制，支持版本控制，
 * 用于微前端架构中子应用之间的解耦通信。
 */

/**
 * 事件处理器类型
 */
export interface EventBusHandler {
  (payload: EventBusPayload): void;
}

/**
 * EventBus 事件载荷
 */
export interface EventBusPayload {
  event: string;
  data: any;
  version: string;
}

/**
 * Channel 配置选项
 */
export interface ChannelOptions {
  version?: string;
}

/**
 * Channel 事件监听器映射
 */
type ListenerMap = Map<string, Set<EventBusHandler>>;

/**
 * Channel 类 - 负责管理特定通道内的事件订阅和发布
 * 私有类，不对外暴露
 */
class Channel {
  private listeners: ListenerMap = new Map();
  private version: string;

  constructor(version: string) {
    this.version = version;
  }

  /**
   * 获取当前 Channel 版本
   */
  getVersion(): string {
    return this.version;
  }

  /**
   * 订阅事件
   * @param event 事件名称
   * @param handler 事件处理函数
   */
  on(event: string, handler: EventBusHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  /**
   * 取消订阅事件
   * @param event 事件名称
   * @param handler 事件处理函数
   */
  off(event: string, handler: EventBusHandler): void {
    this.listeners.get(event)?.delete(handler);
  }

  /**
   * 发布事件
   * @param event 事件名称
   * @param data 事件数据
   */
  emit(event: string, data: any): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;

    for (const handler of handlers) {
      try {
        handler({
          event,
          data,
          version: this.version,
        });
      } catch (e) {
        console.error(`[EventBus] Handler error for event "${event}":`, e);
      }
    }
  }

  /**
   * 获取特定事件的监听器数量
   * @param event 事件名称
   */
  getListenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  /**
   * 获取所有已订阅的事件列表
   */
  getSubscribedEvents(): string[] {
    return Array.from(this.listeners.keys());
  }

  /**
   * 清空所有监听器
   */
  clear(): void {
    this.listeners.clear();
  }
}

/**
 * EventBus 类 - 带版本控制的全局事件总线
 *
 * 使用单例模式，确保全局只有一个 EventBus 实例。
 * 支持创建多个 Channel，每个 Channel 有独立的版本控制。
 */
export class EventBus {
  private static instance: EventBus;
  private channels: Map<string, Channel> = new Map();
  private currentVersion: string = '2.0.0';

  private constructor() {}

  /**
   * 获取 EventBus 单例实例
   */
  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * 设置默认版本号
   * @param version 版本号
   */
  setDefaultVersion(version: string): void {
    this.currentVersion = version;
  }

  /**
   * 获取当前默认版本号
   */
  getDefaultVersion(): string {
    return this.currentVersion;
  }

  /**
   * 创建或获取 Channel
   * @param key Channel 标识符
   * @param version 可选的版本号，默认使用全局版本
   */
  createChannel(key: string, version?: string): Channel {
    if (this.channels.has(key)) {
      return this.channels.get(key)!;
    }

    const channel = new Channel(version ?? this.currentVersion);
    this.channels.set(key, channel);
    return channel;
  }

  /**
   * 移除 Channel
   * @param key Channel 标识符
   */
  removeChannel(key: string): void {
    const channel = this.channels.get(key);
    if (channel) {
      channel.clear();
      this.channels.delete(key);
    }
  }

  /**
   * 获取 Channel
   * @param key Channel 标识符
   */
  getChannel(key: string): Channel | undefined {
    return this.channels.get(key);
  }

  /**
   * 检查 Channel 是否存在
   * @param key Channel 标识符
   */
  hasChannel(key: string): boolean {
    return this.channels.has(key);
  }

  /**
   * 获取所有 Channel 标识符
   */
  getChannelKeys(): string[] {
    return Array.from(this.channels.keys());
  }

  /**
   * 清空所有 Channel（用于测试或重置）
   */
  clearAll(): void {
    for (const channel of this.channels.values()) {
      channel.clear();
    }
    this.channels.clear();
  }
}

/**
 * 获取全局 EventBus 实例的便捷函数
 */
export const eventBus = EventBus.getInstance();