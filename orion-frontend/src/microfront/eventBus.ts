/**
 * 微前端事件总线
 * 用于主应用与子应用之间的通信
 */

type EventHandler = (data: unknown) => void;

class MicroFrontendEventBus {
  private events: Map<string, Set<EventHandler>>;

  constructor() {
    this.events = new Map();
  }

  /**
   * 订阅事件
   */
  on(event: string, handler: EventHandler): void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(handler);
  }

  /**
   * 取消订阅
   */
  off(event: string, handler: EventHandler): void {
    const handlers = this.events.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.events.delete(event);
      }
    }
  }

  /**
   * 发布事件
   */
  emit(event: string, data?: unknown): void {
    const handlers = this.events.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(`[EventBus] Error in handler for event "${event}":`, error);
        }
      });
    }
  }

  /**
   * 订阅一次事件
   */
  once(event: string, handler: EventHandler): void {
    const onceHandler = (data: unknown) => {
      handler(data);
      this.off(event, onceHandler);
    };
    this.on(event, onceHandler);
  }

  /**
   * 清空所有事件
   */
  clear(): void {
    this.events.clear();
  }

  /**
   * 获取事件监听器数量
   */
  listenerCount(event: string): number {
    return this.events.get(event)?.size ?? 0;
  }
}

// 创建全局事件总线实例
export const eventBus = new MicroFrontendEventBus();

export default eventBus;
