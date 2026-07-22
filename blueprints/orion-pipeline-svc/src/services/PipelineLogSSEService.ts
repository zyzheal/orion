/**
 * Pipeline Log SSE Service
 *
 * 为 Pipeline 执行提供实时日志推送
 * 使用 Server-Sent Events (SSE) 实现实时日志流
 */
import { EventEmitter } from 'events';
import { FastifyReply } from 'fastify';
import { SSEConnectionManager, SSEConnection } from '../chatops/SSEConnectionManager';

export interface PipelineLogEvent {
  pipelineId: string;
  runId: string;
  stageId: string;
  stageName: string;
  stepName?: string;
  logLine: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  metadata?: Record<string, unknown>;
}

export interface PipelineStatusEvent {
  pipelineId: string;
  runId: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  stageId?: string;
  stageName?: string;
  progress: number;
  timestamp: Date;
}

export interface PipelineExecutionEvent {
  type: 'log' | 'status' | 'stage_start' | 'stage_end' | 'step_start' | 'step_end';
  data: PipelineLogEvent | PipelineStatusEvent;
}

/**
 * Pipeline Log SSE Service
 *
 * 提供 Pipeline 执行日志的实时推送能力
 */
export class PipelineLogSSEService {
  private sseManager: SSEConnectionManager;
  private localBus: EventEmitter;

  // Pipeline 相关事件订阅
  private readonly PIPELINE_EVENTS = [
    'pipeline.log',
    'pipeline.status',
    'pipeline.stage_start',
    'pipeline.stage_end',
    'pipeline.step_start',
    'pipeline.step_end',
  ];

  constructor(localBus: EventEmitter) {
    this.localBus = localBus;
    this.sseManager = new SSEConnectionManager(localBus);

    // 监听 Pipeline 事件并广播到 SSE 客户端
    this.setupEventForwarding();
  }

  /**
   * 设置事件转发 - 从 EventBus 转发到 SSE 客户端
   */
  private setupEventForwarding(): void {
    for (const eventType of this.PIPELINE_EVENTS) {
      this.localBus.on(eventType, (data: PipelineLogEvent | PipelineStatusEvent) => {
        this.broadcastToPipeline(data.pipelineId, {
          type: eventType.replace('pipeline.', '') as PipelineExecutionEvent['type'],
          data,
        });
      });
    }
  }

  /**
   * 创建 SSE 连接 - 为特定 Pipeline Run
   */
  createConnection(
    pipelineId: string,
    runId: string,
    userId: string,
    reply: FastifyReply,
    options?: {
      includeLogs?: boolean;
      includeStatus?: boolean;
      logLevel?: PipelineLogEvent['level'][];
    }
  ): string {
    const connId = `pipeline-${pipelineId}-${runId}-${Date.now()}`;

    // 创建事件监听器
    const listener = (event: PipelineExecutionEvent) => {
      // 过滤：只推送该 Pipeline Run 的事件
      if (event.data.pipelineId !== pipelineId) return;
      if ('runId' in event.data && event.data.runId !== runId) return;

      // 过滤：日志级别
      if (event.type === 'log' && options?.logLevel) {
        const logEvent = event.data as PipelineLogEvent;
        if (!options.logLevel.includes(logEvent.level)) return;
      }

      this.sendEvent(reply, event);
    };

    const conn: Omit<SSEConnection, 'heartbeatTimer'> = {
      id: connId,
      userId,
      listener: listener as unknown as (data: Record<string, unknown>) => void,
      connectedAt: new Date(),
    };

    this.sseManager.addConnection(conn, reply);

    // 发送连接成功消息
    this.sendEvent(reply, {
      type: 'connected',
      data: {
        pipelineId,
        runId,
        timestamp: new Date(),
        message: 'SSE connection established for pipeline logs',
      },
    });

    return connId;
  }

  /**
   * 发送 SSE 事件到客户端
   */
  private sendEvent(reply: FastifyReply, event: PipelineExecutionEvent | { type: 'connected'; data: any }): void {
    const raw = reply.raw;

    // 安全写入检查
    if (raw?.writableEnded) return;

    try {
      const eventStr = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
      raw.write(eventStr);
    } catch (error) {
      console.error('[PipelineLogSSE] Failed to send event:', error);
    }
  }

  /**
   * 广播事件到特定 Pipeline 的所有订阅者
   */
  private broadcastToPipeline(pipelineId: string, event: PipelineExecutionEvent): void {
    // 通过 localBus 广播，SSEConnectionManager 的 listener 会处理
    this.localBus.emit(`pipeline:${pipelineId}:update`, event);
  }

  /**
   * 发布 Pipeline 日志事件
   */
  publishLogEvent(log: PipelineLogEvent): void {
    this.localBus.emit('pipeline.log', log);
  }

  /**
   * 发布 Pipeline 状态事件
   */
  publishStatusEvent(status: PipelineStatusEvent): void {
    this.localBus.emit('pipeline.status', status);
  }

  /**
   * 发布 Stage 开始事件
   */
  publishStageStart(pipelineId: string, runId: string, stageId: string, stageName: string): void {
    this.localBus.emit('pipeline.stage_start', {
      pipelineId,
      runId,
      stageId,
      stageName,
      status: 'running',
      progress: 0,
      timestamp: new Date(),
    });
  }

  /**
   * 发布 Stage 结束事件
   */
  publishStageEnd(
    pipelineId: string,
    runId: string,
    stageId: string,
    stageName: string,
    status: 'success' | 'failed' | 'skipped',
    progress: number
  ): void {
    this.localBus.emit('pipeline.stage_end', {
      pipelineId,
      runId,
      stageId,
      stageName,
      status,
      progress,
      timestamp: new Date(),
    });
  }

  /**
   * 发布 Step 开始事件
   */
  publishStepStart(
    pipelineId: string,
    runId: string,
    stageId: string,
    stageName: string,
    stepName: string
  ): void {
    this.localBus.emit('pipeline.step_start', {
      pipelineId,
      runId,
      stageId,
      stageName,
      stepName,
      logLine: `[Step] ${stepName} started`,
      timestamp: new Date(),
      level: 'info',
    });
  }

  /**
   * 发布 Step 结束事件
   */
  publishStepEnd(
    pipelineId: string,
    runId: string,
    stageId: string,
    stageName: string,
    stepName: string,
    status: 'success' | 'failed',
    durationMs?: number
  ): void {
    this.localBus.emit('pipeline.step_end', {
      pipelineId,
      runId,
      stageId,
      stageName,
      stepName,
      logLine: `[Step] ${stepName} ${status}${durationMs ? ` (${durationMs}ms)` : ''}`,
      timestamp: new Date(),
      level: status === 'failed' ? 'error' : 'info',
      metadata: { durationMs },
    });
  }

  /**
   * 移除 SSE 连接
   */
  removeConnection(connId: string): void {
    this.sseManager.removeConnection(connId);
  }

  /**
   * 优雅关闭
   */
  async shutdown(): Promise<void> {
    await this.sseManager.shutdown();
  }

  /**
   * 获取活跃连接统计
   */
  getStats(): {
    totalConnections: number;
    connectionsByUser: Map<string, number>;
  } {
    return {
      totalConnections: this.sseManager.getActiveConnectionCount(),
      connectionsByUser: this.sseManager.getConnectionsByUser(),
    };
  }
}

// 默认导出
export const pipelineLogSSE = new PipelineLogSSEService(new EventEmitter());