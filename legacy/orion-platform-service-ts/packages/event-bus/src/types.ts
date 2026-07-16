/**
 * 事件总线核心类型定义
 */

import { CloudEvent } from './CloudEvent';

/**
 * 事件处理函数
 */
export interface EventHandler<T = any> {
  (event: CloudEvent<T>, context: EventContext): Promise<void> | void;
}

/**
 * 事件上下文
 */
export interface EventContext {
  /** 订阅 ID */
  subscriptionId: string;
  /** 序列号 */
  seq: number;
  /** 时间戳 */
  timestamp: Date;
  /** 重试次数 */
  retryCount: number;
}

/**
 * 重试配置
 */
export interface RetryConfig {
  /** 最大重试次数 */
  maxRetries: number;
  /** 初始重试延迟 (ms) */
  initialDelayMs: number;
  /** 最大重试延迟 (ms) */
  maxDelayMs: number;
  /** 指数退避乘数 */
  multiplier: number;
}

/**
 * 订阅配置
 */
export interface SubscriptionOptions {
  /** 订阅名称 (持久化订阅必需) */
  durableName?: string;
  /** 流名称 */
  streamName: string;
  /** 主题过滤 */
  filterSubject?: string;
  /** 自动 ACK */
  autoAck?: boolean;
  /** 最大未确认消息数 */
  maxAckPending?: number;
  /** 批量大小 */
  batchSize?: number;
  /** 心跳间隔 (ms) */
  idleHeartbeat?: number;
  /** 从何处开始消费 */
  deliverPolicy?: 'all' | 'last' | 'new' | 'byStartSequence' | 'byStartTime';
  /** 起始序列号 */
  optStartSeq?: number;
  /** 起始时间 */
  optStartTime?: Date;
}

/**
 * 发布配置
 */
export interface PublishOptions {
  /** 主题 */
  subject: string;
  /** 事件类型 */
  type: string;
  /** 事件源 */
  source: string;
  /** 事件 ID (可选，自动生成) */
  id?: string;
  /** 时间戳 (可选，默认当前时间) */
  time?: Date;
  /** 扩展属性 */
  extensions?: Record<string, any>;
}

/**
 * 订阅接口
 */
export interface Subscription {
  /** 订阅 ID */
  id: string;
  /** 取消订阅 */
  unsubscribe(): Promise<void>;
  /**  draining - 处理完剩余消息后关闭 */
  drain(): Promise<void>;
  /** 是否已关闭 */
  isClosed: boolean;
}

/**
 * 死信队列配置
 */
export interface DLQConfig {
  /** 死信主题 */
  subject: string;
  /** 最大投递次数 */
  maxDeliver: number;
}

/**
 * EventBus 配置
 */
export interface EventBusConfig {
  /** NATS 服务器 URL 列表 */
  servers: string[];
  /** 用户认证 */
  user?: string;
  /** 密码认证 */
  pass?: string;
  /** Token 认证 */
  token?: string;
  /** JWT 认证 */
  jwt?: string;
  /** 私钥认证 */
  nkey?: string;
  /** 连接超时 (ms) */
  timeout?: number;
  /** 重连配置 */
  reconnect?: {
    /** 是否启用重连 */
    enabled: boolean;
    /** 最大重连次数 */
    maxRetries: number;
    /** 重连间隔 (ms) */
    interval: number;
  };
  /** 日志配置 */
  logging?: {
    /** 日志级别 */
    level: 'debug' | 'info' | 'warn' | 'error';
    /** 自定义日志函数 */
    logger?: (level: string, message: string, ...args: any[]) => void;
  };
  /** 死信队列配置 */
  deadLetterQueue?: DLQConfig;
  /** 重试配置 */
  retry?: RetryConfig;
}

/**
 * Stream 配置
 */
export interface StreamConfig {
  /** 流名称 */
  name: string;
  /** 主题列表 */
  subjects: string[];
  /** 副本数 */
  replicas: number;
  /** 存储类型 */
  storage: 'memory' | 'file';
  /** 保留策略 */
  retention: 'limits' | 'interest' | 'workqueue';
  /** 最大消息数 */
  maxMsgs?: number;
  /** 最大字节数 */
  maxBytes?: number;
  /** 最大消息存活时间 */
  maxAge?: string;
  /** 最大消息大小 */
  maxMsgSize?: number;
}

/**
 * 事件指标
 */
export interface EventMetrics {
  /** 发布的事件数 */
  published: number;
  /** 接收的事件数 */
  received: number;
  /** 处理成功的事件数 */
  processed: number;
  /** 处理失败的事件数 */
  failed: number;
  /** 重试次数 */
  retries: number;
  /** 死信队列消息数 */
  deadLettered: number;
  /** 平均处理时间 (ms) */
  avgProcessingTime: number;
}
