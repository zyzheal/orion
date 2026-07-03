/**
 * 成本事件发布器
 *
 * 将成本相关事件发布到 NATS 事件总线，供下游服务消费
 * 支持 cost.collected 和 cost.anomaly_detected 事件类型
 */

import { CostEvent, CostEventType } from './types';
import { createLogger } from '../utils/logger';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

const logger = pino({ name: 'LCost-LEvent-LPublisher' });

/**
 * 事件总线接口（兼容 EventBusService）
 */
export interface IEventBus {
  publish(type: string, data: any, options?: { source?: string }): Promise<string>;
  isHealthy(): boolean;
}

/**
 * 成本采集事件数据
 */
export interface CostCollectedEventData {
  /** 采集来源 */
  source: string;
  /** 成本记录数量 */
  recordCount: number;
  /** 总成本 */
  totalCost: number;
  /** 货币单位 */
  currency: string;
  /** 采集时间范围 */
  periodStart: string;
  periodEnd: string;
  /** 按类型分组的成本 */
  costByType?: Record<string, number>;
  /** 按租户分组的成本 */
  costByTenant?: Record<string, number>;
}

/**
 * 成本异常事件数据
 */
export interface CostAnomalyEventData {
  /** 异常类型 */
  anomalyType: 'spend_spike' | 'budget_exceeded' | 'unusual_pattern';
  /** 当前成本 */
  currentCost: number;
  /** 预期成本 */
  expectedCost: number;
  /** 变化率（百分比） */
  changeRate: number;
  /** 阈值（百分比） */
  threshold: number;
  /** 受影响的服务/资源 */
  affectedResources?: string[];
  /** 租户 ID */
  tenantId?: string;
  /** 环境 */
  environment?: string;
  /** 建议操作 */
  recommendation?: string;
}

/**
 * 成本事件发布器配置
 */
export interface CostEventPublisherConfig {
  /** 事件总线实例 */
  eventBus?: IEventBus;
  /** 事件来源标识 */
  source?: string;
}

/**
 * 成本事件发布器
 */
export class CostEventPublisher {
  private eventBus?: IEventBus;
  private source: string;
  private publishedEvents: CostEvent[] = [];

  constructor(config?: CostEventPublisherConfig) {
    this.eventBus = config?.eventBus;
    this.source = config?.source || 'orion-platform-service';
  }

  /**
   * 发布成本采集完成事件
   *
   * 当从云厂商/K8s/SaaS 采集到成本数据时调用
   */
  async publishCostCollected(data: CostCollectedEventData): Promise<string> {
    const event: CostEvent = {
      type: 'cost.collected',
      source: this.source,
      data: data as Record<string, any>,
      timestamp: new Date(),
    };

    this.publishedEvents.push(event);

    if (this.eventBus) {
      try {
        const eventId = await this.eventBus.publish('cost.collected', event, {
          source: this.source,
        });
        return eventId;
      } catch (error) {
        logger.warn('[CostEventPublisher] Failed to publish cost.collected event:', error);
      }
    }

    return `mock-cost-event-${Date.now()}`;
  }

  /**
   * 发布成本异常检测事件
   *
   * 当检测到花费异常（如花费突增）时调用
   */
  async publishCostAnomaly(data: CostAnomalyEventData): Promise<string> {
    const event: CostEvent = {
      type: 'cost.anomaly_detected',
      source: this.source,
      data: data as Record<string, any>,
      timestamp: new Date(),
    };

    this.publishedEvents.push(event);

    if (this.eventBus) {
      try {
        const eventId = await this.eventBus.publish('cost.anomaly_detected', event, {
          source: this.source,
        });
        return eventId;
      } catch (error) {
        logger.warn('[CostEventPublisher] Failed to publish cost.anomaly_detected event:', error);
      }
    }

    return `mock-anomaly-event-${Date.now()}`;
  }

  /**
   * 检测花费突增并发布异常事件
   *
   * @param currentCost 当前成本
   * @param baselineCost 基准成本
   * @param thresholdPercent 突增阈值（百分比）
   */
  async detectAndPublishSpendSpike(
    currentCost: number,
    baselineCost: number,
    thresholdPercent: number = 50
  ): Promise<string | null> {
    if (baselineCost <= 0) {
      return null;
    }

    const changeRate = ((currentCost - baselineCost) / baselineCost) * 100;

    if (changeRate > thresholdPercent) {
      return this.publishCostAnomaly({
        anomalyType: 'spend_spike',
        currentCost,
        expectedCost: baselineCost,
        changeRate: Math.round(changeRate * 100) / 100,
        threshold: thresholdPercent,
        recommendation: `Cost increased by ${Math.round(changeRate)}% compared to baseline. Review resource allocation.`,
      });
    }

    return null;
  }

  /**
   * 获取已发布的事件
   */
  getPublishedEvents(): CostEvent[] {
    return [...this.publishedEvents];
  }

  /**
   * 清空已发布的事件记录
   */
  clearPublishedEvents(): void {
    this.publishedEvents = [];
  }

  /**
   * 获取事件发布统计
   */
  getEventStats(): {
    totalPublished: number;
    costCollected: number;
    costAnomaly: number;
  } {
    const costCollected = this.publishedEvents.filter((e) => e.type === 'cost.collected').length;
    const costAnomaly = this.publishedEvents.filter((e) => e.type === 'cost.anomaly_detected').length;

    return {
      totalPublished: this.publishedEvents.length,
      costCollected,
      costAnomaly,
    };
  }
}
