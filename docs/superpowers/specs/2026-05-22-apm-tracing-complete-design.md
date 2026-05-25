# APM 链路追踪模块完整设计文档

> 文档版本: v1.0 | 2026-05-22 | 状态: 待评审
> 模块评分目标: 4.5/10 → 8.0/10
> 对应升级计划: `docs/plans/orion-upgrade-executable-plan-2026-05-22.md` Section 11.6, Migration 191

---

## 目录

- [1. 业务闭环与架构总览](#1-业务闭环与架构总览)
- [2. TraceID 传播机制](#2-traceid-传播机制)
- [3. Span 数据模型](#3-span-数据模型)
- [4. 采集 SDK 设计](#4-采集-sdk-设计)
- [5. 采样策略](#5-采样策略)
- [6. 存储设计（大数据量）](#6-存储设计大数据量)
- [7. 查询分析能力](#7-查询分析能力)
- [8. 外部依赖检查与可复用组件](#8-外部依赖检查与可复用组件)
- [9. 权限模型](#9-权限模型)
- [10. API 设计](#10-api-设计)
- [11. 前端页面交互设计](#11-前端页面交互设计)
- [12. 验收标准与量化指标](#12-验收标准与量化指标)
- [13. 实施计划](#13-实施计划)

---

## 1. 业务闭环与架构总览

### 1.1 完整业务链路

```
应用服务 (Node.js/Python/Java)
  │
  ├─ ① SDK 注入 (Fastify 中间件 / Python 装饰器 / Java Agent)
  │   └─ 自动捕获请求入口/出口、数据库调用、外部 API 调用
  │
  ├─ ② TraceID 传播
  │   └─ W3C Trace Context (HTTP traceparent) / gRPC metadata / MQ header
  │
  ├─ ③ Span 采集
  │   └─ 本地 Buffer 批量提交，每 1s 或 500 spans 触发一次
  │
  └─ ④ 上报至 Orion Platform
      │
      ├─ POST /api/v1/apm/ingest/spans (批量上报)
      │
      └─ ⑤ 聚合存储
          ├─ apm_services 表 (服务注册与元数据)
          ├─ apm_traces 表 (Trace 主记录)
          └─ apm_spans 表 (Span 详细记录，按月分区)
              │
              └─ ⑥ 查询分析
                  ├─ Trace 详情 (trace_id 还原完整调用链)
                  ├─ 服务拓扑 (span 关系推导服务依赖)
                  ├─ 慢调用分析 (P50/P95/P99)
                  └─ 错误率分析 (按 service/operation 聚合)
```

### 1.2 与现有模块的关系

| 现有模块 | 关系 | 是否合并 |
|---------|------|---------|
| `llm_traces` (Migration 080) | 仅覆盖 LLM 调用链，属于 APM 的子集 | **不合并表**，但查询 API 可通过 `trace_id` 关联。LLM trace 的 `trace_id` 可作为 APM span 的 `external_reference_id` 关联查询 |
| `MetricCollector` (monitoring 服务) | 内存存储的指标采集，无持久化 | APM 使用独立的 PostgreSQL 持久化，但可复用 `AlertRuleEngine` 的告警能力 |
| `MonitoringController` | 监控指标与告警控制 | APM 有独立路由 `/api/v1/apm`，但可复用 `MonitoringController` 的告警通道 |

### 1.3 系统架构图

```
┌──────────────────────────────────────────────────────────────────┐
│                        Orion APM 架构                             │
├──────────────────────────────────────────────────────────────────┤
│  采集层                                                           │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐            │
│  │ Node.js SDK │  │ Python Agent │  │ Java Agent    │            │
│  │ (Fastify)   │  │ (decorator)  │  │ (optional)    │            │
│  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘            │
│         │                │                   │                     │
│         └────────────────┼───────────────────┘                     │
│                          │ Batch Upload (HTTP)                      │
├──────────────────────────┼─────────────────────────────────────────┤
│  接入层                   │                                          │
│  ┌───────────────────────▼──────────────────────────────────┐      │
│  │  Ingestion Service (ApmIngestionService)                 │      │
│  │  - 批量接收 / 格式校验 / 采样决策 / 去重                  │      │
│  │  - 写入 Buffer → 批量落盘 (1s or 500 spans)              │      │
│  └───────────────────────┬──────────────────────────────────┘      │
├──────────────────────────┼─────────────────────────────────────────┤
│  存储层                   │                                          │
│  ┌───────────────────────▼──────────────────────────────────┐      │
│  │  PostgreSQL (分区表)                                      │      │
│  │  apm_services │ apm_traces │ apm_spans_YYYYMM             │      │
│  │  apm_sampling_configs │ apm_error_stats_daily             │      │
│  └───────────────────────────────────────────────────────────┘      │
├──────────────────────────────────────────────────────────────────┤
│  查询层                                                           │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐      │
│  │ Trace 查询   │ │ 服务拓扑     │ │ 统计分析               │      │
│  │ ApmTraceRepo │ │ TopologySvc  │ │ AnalyticsService      │      │
│  └──────────────┘ └──────────────┘ └──────────────────────┘      │
├──────────────────────────────────────────────────────────────────┤
│  展示层                                                           │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐      │
│  │ Trace 搜索   │ │ Trace 详情   │ │ 服务拓扑/慢调用/错误  │      │
│  │ /apm/traces  │ │ /:traceId    │ │ /apm/services 等      │      │
│  └──────────────┘ └──────────────┘ └──────────────────────┘      │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. TraceID 传播机制

### 2.1 W3C Trace Context 标准

采用 [W3C Trace Context](https://www.w3.org/TR/trace-context/) 标准，通过 `traceparent` HTTP Header 传播：

```
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
             │  └────────────── trace_id (32 hex) ──────────────┘ │  └─ parent_span_id (16 hex) ─┘ │
             version                                               sampled (01=on, 00=off)
```

### 2.2 各协议传播方式

| 协议 | 传播方式 | 实现细节 |
|------|---------|---------|
| HTTP/HTTPS | `traceparent` Header | 标准 W3C 格式，所有 HTTP 请求自动注入 |
| gRPC | `metadata` (`traceparent` key) | 通过 gRPC Interceptor 注入到 outgoing metadata，从 incoming metadata 提取 |
| 消息队列 (RabbitMQ/Kafka) | Message Header | 发布时写入 `traceparent` header，消费时提取 |
| 进程内 (AsyncLocal) | `AsyncLocalStorage` (Node.js) | 同一请求上下文内的 Span 通过 ALS 共享 trace_id |

### 2.3 跨进程传播完整链路

```
Client Service                        Server Service
     │                                      │
  ① 生成 trace_id                           │
     trace_id = randomUUID()                │
     span_id = randomUUID()                 │
     │                                      │
  ② 创建 outgoing span                      │
     span = { trace_id, span_id,            │
              parent_span_id: null,          │
              operationName: 'GET /api' }    │
     │                                      │
  ③ 注入 traceparent header                 │
     headers.traceparent =                   │
     `00-${trace_id}-${span_id}-01`          │
     │                                      │
  ④ 发送 HTTP 请求 ──────────────────────→  ⑤ 提取 traceparent header
                                             trace_id = '4bf9...'
                                             parent_span_id = '00f0...'
                                             │
                                          ⑥ 创建 child span
                                             span = { trace_id,
                                              span_id: newUUID(),
                                              parent_span_id,
                                              operationName: 'process' }
                                             │
                                          ⑦ 继续向下传播...
```

### 2.4 TraceID 格式规范

- **长度**: 32 位十六进制字符（128-bit）
- **生成**: `crypto.randomUUID().replace(/-/g, '')` 取前 32 位
- **Span ID**: 16 位十六进制字符（64-bit）
- **Parent Span ID**: 16 位十六进制字符，根 Span 为 `0000000000000000`

---

## 3. Span 数据模型

### 3.1 apm_traces 表（Trace 主记录）

```sql
-- Trace 主表：每个 trace_id 一条记录，存储 trace 级别的聚合信息
CREATE TABLE IF NOT EXISTS apm_traces (
    id                  BIGSERIAL PRIMARY KEY,
    trace_id            VARCHAR(64) NOT NULL UNIQUE,
    tenant_id           INTEGER NOT NULL,

    -- 基本信息
    root_service        VARCHAR(255) NOT NULL,           -- 根服务名称
    root_operation      VARCHAR(255) NOT NULL,           -- 根操作名称
    total_spans         INTEGER DEFAULT 1,               -- Span 总数
    start_time          TIMESTAMPTZ NOT NULL,            -- Trace 开始时间
    end_time            TIMESTAMPTZ,                     -- Trace 结束时间
    duration_ms         INTEGER NOT NULL,                -- 总耗时（ms）

    -- 状态
    status              VARCHAR(16) DEFAULT 'ok',        -- ok / error / timeout
    error_message       TEXT,                            -- 错误摘要
    error_service       VARCHAR(255),                    -- 首个报错的服务

    -- 采样信息
    sample_rate         DECIMAL(5,4) DEFAULT 1.0,        -- 采样率
    sampling_strategy   VARCHAR(32) DEFAULT 'default',   -- default / adaptive / critical

    -- 关联
    external_trace_id   VARCHAR(255),                    -- 外部 trace_id（如 LLM trace_id）
    user_id             VARCHAR(64),                     -- 触发用户
    request_id          VARCHAR(64),                     -- 请求 ID
    tags                JSONB DEFAULT '{}',              -- Trace 级别标签

    -- 时间
    created_at          TIMESTAMPTZ DEFAULT NOW(),

    -- 分区键
    partition_date      DATE GENERATED ALWAYS AS (DATE(start_time)) STORED
) PARTITION BY RANGE (partition_date);

-- 注释
COMMENT ON TABLE apm_traces IS 'APM 链路追踪主表（按时间分区）';
COMMENT ON COLUMN apm_traces.trace_id IS 'W3C 标准 Trace ID (32 hex)';
COMMENT ON COLUMN apm_traces.root_service IS '根服务名称';
COMMENT ON COLUMN apm_traces.total_spans IS '该 Trace 包含的 Span 总数';
COMMENT ON COLUMN apm_traces.external_trace_id IS '外部追踪系统 ID（如 llm_traces.trace_id）';
COMMENT ON COLUMN apm_traces.sampling_strategy IS '采样策略: default/adaptive/critical';
```

### 3.2 apm_spans 表（Span 详细记录）

```sql
-- Span 详细表：每个 span 一条记录，按操作名称、层级关系组织
CREATE TABLE IF NOT EXISTS apm_spans (
    id                  BIGSERIAL NOT NULL,
    trace_id            VARCHAR(64) NOT NULL,
    span_id             VARCHAR(16) NOT NULL,
    parent_span_id      VARCHAR(16),                     -- 父 Span ID，根节点为 NULL

    -- 租户与分区
    tenant_id           INTEGER NOT NULL,
    partition_date      DATE NOT NULL,

    -- Span 标识
    service_name        VARCHAR(255) NOT NULL,           -- 服务名称
    operation_name      VARCHAR(255) NOT NULL,           -- 操作名称（如 GET /api/users）
    span_kind           VARCHAR(16) DEFAULT 'internal',  -- internal / client / server / producer / consumer

    -- 时间
    start_time          TIMESTAMPTZ NOT NULL,
    end_time            TIMESTAMPTZ,
    duration_ms         INTEGER NOT NULL,                -- 耗时（ms），由 end_time - start_time 计算

    -- 状态
    status_code         VARCHAR(16) DEFAULT 'ok',        -- ok / error / unset
    status_message      TEXT,                            -- 错误描述

    -- 详细信息
    tags                JSONB DEFAULT '{}',              -- Span 标签（HTTP method, DB statement 等）
    logs                JSONB DEFAULT '[]',              -- Span 内日志事件 [{timestamp, fields}]
    resource_attributes  JSONB DEFAULT '{}',             -- 资源属性（service.version, host.name 等）

    -- 层级
    depth               INTEGER DEFAULT 0,               -- 调用深度（根=0）
    is_critical_path    BOOLEAN DEFAULT FALSE,           -- 是否在关键路径上

    -- 时间
    created_at          TIMESTAMPTZ DEFAULT NOW(),

    PRIMARY KEY (id, partition_date),
    UNIQUE (trace_id, span_id, partition_date)
) PARTITION BY RANGE (partition_date);

COMMENT ON TABLE apm_spans IS 'APM Span 详细记录表（按时间分区）';
COMMENT ON COLUMN apm_spans.span_kind IS 'Span 类型: internal/client/server/producer/consumer';
COMMENT ON COLUMN apm_spans.tags IS 'OpenTelemetry 风格标签（http.method, db.statement, peer.service 等）';
COMMENT ON COLUMN apm_spans.logs IS 'Span 内事件日志 [{timestamp: string, fields: {key: value}}]';
COMMENT ON COLUMN apm_spans.depth IS '调用深度，用于 Gantt 图层级展示';
```

### 3.3 apm_services 表（服务注册与元数据）

```sql
-- 服务注册表：自动从 span 中聚合服务元数据
CREATE TABLE IF NOT EXISTS apm_services (
    id                  SERIAL PRIMARY KEY,
    tenant_id           INTEGER NOT NULL,
    service_name        VARCHAR(255) NOT NULL,
    service_version     VARCHAR(32),                     -- 服务版本
    language            VARCHAR(32),                     -- 编程语言 (nodejs, python, java)
    runtime             VARCHAR(64),                     -- 运行时版本 (node-20.11, python-3.12)

    -- 统计（每日更新）
    total_traces        BIGINT DEFAULT 0,
    error_traces        BIGINT DEFAULT 0,
    avg_duration_ms     INTEGER DEFAULT 0,
    p95_duration_ms     INTEGER DEFAULT 0,
    p99_duration_ms     INTEGER DEFAULT 0,
    last_active_at      TIMESTAMPTZ,

    -- 依赖关系（JSONB，由拓扑服务计算）
    dependencies        JSONB DEFAULT '[]',              -- [{service_name, call_count, avg_duration_ms, error_rate}]

    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (tenant_id, service_name)
);

COMMENT ON TABLE apm_services IS 'APM 服务注册与元数据表';
COMMENT ON COLUMN apm_services.dependencies IS '下游服务依赖列表，由拓扑分析服务定期计算';
```

### 3.4 辅助表

```sql
-- 采样配置表
CREATE TABLE IF NOT EXISTS apm_sampling_configs (
    id                  SERIAL PRIMARY KEY,
    tenant_id           INTEGER NOT NULL,
    service_name        VARCHAR(255),                    -- 服务名，NULL=全局配置
    operation_pattern   VARCHAR(255),                    -- 操作模式匹配（支持 * 通配）
    sample_rate         DECIMAL(5,4) NOT NULL DEFAULT 0.1, -- 采样率 (0.0-1.0)
    strategy            VARCHAR(32) DEFAULT 'default',   -- default / critical / adaptive
    min_sample_rate     DECIMAL(5,4) DEFAULT 0.01,       -- 自适应最小采样率
    max_sample_rate     DECIMAL(5,4) DEFAULT 1.0,        -- 自适应最大采样率
    error_trigger_rate  DECIMAL(5,4) DEFAULT 0.05,       -- 错误率触发阈值（自适应用）

    enabled             BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (tenant_id, service_name, operation_pattern)
);

-- 错误统计日聚合表
CREATE TABLE IF NOT EXISTS apm_error_stats_daily (
    id                  SERIAL PRIMARY KEY,
    tenant_id           INTEGER NOT NULL,
    stat_date           DATE NOT NULL,
    service_name        VARCHAR(255) NOT NULL,
    operation_name      VARCHAR(255) NOT NULL,
    error_type          VARCHAR(128),                    -- 错误类型（HTTP 5xx, Timeout, Exception）
    error_count         BIGINT DEFAULT 0,
    total_count         BIGINT DEFAULT 0,
    error_rate          DECIMAL(5,4),                    -- 错误率
    avg_duration_ms     INTEGER,
    top_errors          JSONB DEFAULT '[]',              -- Top 5 错误详情 [{message, count, sample_trace_id}]

    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (tenant_id, stat_date, service_name, operation_name, error_type)
);
```

### 3.5 与 llm_traces 的关系

APM 与 LLM Trace **不合并表**，原因：

1. **数据模型差异大**：`llm_traces` 存储 prompt/output/tokens 等 LLM 专有字段，`apm_spans` 存储通用分布式追踪字段
2. **查询模式不同**：LLM trace 按 model/scenario 查询，APM trace 按 service/operation 查询
3. **关联方式**：通过 `apm_traces.external_trace_id` 或 `apm_spans.tags.llm_trace_id` 实现跨表关联

查询时通过 JOIN 或 API 层聚合实现统一视图：

```typescript
// 查询 APM trace 时，自动附带关联的 LLM trace 信息
async function getTraceWithLLMInfo(traceId: string) {
  const trace = await apmTraceRepo.findByTraceId(traceId);
  const llmTraces = await llmTraceRepo.findByParentTraceId(trace.externalTraceId);
  return { ...trace, llm_traces: llmTraces };
}
```

---

## 4. 采集 SDK 设计

### 4.1 Node.js Agent（Fastify 中间件）

```typescript
// orion-platform-service/src/services/apm/sdk/NodeApmAgent.ts

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  serviceName: string;
  operationName: string;
  spanKind: 'internal' | 'client' | 'server' | 'producer' | 'consumer';
  startTime: Date;
  endTime: Date | null;
  durationMs: number | null;
  statusCode: 'ok' | 'error' | 'unset';
  statusMessage: string | null;
  tags: Record<string, string>;
  logs: Array<{ timestamp: string; fields: Record<string, string> }>;
  depth: number;
}

export interface NodeApmAgentConfig {
  serviceName: string;
  serviceVersion?: string;
  platformUrl: string;            // Orion 平台地址，如 http://localhost:3001
  batchSize?: number;             // 批量上报大小，默认 500
  flushIntervalMs?: number;       // 刷盘间隔，默认 1000ms
  sampleRate?: number;            // 采样率，默认 1.0（全量）
  ignorePaths?: string[];         // 忽略的路径，如 ['/healthz', '/metrics']
}

const spanContext = new AsyncLocalStorage<Span>();

export class NodeApmAgent {
  private config: Required<NodeApmAgentConfig>;
  private buffer: Span[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isFlushing = false;

  constructor(config: NodeApmAgentConfig) {
    this.config = {
      batchSize: 500,
      flushIntervalMs: 1000,
      sampleRate: 1.0,
      ignorePaths: ['/healthz', '/ready', '/metrics'],
      ...config,
    };
  }

  /** 注册到 Fastify 实例 */
  register(app: FastifyInstance) {
    // 入口中间件：创建根 Span
    app.addHook('onRequest', async (request, reply) => {
      if (this.config.ignorePaths.some(p => request.url.startsWith(p))) {
        return;
      }

      const traceId = this.extractOrCreateTraceId(request);
      const parentSpanId = this.extractParentSpanId(request);
      const span: Span = {
        traceId,
        spanId: this.generateSpanId(),
        parentSpanId,
        serviceName: this.config.serviceName,
        operationName: `${request.method} ${request.routeOptions.url || request.url}`,
        spanKind: 'server',
        startTime: new Date(),
        endTime: null,
        durationMs: null,
        statusCode: 'ok',
        statusMessage: null,
        tags: {
          'http.method': request.method,
          'http.url': request.url,
          'http.user_agent': request.headers['user-agent'] || '',
        },
        logs: [],
        depth: parentSpanId ? this.getParentDepth() + 1 : 0,
      };

      spanContext.enterWith(span);
      // 注入 traceparent 到 outgoing 请求（下游调用）
      this.injectTraceContext(request);
    });

    // 响应中间件：完成 Span
    app.addHook('onResponse', async (request, reply) => {
      const span = spanContext.getStore();
      if (!span) return;

      span.endTime = new Date();
      span.durationMs = span.endTime.getTime() - span.startTime.getTime();

      if (reply.statusCode >= 400) {
        span.statusCode = 'error';
        span.statusMessage = `HTTP ${reply.statusCode}`;
        span.tags['http.status_code'] = String(reply.statusCode);
      }

      this.addSpan(span);
    });

    app.addHook('onError', async (request, reply, error) => {
      const span = spanContext.getStore();
      if (!span) return;
      span.statusCode = 'error';
      span.statusMessage = error.message;
      span.tags['error.stack'] = error.stack || '';
    });
  }

  /** 创建子 Span（用于数据库调用、外部 API 调用等） */
  static createChildSpan(overrides: Partial<Omit<Span, 'traceId' | 'parentSpanId' | 'depth'>>): Span | null {
    const parent = spanContext.getStore();
    if (!parent) return null;

    const span: Span = {
      traceId: parent.traceId,
      spanId: NodeApmAgent.generateStaticSpanId(),
      parentSpanId: parent.spanId,
      serviceName: parent.serviceName,
      operationName: overrides.operationName || 'unknown',
      spanKind: overrides.spanKind || 'internal',
      startTime: new Date(),
      endTime: null,
      durationMs: null,
      statusCode: 'ok',
      statusMessage: null,
      tags: overrides.tags || {},
      logs: [],
      depth: parent.depth + 1,
    };

    return span;
  }

  /** 完成一个 Span */
  static finishSpan(span: Span, error?: Error) {
    span.endTime = new Date();
    span.durationMs = span.endTime.getTime() - span.startTime.getTime();
    if (error) {
      span.statusCode = 'error';
      span.statusMessage = error.message;
      span.tags['error.stack'] = error.stack || '';
    }
  }

  /** 批量上报 */
  private addSpan(span: Span) {
    if (Math.random() > this.config.sampleRate) return; // 采样过滤
    this.buffer.push(span);
    if (this.buffer.length >= this.config.batchSize) {
      this.flush();
    }
  }

  private async flush() {
    if (this.isFlushing || this.buffer.length === 0) return;
    this.isFlushing = true;

    const spans = this.buffer.splice(0);
    try {
      await fetch(`${this.config.platformUrl}/api/v1/apm/ingest/spans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spans, serviceVersion: this.config.serviceVersion }),
        keepalive: true,
      });
    } catch {
      // 上报失败时暂存到本地文件（降级）
      this.buffer.unshift(...spans);
    } finally {
      this.isFlushing = false;
    }
  }

  private extractOrCreateTraceId(request: FastifyRequest): string {
    const traceparent = request.headers['traceparent'] as string;
    if (traceparent) {
      const parts = traceparent.split('-');
      if (parts.length >= 3) return parts[1];
    }
    return randomUUID().replace(/-/g, '').slice(0, 32);
  }

  private extractParentSpanId(request: FastifyRequest): string | null {
    const traceparent = request.headers['traceparent'] as string;
    if (traceparent) {
      const parts = traceparent.split('-');
      if (parts.length >= 3) return parts[2];
    }
    return null;
  }

  private injectTraceContext(request: FastifyRequest) {
    const span = spanContext.getStore();
    if (!span) return;
    const traceparent = `00-${span.traceId}-${span.spanId}-01`;
    request.headers['x-trace-id'] = span.traceId;
    // 下游 HTTP 客户端（如 axios）可通过拦截器自动读取 x-trace-id 注入 traceparent
  }

  private getParentDepth(): number {
    const parent = spanContext.getStore();
    return parent ? parent.depth : 0;
  }

  private static generateStaticSpanId(): string {
    return randomUUID().replace(/-/g, '').slice(0, 16);
  }

  private generateSpanId(): string {
    return NodeApmAgent.generateStaticSpanId();
  }
}
```

### 4.2 Python Agent（装饰器）

```python
# orion-apm-sdk-python/orion_apm/__init__.py

import time
import uuid
import threading
import requests
from functools import wraps
from typing import Optional, Dict, Any, List

class Span:
    def __init__(self, trace_id: str, span_id: str, parent_span_id: Optional[str],
                 service_name: str, operation_name: str, span_kind: str = 'internal'):
        self.trace_id = trace_id
        self.span_id = span_id
        self.parent_span_id = parent_span_id
        self.service_name = service_name
        self.operation_name = operation_name
        self.span_kind = span_kind
        self.start_time = None
        self.end_time = None
        self.duration_ms = None
        self.status_code = 'ok'
        self.status_message = None
        self.tags = {}
        self.logs = []
        self.depth = 0

    def finish(self, error: Exception = None):
        self.end_time = time.time()
        self.duration_ms = int((self.end_time - self.start_time) * 1000)
        if error:
            self.status_code = 'error'
            self.status_message = str(error)
            self.tags['error.stack'] = str(error)

# Thread-local storage for current span context
_local = threading.local()

class OrionApmAgent:
    def __init__(self, service_name: str, platform_url: str = 'http://localhost:3001',
                 sample_rate: float = 1.0, batch_size: int = 500, flush_interval_ms: int = 1000):
        self.service_name = service_name
        self.platform_url = platform_url
        self.sample_rate = sample_rate
        self.batch_size = batch_size
        self.buffer: List[Dict] = []
        self._lock = threading.Lock()

    def trace(self, operation_name: str, span_kind: str = 'internal'):
        """装饰器：自动追踪函数调用"""
        def decorator(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                parent = getattr(_local, 'span', None)
                trace_id = parent.trace_id if parent else uuid.uuid4().hex[:32]
                span_id = uuid.uuid4().hex[:16]
                depth = (parent.depth + 1) if parent else 0

                span = Span(
                    trace_id=trace_id, span_id=span_id,
                    parent_span_id=parent.span_id if parent else None,
                    service_name=self.service_name,
                    operation_name=operation_name,
                    span_kind=span_kind,
                )
                span.depth = depth
                span.start_time = time.time()

                # 注入上下文到 thread-local
                _local.span = span

                try:
                    result = func(*args, **kwargs)
                    span.finish()
                    return result
                except Exception as e:
                    span.finish(error=e)
                    raise
                finally:
                    self._add_span(span)
                    _local.span = parent  # 恢复父上下文
            return wrapper
        return decorator

    def _add_span(self, span: Span):
        import random
        if random.random() > self.sample_rate:
            return
        with self._lock:
            self.buffer.append({
                'traceId': span.trace_id,
                'spanId': span.span_id,
                'parentSpanId': span.parent_span_id,
                'serviceName': span.service_name,
                'operationName': span.operation_name,
                'spanKind': span.span_kind,
                'startTime': span.start_time * 1000,  # ms
                'endTime': span.end_time * 1000 if span.end_time else None,
                'durationMs': span.duration_ms,
                'statusCode': span.status_code,
                'statusMessage': span.status_message,
                'tags': span.tags,
                'logs': span.logs,
                'depth': span.depth,
            })
            if len(self.buffer) >= self.batch_size:
                self._flush()

    def _flush(self):
        if not self.buffer:
            return
        spans = self.buffer[:]
        self.buffer.clear()
        try:
            requests.post(
                f'{self.platform_url}/api/v1/apm/ingest/spans',
                json={'spans': spans},
                timeout=5,
            )
        except Exception:
            self.buffer.extend(spans)  # 失败时重新入缓冲区
```

### 4.3 Java Agent（字节码增强，可选）

Java Agent 基于 **ByteBuddy** 字节码增强实现，作为独立 JAR 通过 `-javaagent` 参数加载：

```
-javaagent:orion-apm-java-agent-1.0.0.jar \
  -Dorion.apm.service.name=my-java-service \
  -Dorion.apm.platform.url=http://localhost:3001
```

核心实现要点：
- 使用 ByteBuddy AgentBuilder 拦截 `javax.servlet.Filter.doFilter` 和 `jakarta.servlet.http.HttpServlet.service`
- 通过 `Advice` 在方法入口/出口自动创建/完成 Span
- 支持 Spring MVC (`@Controller`)、Spring Boot Actuator、JDBC 连接池自动追踪
- 通过 gRPC `ClientInterceptor`/`ServerInterceptor` 实现 gRPC 传播

### 4.4 SDK 自动注入方式

| 环境 | 注入方式 | 配置位置 |
|------|---------|---------|
| K8s Deployment | Sidecar Init Container 注入 SDK 到 Pod | `orion-apm-sidecar` ConfigMap |
| Docker Compose | 通过 `ORION_APM_ENABLED=true` 环境变量 | `docker-compose.yml` |
| 本地开发 | `npm install @orion/apm-node` / `pip install orion-apm` | `package.json` / `requirements.txt` |

---

## 5. 采样策略

### 5.1 采样策略矩阵

| 策略 | 适用环境 | 采样率 | 触发条件 | 配置位置 |
|------|---------|--------|---------|---------|
| 全量采样 | 开发/测试 | 100% (1.0) | 默认 | `sample_rate: 1.0` |
| 固定比例采样 | 生产环境 | 可配置（默认 10%） | 默认策略 | `apm_sampling_configs` 表 |
| 自适应采样 | 生产环境 | 动态 1%-100% | 错误率 > 阈值 | `strategy: 'adaptive'` |
| 关键路径强制采样 | 全环境 | 100% (1.0) | 匹配 `operation_pattern` | `strategy: 'critical'` |

### 5.2 自适应采样算法

```typescript
// ApmSamplingService.ts — 自适应采样决策

interface AdaptiveSamplingConfig {
  minRate: number;        // 最小采样率，默认 0.01
  maxRate: number;        // 最大采样率，默认 1.0
  errorTriggerRate: number; // 错误率触发阈值，默认 0.05
  lookbackWindowMs: number; // 回看窗口，默认 300000 (5min)
  adjustmentStep: number;   // 调整步长，默认 0.1
}

export class ApmSamplingService {
  private currentRate: Map<string, number> = new Map();

  /** 决定是否采样 */
  shouldSample(tenantId: number, serviceName: string, operationName: string): boolean {
    const config = this.getSamplingConfig(tenantId, serviceName, operationName);

    if (config.strategy === 'critical') return true;
    if (config.strategy === 'default') return Math.random() < config.sampleRate;

    if (config.strategy === 'adaptive') {
      const rate = this.computeAdaptiveRate(tenantId, serviceName, config);
      this.currentRate.set(`${tenantId}:${serviceName}`, rate);
      return Math.random() < rate;
    }

    return Math.random() < config.sampleRate;
  }

  /** 计算自适应采样率 */
  private computeAdaptiveRate(
    tenantId: number, serviceName: string, config: AdaptiveSamplingConfig
  ): number {
    const currentRate = this.currentRate.get(`${tenantId}:${serviceName}`) ?? config.minRate;
    const errorRate = this.getRecentErrorRate(tenantId, serviceName, config.lookbackWindowMs);

    if (errorRate > config.errorTriggerRate) {
      // 错误率高：提高采样率到 50% 或 maxRate
      return Math.min(config.maxRate, currentRate + config.adjustmentStep * 5);
    }
    if (errorRate > config.errorTriggerRate / 2) {
      // 错误率中等：提高采样率到 25%
      return Math.min(0.5, currentRate + config.adjustmentStep * 2);
    }
    // 错误率正常：逐步降低到最小采样率
    return Math.max(config.minRate, currentRate - config.adjustmentStep);
  }

  /** 获取最近窗口内的错误率 */
  private getRecentErrorRate(tenantId: number, serviceName: string, windowMs: number): number {
    // 从 apm_error_stats_daily 或 Redis 缓存中查询
    // 简化实现：查询最近 5 分钟的 span 错误率
    const query = `
      SELECT
        COUNT(*) FILTER (WHERE status_code = 'error')::float / NULLIF(COUNT(*), 0) as error_rate
      FROM apm_spans
      WHERE tenant_id = $1
        AND service_name = $2
        AND start_time > NOW() - INTERVAL '5 minutes'
    `;
    // ... 执行查询
    return 0; // placeholder
  }
}
```

### 5.3 采样决策在服务端 Ingestion 层的执行

Span 在客户端已做初步采样判断，但服务端 Ingestion 层需要二次确认：

```
客户端采样 (SDK 层)
  → POST /api/v1/apm/ingest/spans
    → ApmIngestionService.receiveSpans()
      → 1. 格式校验
      → 2. 采样策略二次确认（防止 SDK 采样配置过时）
      → 3. 去重（trace_id + span_id 唯一索引冲突处理）
      → 4. 批量写入 apm_spans（事务）
      → 5. 更新 apm_traces 聚合
      → 6. 更新 apm_services 统计
```

---

## 6. 存储设计（大数据量）

### 6.1 按月分区表设计

```sql
-- 创建分区（示例：2026 年）
-- 每月一个子分区，自动路由写入
CREATE TABLE apm_spans_202601 PARTITION OF apm_spans
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE apm_spans_202602 PARTITION OF apm_spans
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE apm_spans_202603 PARTITION OF apm_spans
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
-- ... 可通过定时任务自动创建未来 3 个月的分区

CREATE TABLE apm_traces_202601 PARTITION OF apm_traces
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
-- ... 同 apm_spans
```

### 6.2 自动分区管理

```typescript
// orion-platform-service/src/services/apm/PartitionManager.ts

export class PartitionManager {
  /** 每月 1 号自动创建未来 3 个月的分区 */
  async ensureFuturePartitions(monthsAhead = 3): Promise<void> {
    const now = new Date();
    for (let i = 1; i <= monthsAhead; i++) {
      const target = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const partitionName = `apm_spans_${target.getFullYear()}${String(target.getMonth() + 1).padStart(2, '0')}`;
      const from = target.toISOString().slice(0, 10);
      const to = new Date(target.getFullYear(), target.getMonth() + 1, 1).toISOString().slice(0, 10);

      const exists = await this.checkPartitionExists(partitionName);
      if (!exists) {
        await this.db.query(`
          CREATE TABLE ${partitionName} PARTITION OF apm_spans
          FOR VALUES FROM ('${from}') TO ('${to}')
        `);
        // 同时创建 traces 分区
        const tracesPartitionName = partitionName.replace('spans', 'traces');
        await this.db.query(`
          CREATE TABLE IF NOT EXISTS ${tracesPartitionName} PARTITION OF apm_traces
          FOR VALUES FROM ('${from}') TO ('${to}')
        `);
      }
    }
  }

  /** 定期清理过期分区（默认保留 3 个月热数据） */
  async pruneOldPartitions(retentionMonths = 3): Promise<void> {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - retentionMonths);
    const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}`;

    // 查询所有分区，删除过期的
    const partitions = await this.listPartitions();
    for (const name of partitions) {
      const monthPart = name.replace('apm_spans_', '').replace('apm_traces_', '');
      if (monthPart < cutoffStr) {
        // 归档到 S3/OSS 后删除（可选）
        await this.archivePartition(name);
        await this.db.query(`DROP TABLE IF EXISTS ${name}`);
      }
    }
  }
}
```

### 6.3 冷热数据分层

| 层级 | 存储介质 | 保留周期 | 查询性能 | 访问频率 |
|------|---------|---------|---------|---------|
| 热数据 (Hot) | PostgreSQL（当前月 + 前 2 月分区） | 3 个月 | < 2s | 高 |
| 温数据 (Warm) | PostgreSQL（3-6 月分区） | 3 个月 | < 5s | 中 |
| 冷数据 (Cold) | 归档到对象存储 (S3/OSS) + 元数据索引 | 12 个月 | < 30s | 低 |
| 过期数据 | 永久删除 | - | - | - |

### 6.4 索引策略

```sql
-- apm_spans 索引
CREATE INDEX idx_apm_spans_trace ON apm_spans (trace_id, partition_date);
CREATE INDEX idx_apm_spans_service_time ON apm_spans (service_name, start_time DESC, partition_date);
CREATE INDEX idx_apm_spans_operation_time ON apm_spans (operation_name, start_time DESC, partition_date);
CREATE INDEX idx_apm_spans_status ON apm_spans (status_code, start_time DESC, partition_date);
CREATE INDEX idx_apm_spans_duration ON apm_spans (duration_ms DESC, partition_date) WHERE duration_ms > 1000;
CREATE INDEX idx_apm_spans_tenant ON apm_spans (tenant_id, partition_date);

-- apm_traces 索引
CREATE INDEX idx_apm_traces_tenant_time ON apm_traces (tenant_id, start_time DESC, partition_date);
CREATE INDEX idx_apm_traces_status ON apm_traces (status, start_time DESC, partition_date);
CREATE INDEX idx_apm_traces_root_service ON apm_traces (root_service, start_time DESC, partition_date);
CREATE INDEX idx_apm_traces_external ON apm_traces (external_trace_id) WHERE external_trace_id IS NOT NULL;

-- GIN 索引用于 tags 和 logs 的 JSONB 查询
CREATE INDEX idx_apm_spans_tags ON apm_spans USING GIN (tags);
CREATE INDEX idx_apm_traces_tags ON apm_traces USING GIN (tags);

-- 复合索引：慢查询专用
CREATE INDEX idx_apm_spans_slow ON apm_spans (service_name, duration_ms DESC, start_time DESC, partition_date)
    WHERE status_code = 'ok' AND duration_ms > 1000;
```

### 6.5 数据保留周期配置

```sql
-- 租户级数据保留配置
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS apm_retention_months INTEGER DEFAULT 3;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS apm_archive_enabled BOOLEAN DEFAULT TRUE;

-- 默认保留策略
-- Hot: 3 months (PostgreSQL partitions)
-- Warm: 3 months (PostgreSQL partitions, marked for archival)
-- Cold: 12 months (Object storage, queryable via metadata index)
-- After 15 months: permanently deleted
```

---

## 7. 查询分析能力

### 7.1 Trace 详情查询

```typescript
// ApmTraceRepository.ts

export class ApmTraceRepository {
  /** 通过 trace_id 还原完整调用链 */
  async findByTraceId(traceId: string): Promise<TraceWithSpans | null> {
    const trace = await this.db.query(`
      SELECT * FROM apm_traces WHERE trace_id = $1 LIMIT 1
    `, [traceId]);

    if (trace.rows.length === 0) return null;

    // 获取该 trace 下所有 spans，按 depth + start_time 排序
    const spans = await this.db.query(`
      SELECT * FROM apm_spans
      WHERE trace_id = $1
      ORDER BY depth ASC, start_time ASC
    `, [traceId]);

    return {
      trace: trace.rows[0],
      spans: spans.rows,
      spanCount: spans.rows.length,
    };
  }

  /** 搜索 traces（多条件过滤） */
  async searchTraces(query: TraceSearchQuery): Promise<{ traces: ApmTrace[]; total: number }> {
    const conditions: string[] = ['tenant_id = $1'];
    const params: any[] = [query.tenantId];
    let paramIdx = 2;

    if (query.serviceName) {
      conditions.push(`root_service = $${paramIdx++}`);
      params.push(query.serviceName);
    }
    if (query.status) {
      conditions.push(`status = $${paramIdx++}`);
      params.push(query.status);
    }
    if (query.startTime) {
      conditions.push(`start_time >= $${paramIdx++}`);
      params.push(query.startTime);
    }
    if (query.endTime) {
      conditions.push(`start_time <= $${paramIdx++}`);
      params.push(query.endTime);
    }
    if (query.minDurationMs) {
      conditions.push(`duration_ms >= $${paramIdx++}`);
      params.push(query.minDurationMs);
    }
    if (query.maxDurationMs) {
      conditions.push(`duration_ms <= $${paramIdx++}`);
      params.push(query.maxDurationMs);
    }
    if (query.traceId) {
      conditions.push(`trace_id = $${paramIdx++}`);
      params.push(query.traceId);
    }

    const where = conditions.join(' AND ');
    const totalResult = await this.db.query(
      `SELECT COUNT(*) FROM apm_traces WHERE ${where}`, params
    );
    const total = parseInt(totalResult.rows[0].count);

    const traces = await this.db.query(
      `SELECT * FROM apm_traces WHERE ${where}
       ORDER BY start_time DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, query.limit ?? 50, query.offset ?? 0]
    );

    return { traces: traces.rows, total };
  }
}
```

### 7.2 服务拓扑图生成

```typescript
// ApmTopologyService.ts

export interface TopologyEdge {
  sourceService: string;
  targetService: string;
  callCount: number;
  avgDurationMs: number;
  errorRate: number;
  p95DurationMs: number;
}

export interface TopologyNode {
  serviceName: string;
  callCount: number;
  avgDurationMs: number;
  errorRate: number;
  isCritical: boolean;
}

export class ApmTopologyService {
  /** 通过 span 的 parent-child 关系 + peer.service 标签推导服务依赖 */
  async generateTopology(tenantId: number, timeWindowMs = 3600000): Promise<{
    nodes: TopologyNode[];
    edges: TopologyEdge[];
  }> {
    const startTime = new Date(Date.now() - timeWindowMs);

    // 查询所有 client/server 类型的 span，提取 peer.service
    const spans = await this.db.query(`
      SELECT
        service_name,
        span_kind,
        tags->>'peer.service' AS target_service,
        duration_ms,
        status_code
      FROM apm_spans
      WHERE tenant_id = $1
        AND start_time >= $2
        AND span_kind IN ('client', 'server')
        AND tags->>'peer.service' IS NOT NULL
      ORDER BY start_time DESC
      LIMIT 10000
    `, [tenantId, startTime]);

    // 聚合边
    const edgeMap = new Map<string, TopologyEdge>();
    const nodeMap = new Map<string, TopologyNode>();

    for (const span of spans.rows) {
      const source = span.service_name;
      const target = span.target_service;
      if (!target) continue;

      // 节点
      for (const svc of [source, target]) {
        if (!nodeMap.has(svc)) {
          nodeMap.set(svc, {
            serviceName: svc,
            callCount: 0,
            avgDurationMs: 0,
            errorRate: 0,
            isCritical: false,
          });
        }
        const node = nodeMap.get(svc)!;
        node.callCount++;
        node.avgDurationMs = (node.avgDurationMs * (node.callCount - 1) + span.duration_ms) / node.callCount;
        if (span.status_code === 'error') node.errorRate += 1;
      }

      // 边
      const edgeKey = `${source}→${target}`;
      if (!edgeMap.has(edgeKey)) {
        edgeMap.set(edgeKey, {
          sourceService: source,
          targetService: target,
          callCount: 0,
          avgDurationMs: 0,
          errorRate: 0,
          p95DurationMs: 0,
        });
      }
      const edge = edgeMap.get(edgeKey)!;
      edge.callCount++;
      const durations = [edge.avgDurationMs * (edge.callCount - 1), span.duration_ms];
      edge.avgDurationMs = durations.reduce((a, b) => a + b, 0) / 2;
      if (span.status_code === 'error') edge.errorRate++;
    }

    // 计算错误率和 P95
    for (const node of nodeMap.values()) {
      node.errorRate = node.callCount > 0 ? node.errorRate / node.callCount : 0;
    }
    for (const edge of edgeMap.values()) {
      edge.errorRate = edge.callCount > 0 ? edge.errorRate / edge.callCount : 0;
    }

    return {
      nodes: Array.from(nodeMap.values()),
      edges: Array.from(edgeMap.values()),
    };
  }
}
```

### 7.3 慢调用分析

```typescript
// ApmAnalyticsService.ts

export class ApmAnalyticsService {
  /** 慢调用排行（按 P50/P95/P99） */
  async getSlowCalls(tenantId: number, options: {
    timeWindowMs?: number;
    limit?: number;
    sortBy?: 'p95' | 'p99' | 'avg';
  } = {}): Promise<Array<{
    service_name: string;
    operation_name: string;
    p50_ms: number;
    p95_ms: number;
    p99_ms: number;
    avg_ms: number;
    sample_count: number;
    error_count: number;
  }>> {
    const windowMs = options.timeWindowMs ?? 3600000;
    const startTime = new Date(Date.now() - windowMs);
    const limit = options.limit ?? 50;

    // 使用 percentile 聚合函数
    const result = await this.db.query(`
      SELECT
        service_name,
        operation_name,
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY duration_ms) AS p50_ms,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_ms,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) AS p99_ms,
        AVG(duration_ms)::int AS avg_ms,
        COUNT(*) AS sample_count,
        COUNT(*) FILTER (WHERE status_code = 'error') AS error_count
      FROM apm_spans
      WHERE tenant_id = $1
        AND start_time >= $2
      GROUP BY service_name, operation_name
      ORDER BY p95_ms DESC
      LIMIT $3
    `, [tenantId, startTime, limit]);

    return result.rows;
  }

  /** 错误率分析 */
  async getErrorRates(tenantId: number, options: {
    timeWindowMs?: number;
    limit?: number;
    minErrorRate?: number;
  } = {}): Promise<Array<{
    service_name: string;
    operation_name: string;
    total_count: number;
    error_count: number;
    error_rate: number;
    top_errors: Array<{ message: string; count: number; sample_trace_id: string }>;
  }>> {
    const windowMs = options.timeWindowMs ?? 3600000;
    const startTime = new Date(Date.now() - windowMs);
    const limit = options.limit ?? 50;
    const minErrorRate = options.minErrorRate ?? 0;

    const result = await this.db.query(`
      WITH error_agg AS (
        SELECT
          service_name,
          operation_name,
          COUNT(*) AS total_count,
          COUNT(*) FILTER (WHERE status_code = 'error') AS error_count,
          ROUND(
            COUNT(*) FILTER (WHERE status_code = 'error')::numeric / NULLIF(COUNT(*), 0), 4
          ) AS error_rate,
          JSONB_AGG(
            DISTINCT JSONB_BUILD_OBJECT(
              'message', COALESCE(status_message, 'unknown'),
              'trace_id', trace_id
            )
          ) AS raw_errors
        FROM apm_spans
        WHERE tenant_id = $1
          AND start_time >= $2
          AND status_code = 'error'
        GROUP BY service_name, operation_name
      )
      SELECT
        service_name,
        operation_name,
        total_count,
        error_count,
        error_rate,
        (
          SELECT JSONB_AGG(err ORDER BY cnt DESC LIMIT 5)
          FROM (
            SELECT e->>'message' AS message, COUNT(*) AS cnt,
                   (e->>'trace_id') AS sample_trace_id
            FROM JSONB_ARRAY_ELEMENTS(raw_errors) AS e
            GROUP BY e->>'message', e->>'trace_id'
          ) sub
        ) AS top_errors
      FROM error_agg
      WHERE error_rate >= $3
      ORDER BY error_rate DESC
      LIMIT $4
    `, [tenantId, startTime, minErrorRate, limit]);

    return result.rows;
  }
}
```

---

## 8. 外部依赖检查与可复用组件

### 8.1 现有可复用组件

| 组件 | 路径 | 可复用内容 | 复用方式 |
|------|------|-----------|---------|
| `MetricCollector` | `src/services/monitoring/MetricCollector.ts` | P50/P95/P99 百分位计算、聚合逻辑 | **直接引用** `computeAggregation` / `percentile` 方法，用于 APM 离线分析 |
| `AlertRuleEngine` | `src/services/monitoring/AlertRuleEngine.ts` | 阈值告警规则匹配逻辑 | APM 错误率/延迟超阈值时，调用 `AlertRuleEngine.evaluate()` 触发告警 |
| `MonitoringController` | `src/api/controllers/monitoring/MonitoringController.ts` | 告警 CRUD、通知通道 | APM 告警复用同一套告警基础设施 |
| `LLMTraceRepository` | `src/repositories/LLMTraceRepository.ts` | Repository 模式、分页查询 | 参照其 Repository 实现模式 |
| `requirePermission` | `src/api/middleware/requirePermission.ts` | 权限中间件 | APM 路由统一使用 |

### 8.2 不可复用/需新建的组件

| 组件 | 原因 | 新建文件 |
|------|------|---------|
| Span Ingestion 服务 | 当前 `MetricCollector` 使用内存 Map 存储，不满足高吞吐需求 | `src/services/apm/ApmIngestionService.ts` |
| 分区表管理 | 现有迁移无分区管理逻辑 | `src/services/apm/PartitionManager.ts` |
| 拓扑分析服务 | 现有代码无服务依赖推导 | `src/services/apm/ApmTopologyService.ts` |
| Trace 组装查询 | llm_traces 无 span 层级概念 | `src/repositories/ApmTraceRepository.ts` |

---

## 9. 权限模型

### 9.1 资源与操作

| 资源 | 操作 | 角色要求 | 说明 |
|------|------|---------|------|
| `apm_trace` | read | `viewer`+ | 查看 Trace 详情 |
| `apm_trace` | search | `viewer`+ | 搜索 Trace 列表 |
| `apm_service` | read | `viewer`+ | 查看服务列表与拓扑 |
| `apm_sampling_config` | read | `admin` | 查看采样配置 |
| `apm_sampling_config` | update | `admin` | 修改采样率/策略 |
| `apm_ingest` | write | `service_account` | Span 数据上报（仅 SDK 服务账号） |
| `apm_data` | delete | `super_admin` | 手动清理过期数据 |

### 9.2 租户隔离

- 所有查询自动附加 `tenant_id` 过滤（通过 `req.user.tenantId` 注入）
- SDK 上报通过 `service_account` 的 `tenant_id` 绑定
- 跨租户查询仅 `super_admin` 可用

### 9.3 路由权限示例

```typescript
// 搜索 traces（需要 viewer 权限）
app.get('/traces', {
  onRequest: [authenticateUser, requirePermission({ resource: 'apm_trace', action: 'search' })],
}, handler);

// Span 上报（需要 service_account 权限）
app.post('/ingest/spans', {
  onRequest: [authenticateServiceAccount, requirePermission({ resource: 'apm_ingest', action: 'write' })],
}, handler);

// 采样配置修改（需要 admin 权限）
app.put('/sampling-configs/:id', {
  onRequest: [authenticateUser, requirePermission({ resource: 'apm_sampling_config', action: 'update' })],
}, handler);
```

---

## 10. API 设计

### 10.1 路由总览

```
POST   /api/v1/apm/ingest/spans              — Span 批量上报（SDK 调用）
GET    /api/v1/apm/traces                     — 搜索 Trace 列表
GET    /api/v1/apm/traces/:traceId            — Trace 详情（含完整调用链 Gantt 数据）
GET    /api/v1/apm/traces/:traceId/related    — 关联查询（LLM traces、部署信息等）

GET    /api/v1/apm/services                   — 服务列表
GET    /api/v1/apm/services/topology           — 服务拓扑图数据
GET    /api/v1/apm/services/:name             — 服务详情与性能指标
GET    /api/v1/apm/services/:name/dependencies — 服务依赖详情

GET    /api/v1/apm/analytics/slow-calls       — 慢调用排行
GET    /api/v1/apm/analytics/error-rates      — 错误率分析
GET    /api/v1/apm/analytics/latency-trend    — 延迟趋势（P50/P95/P99）

GET    /api/v1/apm/sampling-configs           — 采样配置列表
PUT    /api/v1/apm/sampling-configs/:id       — 更新采样配置

POST   /api/v1/apm/partitions/ensure          — 手动触发分区创建（admin）
POST   /api/v1/apm/partitions/prune           — 手动触发过期分区清理（super_admin）
```

### 10.2 API Routes 文件

```typescript
// orion-platform-service/src/api/apm-routes.ts

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser, authenticateServiceAccount } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { ApmTraceService } from '../services/apm/ApmTraceService';
import { ApmIngestionService } from '../services/apm/ApmIngestionService';
import { ApmTopologyService } from '../services/apm/ApmTopologyService';
import { ApmAnalyticsService } from '../services/apm/ApmAnalyticsService';
import { ApmSamplingService } from '../services/apm/ApmSamplingService';
import { PartitionManager } from '../services/apm/PartitionManager';

let traceService: ApmTraceService;
let ingestionService: ApmIngestionService;
let topologyService: ApmTopologyService;
let analyticsService: ApmAnalyticsService;
let samplingService: ApmSamplingService;
let partitionManager: PartitionManager;

export function initApm(database: any): void {
  traceService = new ApmTraceService(database);
  ingestionService = new ApmIngestionService(database);
  topologyService = new ApmTopologyService(database);
  analyticsService = new ApmAnalyticsService(database);
  samplingService = new ApmSamplingService(database);
  partitionManager = new PartitionManager(database);
}

interface TraceIdParams { traceId: string }
interface ServiceNameParams { name: string }
interface TraceSearchQuery {
  serviceName?: string;
  status?: string;
  startTime?: string;
  endTime?: string;
  minDurationMs?: number;
  maxDurationMs?: number;
  traceId?: string;
  limit?: number;
  offset?: number;
}

export async function apmRoutes(app: FastifyInstance): Promise<void> {
  // ==================== Ingestion ====================

  app.post('/ingest/spans', {
    onRequest: [authenticateServiceAccount, requirePermission({ resource: 'apm_ingest', action: 'write' })],
  }, async (request: FastifyRequest<{ Body: { spans: any[] } }>, reply: FastifyReply) => {
    const { spans } = request.body;
    const result = await ingestionService.receiveSpans(spans);
    return reply.code(202).send({ accepted: result.accepted, rejected: result.rejected });
  });

  // ==================== Trace ====================

  app.get('/traces', {
    onRequest: [authenticateUser, requirePermission({ resource: 'apm_trace', action: 'search' })],
  }, async (request: FastifyRequest<{ Querystring: TraceSearchQuery }>, reply: FastifyReply) => {
    const tenantId = (request.user as any).tenantId;
    const query = { ...request.query, tenantId };
    const result = await traceService.searchTraces(query);
    return reply.send(result);
  });

  app.get('/traces/:traceId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'apm_trace', action: 'read' })],
  }, async (request: FastifyRequest<{ Params: TraceIdParams }>, reply: FastifyReply) => {
    const result = await traceService.getTraceDetail(request.params.traceId);
    if (!result) return reply.code(404).send({ error: 'Trace not found' });
    return reply.send(result);
  });

  app.get('/traces/:traceId/related', {
    onRequest: [authenticateUser, requirePermission({ resource: 'apm_trace', action: 'read' })],
  }, async (request: FastifyRequest<{ Params: TraceIdParams }>, reply: FastifyReply) => {
    const related = await traceService.getRelatedInfo(request.params.traceId);
    return reply.send(related);
  });

  // ==================== Services ====================

  app.get('/services', {
    onRequest: [authenticateUser, requirePermission({ resource: 'apm_service', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (request.user as any).tenantId;
    const services = await traceService.listServices(tenantId);
    return reply.send({ data: services, total: services.length });
  });

  app.get('/services/topology', {
    onRequest: [authenticateUser, requirePermission({ resource: 'apm_service', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (request.user as any).tenantId;
    const topology = await topologyService.generateTopology(tenantId);
    return reply.send(topology);
  });

  app.get('/services/:name', {
    onRequest: [authenticateUser, requirePermission({ resource: 'apm_service', action: 'read' })],
  }, async (request: FastifyRequest<{ Params: ServiceNameParams }>, reply: FastifyReply) => {
    const tenantId = (request.user as any).tenantId;
    const service = await traceService.getServiceDetail(tenantId, request.params.name);
    if (!service) return reply.code(404).send({ error: 'Service not found' });
    return reply.send(service);
  });

  app.get('/services/:name/dependencies', {
    onRequest: [authenticateUser, requirePermission({ resource: 'apm_service', action: 'read' })],
  }, async (request: FastifyRequest<{ Params: ServiceNameParams }>, reply: FastifyReply) => {
    const tenantId = (request.user as any).tenantId;
    const deps = await topologyService.getServiceDependencies(tenantId, request.params.name);
    return reply.send(deps);
  });

  // ==================== Analytics ====================

  app.get('/analytics/slow-calls', {
    onRequest: [authenticateUser, requirePermission({ resource: 'apm_trace', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (request.user as any).tenantId;
    const result = await analyticsService.getSlowCalls(tenantId, request.query as any);
    return reply.send({ data: result });
  });

  app.get('/analytics/error-rates', {
    onRequest: [authenticateUser, requirePermission({ resource: 'apm_trace', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (request.user as any).tenantId;
    const result = await analyticsService.getErrorRates(tenantId, request.query as any);
    return reply.send({ data: result });
  });

  app.get('/analytics/latency-trend', {
    onRequest: [authenticateUser, requirePermission({ resource: 'apm_trace', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (request.user as any).tenantId;
    const result = await analyticsService.getLatencyTrend(tenantId, request.query as any);
    return reply.send({ data: result });
  });

  // ==================== Sampling Configs ====================

  app.get('/sampling-configs', {
    onRequest: [authenticateUser, requirePermission({ resource: 'apm_sampling_config', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (request.user as any).tenantId;
    const configs = await samplingService.listConfigs(tenantId);
    return reply.send({ data: configs });
  });

  app.put('/sampling-configs/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'apm_sampling_config', action: 'update' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const config = await samplingService.updateConfig(request.params as any, request.body as any);
    return reply.send({ data: config });
  });

  // ==================== Partition Management ====================

  app.post('/partitions/ensure', {
    onRequest: [authenticateUser, requirePermission({ resource: 'apm_data', action: 'delete' })],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    await partitionManager.ensureFuturePartitions();
    return reply.send({ success: true });
  });

  app.post('/partitions/prune', {
    onRequest: [authenticateUser, requirePermission({ resource: 'apm_data', action: 'delete' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const retentionMonths = (request.body as any)?.retentionMonths ?? 3;
    await partitionManager.pruneOldPartitions(retentionMonths);
    return reply.send({ success: true });
  });
}

export default apmRoutes;
```

### 10.3 前端 API 客户端

```typescript
// orion-frontend/src/api/apm.ts

import { apiClient } from './client';

export interface TraceSearchParams {
  serviceName?: string;
  status?: string;
  startTime?: string;
  endTime?: string;
  minDurationMs?: number;
  maxDurationMs?: number;
  traceId?: string;
  limit?: number;
  offset?: number;
}

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  serviceName: string;
  operationName: string;
  spanKind: string;
  startTime: string;
  endTime: string;
  durationMs: number;
  statusCode: string;
  statusMessage: string | null;
  tags: Record<string, string>;
  depth: number;
}

export interface TraceWithSpans {
  trace: {
    traceId: string;
    rootService: string;
    rootOperation: string;
    totalSpans: number;
    startTime: string;
    endTime: string;
    durationMs: number;
    status: string;
    errorMessage: string | null;
    tags: Record<string, string>;
  };
  spans: Span[];
  spanCount: number;
}

export interface TopologyNode {
  serviceName: string;
  callCount: number;
  avgDurationMs: number;
  errorRate: number;
  isCritical: boolean;
}

export interface TopologyEdge {
  sourceService: string;
  targetService: string;
  callCount: number;
  avgDurationMs: number;
  errorRate: number;
  p95DurationMs: number;
}

export interface SlowCall {
  serviceName: string;
  operationName: string;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  avg_ms: number;
  sample_count: number;
  error_count: number;
}

export interface ErrorRate {
  serviceName: string;
  operationName: string;
  total_count: number;
  error_count: number;
  error_rate: number;
  top_errors: Array<{ message: string; count: number; sample_trace_id: string }>;
}

// ==================== Trace ====================

export const searchTraces = (params: TraceSearchParams) =>
  apiClient.get('/api/v1/apm/traces', { params });

export const getTraceDetail = (traceId: string) =>
  apiClient.get<TraceWithSpans>(`/api/v1/apm/traces/${traceId}`);

export const getTraceRelated = (traceId: string) =>
  apiClient.get(`/api/v1/apm/traces/${traceId}/related`);

// ==================== Services ====================

export const listServices = () =>
  apiClient.get('/api/v1/apm/services');

export const getServiceTopology = () =>
  apiClient.get<{ nodes: TopologyNode[]; edges: TopologyEdge[] }>('/api/v1/apm/services/topology');

export const getServiceDetail = (name: string) =>
  apiClient.get(`/api/v1/apm/services/${name}`);

export const getServiceDependencies = (name: string) =>
  apiClient.get(`/api/v1/apm/services/${name}/dependencies`);

// ==================== Analytics ====================

export const getSlowCalls = (params?: { timeWindowMs?: number; limit?: number }) =>
  apiClient.get<{ data: SlowCall[] }>('/api/v1/apm/analytics/slow-calls', { params });

export const getErrorRates = (params?: { timeWindowMs?: number; limit?: number; minErrorRate?: number }) =>
  apiClient.get<{ data: ErrorRate[] }>('/api/v1/apm/analytics/error-rates', { params });

export const getLatencyTrend = (params?: { timeWindowMs?: number }) =>
  apiClient.get('/api/v1/apm/analytics/latency-trend', { params });

// ==================== Sampling ====================

export const listSamplingConfigs = () =>
  apiClient.get('/api/v1/apm/sampling-configs');

export const updateSamplingConfig = (id: string, data: any) =>
  apiClient.put(`/api/v1/apm/sampling-configs/${id}`, data);
```

---

## 11. 前端页面交互设计

### 11.1 页面清单与路由

| 页面 | 路由 | 文件名 | 优先级 |
|------|------|--------|--------|
| 链路追踪搜索 | `/apm/traces` | `pages/apm/TraceSearch/index.tsx` | P0 |
| Trace 详情 | `/apm/traces/:traceId` | `pages/apm/TraceDetail/index.tsx` | P0 |
| 服务列表 | `/apm/services` | `pages/apm/ServiceList/index.tsx` | P0 |
| 服务拓扑图 | `/apm/services/topology` | `pages/apm/ServiceTopology/index.tsx` | P1 |
| 慢调用分析 | `/apm/slow-calls` | `pages/apm/SlowCalls/index.tsx` | P1 |
| 错误分析 | `/apm/errors` | `pages/apm/ErrorAnalysis/index.tsx` | P1 |

### 11.2 链路追踪搜索页 (`/apm/traces`)

```tsx
/**
 * Trace Search Page — /apm/traces
 *
 * 交互链：
 * 1. 用户打开页面 → 自动加载最近 1 小时的 traces
 * 2. 输入搜索条件 → 点击搜索 / Enter → 更新列表
 * 3. 点击 Trace ID → 跳转到 /apm/traces/:traceId 详情页
 * 4. 列表为空 → 显示 Empty + 引导按钮 "查看服务拓扑"
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Typography, Card, Space, Button, Input, Select, DatePicker, Tag, message, Table } from 'antd';
import { SearchOutlined, RadarChartOutlined, ReloadOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import DashboardLayout from '@/components/DashboardLayout';
import { searchTraces } from '@/api/apm';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const STATUS_OPTIONS = [
  { label: '全部', value: '' },
  { label: '成功', value: 'ok' },
  { label: '错误', value: 'error' },
  { label: '超时', value: 'timeout' },
];

const SERVICE_OPTIONS = [
  { label: '全部服务', value: '' },
  // 动态从 /api/v1/apm/services 加载
];

interface TraceRow {
  key: string;
  traceId: string;
  rootService: string;
  rootOperation: string;
  totalSpans: number;
  durationMs: number;
  status: string;
  startTime: string;
  errorMessage: string | null;
}

const TraceSearchPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [traces, setTraces] = useState<TraceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [traceId, setTraceId] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [status, setStatus] = useState('');
  const [timeRange, setTimeRange] = useState<[any, any] | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { limit: 50, offset: (page - 1) * 50 };
      if (traceId) params.traceId = traceId;
      if (serviceName) params.serviceName = serviceName;
      if (status) params.status = status;
      if (timeRange) {
        params.startTime = timeRange[0]?.toISOString();
        params.endTime = timeRange[1]?.toISOString();
      }
      const res = await searchTraces(params);
      const items = res.data?.data?.traces || [];
      setTraces(items.map((t: any) => ({
        key: t.trace_id,
        traceId: t.trace_id,
        rootService: t.root_service,
        rootOperation: t.root_operation,
        totalSpans: t.total_spans,
        durationMs: t.duration_ms,
        status: t.status,
        startTime: t.start_time,
        errorMessage: t.error_message,
      })));
      setTotal(res.data?.data?.total || 0);
    } catch (error: unknown) {
      message.error(`加载链路数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [traceId, serviceName, status, timeRange, page]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSearch = () => { setPage(1); loadData(); };

  const columns: ColumnsType<TraceRow> = [
    {
      title: 'Trace ID',
      dataIndex: 'traceId',
      key: 'traceId',
      width: 200,
      render: (v: string) => (
        <a
          href={`/apm/traces/${v}`}
          style={{ color: colors.primary[500], fontFamily: 'monospace', fontSize: 12 }}
        >
          {v.slice(0, 8)}...{v.slice(-8)}
        </a>
      ),
    },
    {
      title: '根服务',
      dataIndex: 'rootService',
      key: 'rootService',
      width: 160,
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: '根操作',
      dataIndex: 'rootOperation',
      key: 'rootOperation',
      width: 200,
    },
    {
      title: 'Span 数',
      dataIndex: 'totalSpans',
      key: 'totalSpans',
      width: 80,
      align: 'center',
    },
    {
      title: '耗时',
      dataIndex: 'durationMs',
      key: 'durationMs',
      width: 100,
      sorter: true,
      render: (ms: number) => (
        <Text style={{
          color: ms > 2000 ? colors.error[500] : ms > 500 ? colors.warning[500] : colors.success[500],
          fontWeight: 600,
        }}>
          {ms}ms
        </Text>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (v: string) => {
        const colorMap: Record<string, string> = {
          ok: colors.success[500],
          error: colors.error[500],
          timeout: colors.warning[500],
        };
        return <Tag color={colorMap[v]}>{v}</Tag>;
      },
    },
    {
      title: '时间',
      dataIndex: 'startTime',
      key: 'startTime',
      width: 180,
      render: (v: string) => <Text type="secondary">{new Date(v).toLocaleString()}</Text>,
    },
  ];

  return (
    <div>
      {/* 页面标题 */}
      <Title level={2} style={{ marginBottom: 8 }}>
        <RadarChartOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        链路追踪
      </Title>
      <Text type="secondary" style={{ marginBottom: spacing[6], display: 'block' }}>
        搜索和查看分布式调用链路，定位性能瓶颈与错误根因
      </Text>

      {/* 搜索栏 */}
      <Card size="small" style={{ marginBottom: spacing[4] }}>
        <Space wrap>
          <Input
            placeholder="Trace ID"
            value={traceId}
            onChange={(e) => setTraceId(e.target.value)}
            style={{ width: 260 }}
            allowClear
            onPressEnter={handleSearch}
          />
          <Select
            value={serviceName}
            onChange={setServiceName}
            placeholder="服务"
            style={{ width: 160 }}
            options={SERVICE_OPTIONS}
            allowClear
          />
          <Select
            value={status}
            onChange={setStatus}
            placeholder="状态"
            style={{ width: 120 }}
            options={STATUS_OPTIONS}
          />
          <RangePicker
            showTime
            onChange={(dates) => setTimeRange(dates as any)}
            style={{ width: 320 }}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} loading={loading}>
            搜索
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
        </Space>
      </Card>

      {/* Trace 列表 */}
      <Card size="small">
        <Table<TraceRow>
          columns={columns}
          dataSource={traces}
          loading={loading}
          rowKey="key"
          pagination={{
            current: page,
            pageSize: 50,
            total,
            onChange: (p) => setPage(p),
            showTotal: (t) => `共 ${t} 条链路`,
          }}
          locale={{
            emptyText: (
              <div style={{ padding: spacing[10] }}>
                <Text type="secondary">暂无链路数据</Text>
                <br />
                <Button type="link" href="/apm/services/topology">
                  查看服务拓扑图
                </Button>
              </div>
            ),
          }}
        />
      </Card>
    </div>
  );
};

export default TraceSearchPage;
```

### 11.3 Trace 详情页 (`/apm/traces/:traceId`)

```tsx
/**
 * Trace Detail Page — /apm/traces/:traceId
 *
 * 交互链：
 * 1. 用户从搜索页点击 Trace ID → 加载完整调用链
 * 2. Gantt 图展示所有 Span，按 depth 层级展开
 * 3. 点击 Span 行 → 展开详情面板（tags、logs、error stack）
 * 4. 耗时颜色编码：>2s 红色、>500ms 橙色、<500ms 绿色
 * 5. 点击关联按钮 → 查看关联的 LLM traces、部署信息
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography, Card, Tag, Button, Descriptions, Collapse, Space, Spin, message, Empty,
} from 'antd';
import { ArrowLeftOutlined, LinkOutlined, WarningOutlined } from '@ant-design/icons';
import { colors, spacing, componentRadius, shadows } from '@/tokens';
import { getTraceDetail } from '@/api/apm';
import type { TraceWithSpans, Span } from '@/api/apm';

const { Title, Text } = Typography;
const { Panel } = Collapse;

/** 根据耗时返回颜色 */
function getDurationColor(ms: number): string {
  if (ms > 2000) return colors.error[500];
  if (ms > 500) return colors.warning[500];
  return colors.success[500];
}

/** 根据耗时返回宽度百分比（用于 Gantt 条） */
function getBarWidthPercent(ms: number, maxMs: number): number {
  if (maxMs === 0) return 0;
  return Math.max(2, (ms / maxMs) * 100);
}

const TraceDetailPage: React.FC = () => {
  const { traceId } = useParams<{ traceId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<TraceWithSpans | null>(null);
  const [expandedSpan, setExpandedSpan] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!traceId) return;
    setLoading(true);
    try {
      const res = await getTraceDetail(traceId);
      setDetail(res.data);
    } catch (error: unknown) {
      message.error(`加载 Trace 详情失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [traceId]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: spacing[12] }}>
        <Spin size="large" tip="加载调用链详情..." />
      </div>
    );
  }

  if (!detail) {
    return (
      <Empty description="未找到该 Trace" style={{ marginTop: spacing[12] }}>
        <Button type="primary" onClick={() => navigate('/apm/traces')}>
          返回链路搜索
        </Button>
      </Empty>
    );
  }

  const { trace, spans, spanCount } = detail;
  const maxDuration = Math.max(...spans.map((s) => s.durationMs), 1);
  const traceStartTime = new Date(trace.startTime).getTime();

  return (
    <div>
      {/* 页头 */}
      <Space style={{ marginBottom: spacing[4] }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/apm/traces')}>
          返回
        </Button>
        <Title level={2} style={{ margin: 0 }}>
          Trace 详情
        </Title>
      </Space>

      {/* Trace 概览卡片 */}
      <Card
        size="small"
        style={{ marginBottom: spacing[4], borderLeft: `3px solid ${colors.primary[500]}`, borderRadius: componentRadius.card, boxShadow: shadows.card }}
      >
        <Descriptions column={4} size="small">
          <Descriptions.Item label="Trace ID">
            <Text copyable style={{ fontFamily: 'monospace', fontSize: 12 }}>
              {trace.traceId}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={trace.status === 'ok' ? colors.success[500] : colors.error[500]}>
              {trace.status}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="总耗时">
            <Text strong style={{ color: getDurationColor(trace.durationMs) }}>
              {trace.durationMs}ms
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="Span 数">{spanCount}</Descriptions.Item>
          <Descriptions.Item label="根服务">{trace.rootService}</Descriptions.Item>
          <Descriptions.Item label="根操作">{trace.rootOperation}</Descriptions.Item>
          <Descriptions.Item label="开始时间">
            {new Date(trace.startTime).toLocaleString()}
          </Descriptions.Item>
          <Descriptions.Item label="结束时间">
            {trace.endTime ? new Date(trace.endTime).toLocaleString() : '-'}
          </Descriptions.Item>
        </Descriptions>

        {trace.errorMessage && (
          <div style={{ marginTop: spacing[3], padding: spacing[3], background: colors.error[50], borderRadius: componentRadius.xs }}>
            <WarningOutlined style={{ color: colors.error[500], marginRight: 8 }} />
            <Text style={{ color: colors.error[500] }}>{trace.errorMessage}</Text>
          </div>
        )}
      </Card>

      {/* 关联信息 */}
      <Space style={{ marginBottom: spacing[4] }}>
        <Button size="small" icon={<LinkOutlined />} onClick={() => message.info('关联查询功能开发中')}>
          查看关联 LLM Traces
        </Button>
      </Space>

      {/* Gantt 图：Span 层级展示 */}
      <Card
        title={`调用链 Gantt (${spanCount} spans)`}
        size="small"
        style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}
      >
        {spans.map((span, idx) => {
          const startOffset = new Date(span.startTime).getTime() - traceStartTime;
          const leftPercent = (startOffset / trace.durationMs) * 100;
          const widthPercent = getBarWidthPercent(span.durationMs, maxDuration);
          const barColor = getDurationColor(span.durationMs);
          const isExpanded = expandedSpan === span.spanId;

          return (
            <div key={span.spanId}>
              {/* Span 行 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: `${spacing[2]}px ${spacing[2]}px`,
                  borderBottom: `1px solid ${colors.light.border.light}`,
                  cursor: 'pointer',
                  background: isExpanded ? colors.primary[50] : 'transparent',
                }}
                onClick={() => setExpandedSpan(isExpanded ? null : span.spanId)}
              >
                {/* 层级缩进 */}
                <div style={{ width: span.depth * 20, flexShrink: 0 }} />

                {/* Span 名称 */}
                <div style={{ width: 300, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <Text strong style={{ fontSize: 12 }}>{span.serviceName}</Text>
                  <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                    {span.operationName}
                  </Text>
                </div>

                {/* Gantt 条 */}
                <div style={{ flex: 1, position: 'relative', height: 20, margin: `0 ${spacing[2]}px` }}>
                  <div
                    style={{
                      position: 'absolute',
                      left: `${leftPercent}%`,
                      width: `${widthPercent}%`,
                      height: 16,
                      borderRadius: 4,
                      background: barColor,
                      opacity: 0.8,
                    }}
                  />
                </div>

                {/* 耗时 */}
                <Text style={{ width: 80, textAlign: 'right', fontSize: 12, color: barColor, fontWeight: 600 }}>
                  {span.durationMs}ms
                </Text>

                {/* 状态 */}
                <Tag
                  color={span.statusCode === 'ok' ? undefined : colors.error[500]}
                  style={{ marginLeft: spacing[2], fontSize: 10, padding: '0 4px' }}
                >
                  {span.statusCode}
                </Tag>
              </div>

              {/* 展开详情 */}
              {isExpanded && (
                <div style={{ padding: `0 ${spacing[3]}px ${spacing[3]}px ${span.depth * 20 + spacing[3]}px` }}>
                  <Descriptions column={2} size="small" bordered>
                    <Descriptions.Item label="Span ID">{span.spanId}</Descriptions.Item>
                    <Descriptions.Item label="Parent Span ID">
                      {span.parentSpanId || '— (root)'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Span Kind">{span.spanKind}</Descriptions.Item>
                    <Descriptions.Item label="Depth">{span.depth}</Descriptions.Item>
                    <Descriptions.Item label="Start">{new Date(span.startTime).toISOString()}</Descriptions.Item>
                    <Descriptions.Item label="End">{span.endTime ? new Date(span.endTime).toISOString() : '-'}</Descriptions.Item>
                  </Descriptions>

                  {/* Tags */}
                  {Object.keys(span.tags).length > 0 && (
                    <div style={{ marginTop: spacing[3] }}>
                      <Text strong>Tags:</Text>
                      <Space wrap style={{ marginTop: spacing[2] }}>
                        {Object.entries(span.tags).map(([k, v]) => (
                          <Tag key={k} style={{ fontSize: 11 }}>
                            {k}: {String(v).slice(0, 50)}
                          </Tag>
                        ))}
                      </Space>
                    </div>
                  )}

                  {/* Logs */}
                  {span.logs && span.logs.length > 0 && (
                    <div style={{ marginTop: spacing[3] }}>
                      <Text strong>Logs:</Text>
                      {span.logs.map((log, i) => (
                        <div key={i} style={{ fontSize: 11, marginTop: spacing[1] }}>
                          <Text type="secondary">[{log.timestamp}]</Text>
                          <Text> {JSON.stringify(log.fields)}</Text>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Error Stack */}
                  {span.statusMessage && span.statusCode === 'error' && (
                    <div style={{ marginTop: spacing[3] }}>
                      <Text strong style={{ color: colors.error[500] }}>Error:</Text>
                      <pre style={{
                        marginTop: spacing[2],
                        padding: spacing[3],
                        background: colors.error[50],
                        borderRadius: componentRadius.xs,
                        fontSize: 11,
                        maxHeight: 200,
                        overflow: 'auto',
                      }}>
                        {span.statusMessage}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
};

export default TraceDetailPage;
```

### 11.4 服务拓扑图页 (`/apm/services/topology`)

```tsx
/**
 * Service Topology Page — /apm/services/topology
 *
 * 交互链：
 * 1. 加载页面 → 渲染服务节点与调用关系边
 * 2. 节点点击 → 显示服务详情侧面板
 * 3. 错误节点（errorRate > 0.05）标红
 * 4. 边的粗细表示 callCount，边的颜色表示 errorRate
 * 5. 时间范围选择器切换 → 重新计算拓扑
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Typography, Card, Tag, Select, Button, Space, Spin, message, Empty,
} from 'antd';
import { RadarChartOutlined, ReloadOutlined } from '@ant-design/icons';
import { colors, spacing, componentRadius, shadows } from '@/tokens';
import { getServiceTopology } from '@/api/apm';
import type { TopologyNode, TopologyEdge } from '@/api/apm';

const { Title, Text } = Typography;

const TIME_RANGES = [
  { label: '最近 5 分钟', value: 300000 },
  { label: '最近 1 小时', value: 3600000 },
  { label: '最近 6 小时', value: 21600000 },
  { label: '最近 24 小时', value: 86400000 },
];

/** 简化的拓扑图渲染（生产环境建议使用 react-force-graph / vis-network） */
const TopologyCanvas: React.FC<{
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  onNodeClick: (name: string) => void;
}> = ({ nodes, edges, onNodeClick }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 简化布局：圆形排列
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) * 0.35;

    ctx.clearRect(0, 0, w, h);

    // 绘制边
    const nodePositions = new Map<string, { x: number; y: number }>();
    nodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      nodePositions.set(node.serviceName, { x, y });
    });

    for (const edge of edges) {
      const from = nodePositions.get(edge.sourceService);
      const to = nodePositions.get(edge.targetService);
      if (!from || !to) continue;

      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.strokeStyle = edge.errorRate > 0.05 ? colors.error[500] : colors.neutral[400];
      ctx.lineWidth = Math.min(6, Math.max(1, Math.log2(edge.callCount + 1)));
      ctx.globalAlpha = 0.6;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // 绘制节点
    for (const node of nodes) {
      const pos = nodePositions.get(node.serviceName);
      if (!pos) continue;

      const isError = node.errorRate > 0.05;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 24, 0, 2 * Math.PI);
      ctx.fillStyle = isError ? colors.error[500] : colors.primary[500];
      ctx.fill();
      ctx.strokeStyle = colors.neutral[0];
      ctx.lineWidth = 2;
      ctx.stroke();

      // 服务名称
      ctx.fillStyle = colors.neutral[900];
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(node.serviceName.slice(0, 12), pos.x, pos.y + 36);

      // 错误率标签
      if (node.errorRate > 0) {
        ctx.fillStyle = isError ? colors.error[500] : colors.warning[500];
        ctx.fillText(`${(node.errorRate * 100).toFixed(1)}%`, pos.x, pos.y - 30);
      }
    }
  }, [nodes, edges]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={500}
      style={{ width: '100%', height: 400, border: `1px solid ${colors.light.border.light}`, borderRadius: componentRadius.card }}
    />
  );
};

const ServiceTopologyPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState<TopologyNode[]>([]);
  const [edges, setEdges] = useState<TopologyEdge[]>([]);
  const [timeWindow, setTimeWindow] = useState(3600000);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getServiceTopology();
      setNodes(res.data?.nodes || []);
      setEdges(res.data?.edges || []);
    } catch (error: unknown) {
      message.error(`加载拓扑数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [timeWindow]);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div>
      <div style={{ marginBottom: spacing[4] }}>
        <Title level={2} style={{ marginBottom: 8 }}>
          <RadarChartOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
          服务拓扑图
        </Title>
        <Text type="secondary">服务间调用关系可视化，错误节点自动标红</Text>
      </div>

      <Card size="small" style={{ marginBottom: spacing[4] }}>
        <Space>
          <Select
            value={timeWindow}
            onChange={(v) => setTimeWindow(v)}
            style={{ width: 160 }}
            options={TIME_RANGES}
          />
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
        </Space>
      </Card>

      <Card
        size="small"
        loading={loading}
        style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}
      >
        {nodes.length === 0 && !loading ? (
          <Empty description="暂无服务拓扑数据">
            <Text type="secondary">请先通过 SDK 上报 Span 数据</Text>
          </Empty>
        ) : (
          <TopologyCanvas nodes={nodes} edges={edges} onNodeClick={() => {}} />
        )}

        {/* 图例 */}
        <Space style={{ marginTop: spacing[3] }}>
          <Tag color={colors.primary[500]}>正常服务</Tag>
          <Tag color={colors.error[500]}>高错误率服务 (>{'>'}5%)</Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>
            边粗细 = 调用次数，边颜色 = 错误率
          </Text>
        </Space>
      </Card>
    </div>
  );
};

export default ServiceTopologyPage;
```

### 11.5 服务列表页 (`/apm/services`)

```tsx
/**
 * Service List Page — /apm/services
 *
 * 交互链：
 * 1. 加载页面 → 显示服务列表表格
 * 2. 点击服务名 → 跳转到 /apm/services/:name 详情页
 * 3. 表格列支持排序（按错误率、P95、总调用数）
 * 4. 空状态 → 引导查看拓扑图
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Typography, Card, Table, Tag, Button, message } from 'antd';
import { ClusterOutlined, AppstoreOutlined, ReloadOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { listServices } from '@/api/apm';

const { Title, Text } = Typography;

interface ServiceRow {
  key: string;
  serviceName: string;
  serviceVersion: string;
  language: string;
  totalTraces: number;
  errorTraces: number;
  errorRate: number;
  avgDurationMs: number;
  p95DurationMs: number;
  p99DurationMs: number;
  lastActiveAt: string;
}

const ServiceListPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<ServiceRow[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listServices();
      const items = (res.data?.data || []).map((s: any) => ({
        key: s.service_name,
        serviceName: s.service_name,
        serviceVersion: s.service_version || '-',
        language: s.language || '-',
        totalTraces: s.total_traces || 0,
        errorTraces: s.error_traces || 0,
        errorRate: s.total_traces > 0 ? (s.error_traces || 0) / s.total_traces : 0,
        avgDurationMs: s.avg_duration_ms || 0,
        p95DurationMs: s.p95_duration_ms || 0,
        p99DurationMs: s.p99_duration_ms || 0,
        lastActiveAt: s.last_active_at ? new Date(s.last_active_at).toLocaleString() : '-',
      }));
      setServices(items);
    } catch (error: unknown) {
      message.error(`加载服务列表失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const columns = [
    {
      title: '服务名称',
      dataIndex: 'serviceName',
      key: 'serviceName',
      render: (v: string) => (
        <a href={`/apm/services/${v}`} style={{ color: colors.primary[500], fontWeight: 600 }}>
          {v}
        </a>
      ),
    },
    { title: '版本', dataIndex: 'serviceVersion', key: 'serviceVersion', width: 100 },
    { title: '语言', dataIndex: 'language', key: 'language', width: 100 },
    {
      title: '错误率',
      dataIndex: 'errorRate',
      key: 'errorRate',
      width: 100,
      sorter: (a: ServiceRow, b: ServiceRow) => a.errorRate - b.errorRate,
      render: (rate: number) => (
        <Tag color={rate > 0.05 ? colors.error[500] : rate > 0.01 ? colors.warning[500] : colors.success[500]}>
          {(rate * 100).toFixed(2)}%
        </Tag>
      ),
    },
    {
      title: 'P95 延迟',
      dataIndex: 'p95DurationMs',
      key: 'p95DurationMs',
      width: 120,
      sorter: (a: ServiceRow, b: ServiceRow) => a.p95DurationMs - b.p95DurationMs,
      render: (ms: number) => <Text style={{ color: ms > 1000 ? colors.error[500] : colors.neutral[700] }}>{ms}ms</Text>,
    },
    { title: 'P99 延迟', dataIndex: 'p99DurationMs', key: 'p99DurationMs', width: 120, sorter: true },
    { title: '总调用数', dataIndex: 'totalTraces', key: 'totalTraces', width: 120, sorter: true },
    { title: '最后活跃', dataIndex: 'lastActiveAt', key: 'lastActiveAt', width: 180 },
  ];

  return (
    <div>
      <div style={{ marginBottom: spacing[4] }}>
        <Title level={2} style={{ marginBottom: 8 }}>
          <ClusterOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
          服务列表
        </Title>
        <Text type="secondary">已注册服务的性能概览与错误率监控</Text>
      </div>

      <Card
        size="small"
        extra={
          <Space>
            <Button icon={<AppstoreOutlined />} href="/apm/services/topology">
              查看拓扑图
            </Button>
            <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
              刷新
            </Button>
          </Space>
        }
        style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}
      >
        <Table<ServiceRow>
          columns={columns}
          dataSource={services}
          loading={loading}
          rowKey="key"
          pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 个服务` }}
          locale={{
            emptyText: (
              <Empty description="暂无服务数据">
                <Button type="link" href="/apm/services/topology">查看服务拓扑</Button>
              </Empty>
            ),
          }}
        />
      </Card>
    </div>
  );
};

export default ServiceListPage;
```

### 11.6 慢调用分析页 (`/apm/slow-calls`)

```tsx
/**
 * Slow Calls Page — /apm/slow-calls
 *
 * 交互链：
 * 1. 加载页面 → 显示慢调用排行（按 P95 降序）
 * 2. 切换时间范围 → 重新加载
 * 3. 点击操作名 → 跳转到 Trace 搜索页（过滤该 service + operation）
 * 4. 列表为空 → 引导查看服务列表
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Typography, Card, Table, Select, Button, Space, message, Tag } from 'antd';
import { ThunderboltOutlined, ReloadOutlined } from '@ant-design/icons';
import { colors, spacing, componentRadius, shadows } from '@/tokens';
import { getSlowCalls } from '@/api/apm';

const { Title, Text } = Typography;

const TIME_RANGES = [
  { label: '最近 15 分钟', value: 900000 },
  { label: '最近 1 小时', value: 3600000 },
  { label: '最近 6 小时', value: 21600000 },
  { label: '最近 24 小时', value: 86400000 },
];

const SlowCallsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [calls, setCalls] = useState<any[]>([]);
  const [timeWindow, setTimeWindow] = useState(3600000);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSlowCalls({ timeWindowMs: timeWindow, limit: 50 });
      setCalls(res.data?.data || []);
    } catch (error: unknown) {
      message.error(`加载慢调用数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [timeWindow]);

  useEffect(() => { loadData(); }, [loadData]);

  const columns = [
    { title: '服务', dataIndex: 'serviceName', key: 'serviceName', width: 180, render: (v: string) => <Text strong>{v}</Text> },
    { title: '操作', dataIndex: 'operationName', key: 'operationName', width: 240 },
    {
      title: 'P50',
      dataIndex: 'p50_ms',
      key: 'p50_ms',
      width: 100,
      render: (v: number) => `${v}ms`,
    },
    {
      title: 'P95',
      dataIndex: 'p95_ms',
      key: 'p95_ms',
      width: 100,
      sorter: (a: any, b: any) => a.p95_ms - b.p95_ms,
      render: (v: number) => <Tag color={v > 2000 ? colors.error[500] : v > 500 ? colors.warning[500] : colors.success[500]}>{v}ms</Tag>,
    },
    {
      title: 'P99',
      dataIndex: 'p99_ms',
      key: 'p99_ms',
      width: 100,
      sorter: true,
      render: (v: number) => <Text style={{ color: v > 5000 ? colors.error[500] : colors.neutral[700] }}>{v}ms</Text>,
    },
    { title: '采样数', dataIndex: 'sample_count', key: 'sample_count', width: 100, align: 'right' as const },
    { title: '错误数', dataIndex: 'error_count', key: 'error_count', width: 100, align: 'right' as const },
  ];

  return (
    <div>
      <div style={{ marginBottom: spacing[4] }}>
        <Title level={2} style={{ marginBottom: 8 }}>
          <ThunderboltOutlined style={{ marginRight: 12, color: colors.warning[500] }} />
          慢调用分析
        </Title>
        <Text type="secondary">按 P50/P95/P99 延迟排行定位慢调用服务与操作</Text>
      </div>

      <Card size="small" style={{ marginBottom: spacing[4] }}>
        <Space>
          <Select
            value={timeWindow}
            onChange={setTimeWindow}
            style={{ width: 160 }}
            options={TIME_RANGES}
          />
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
        </Space>
      </Card>

      <Card size="small" loading={loading} style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}>
        <Table
          columns={columns}
          dataSource={calls}
          loading={loading}
          rowKey={(r: any) => `${r.serviceName}:${r.operationName}`}
          pagination={{ pageSize: 20 }}
        />
      </Card>
    </div>
  );
};

export default SlowCallsPage;
```

### 11.7 错误分析页 (`/apm/errors`)

```tsx
/**
 * Error Analysis Page — /apm/errors
 *
 * 交互链：
 * 1. 加载页面 → 显示错误率排行
 * 2. 点击 Top Error 中的 trace_id → 跳转到对应 Trace 详情
 * 3. 过滤最小错误率 → 聚焦高错误率操作
 * 4. 空状态 → 提示当前系统健康
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Typography, Card, Table, Tag, Button, Space, Select, message } from 'antd';
import { WarningOutlined, ReloadOutlined } from '@ant-design/icons';
import { colors, spacing, componentRadius, shadows } from '@/tokens';
import { getErrorRates } from '@/api/apm';

const { Title, Text } = Typography;

const MIN_ERROR_RATE_OPTIONS = [
  { label: '全部', value: 0 },
  { label: '>{'>'}1%', value: 0.01 },
  { label: '>{'>'}5%', value: 0.05 },
  { label: '>{'>'}10%', value: 0.1 },
];

const ErrorAnalysisPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<any[]>([]);
  const [minErrorRate, setMinErrorRate] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getErrorRates({ minErrorRate, limit: 50 });
      setErrors(res.data?.data || []);
    } catch (error: unknown) {
      message.error(`加载错误数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [minErrorRate]);

  useEffect(() => { loadData(); }, [loadData]);

  const columns = [
    { title: '服务', dataIndex: 'serviceName', key: 'serviceName', width: 180, render: (v: string) => <Text strong>{v}</Text> },
    { title: '操作', dataIndex: 'operationName', key: 'operationName', width: 240 },
    { title: '总请求数', dataIndex: 'totalCount', key: 'totalCount', width: 100, align: 'right' as const },
    { title: '错误数', dataIndex: 'errorCount', key: 'errorCount', width: 100, align: 'right' as const },
    {
      title: '错误率',
      dataIndex: 'errorRate',
      key: 'errorRate',
      width: 120,
      sorter: (a: any, b: any) => a.errorRate - b.errorRate,
      render: (rate: number) => (
        <Tag color={rate > 0.1 ? colors.error[500] : rate > 0.05 ? colors.warning[500] : colors.neutral[500]}>
          {(rate * 100).toFixed(2)}%
        </Tag>
      ),
    },
    {
      title: 'Top 错误',
      dataIndex: 'topErrors',
      key: 'topErrors',
      render: (topErrors: any[]) => {
        if (!topErrors || topErrors.length === 0) return '-';
        return (
          <Space direction="vertical" size={2}>
            {topErrors.slice(0, 3).map((e: any, i: number) => (
              <div key={i}>
                <Text style={{ fontSize: 11 }}>{e.message?.slice(0, 60)}</Text>
                {e.sample_trace_id && (
                  <a href={`/apm/traces/${e.sample_trace_id}`} style={{ fontSize: 11, marginLeft: 8 }}>
                    查看 Trace
                  </a>
                )}
              </div>
            ))}
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: spacing[4] }}>
        <Title level={2} style={{ marginBottom: 8 }}>
          <WarningOutlined style={{ marginRight: 12, color: colors.error[500] }} />
          错误分析
        </Title>
        <Text type="secondary">按错误率排行定位高频错误，快速跳转到对应 Trace 排查根因</Text>
      </div>

      <Card size="small" style={{ marginBottom: spacing[4] }}>
        <Space>
          <Select
            value={minErrorRate}
            onChange={setMinErrorRate}
            style={{ width: 140 }}
            options={MIN_ERROR_RATE_OPTIONS}
          />
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
        </Space>
      </Card>

      <Card size="small" loading={loading} style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}>
        <Table
          columns={columns}
          dataSource={errors}
          loading={loading}
          rowKey={(r: any) => `${r.serviceName}:${r.operationName}`}
          pagination={{ pageSize: 20 }}
          locale={{
            emptyText: (
              <div style={{ padding: spacing[8] }}>
                <Text type="secondary">当前无高错误率操作</Text>
                <br />
                <Text type="secondary">系统运行健康</Text>
              </div>
            ),
          }}
        />
      </Card>
    </div>
  );
};

export default ErrorAnalysisPage;
```

### 11.8 路由注册

```typescript
// orion-frontend/src/router/routes.tsx — 新增 APM 路由

import { lazy } from 'react';

const ApmTraceSearch = lazy(() => import('@/pages/apm/TraceSearch'));
const ApmTraceDetail = lazy(() => import('@/pages/apm/TraceDetail'));
const ApmServiceList = lazy(() => import('@/pages/apm/ServiceList'));
const ApmServiceTopology = lazy(() => import('@/pages/apm/ServiceTopology'));
const ApmSlowCalls = lazy(() => import('@/pages/apm/SlowCalls'));
const ApmErrorAnalysis = lazy(() => import('@/pages/apm/ErrorAnalysis'));

// 添加到 routes 数组
const apmRoutes = [
  {
    path: '/apm/traces',
    element: <ApmTraceSearch />,
  },
  {
    path: '/apm/traces/:traceId',
    element: <ApmTraceDetail />,
  },
  {
    path: '/apm/services',
    element: <ApmServiceList />,
  },
  {
    path: '/apm/services/topology',
    element: <ApmServiceTopology />,
  },
  {
    path: '/apm/slow-calls',
    element: <ApmSlowCalls />,
  },
  {
    path: '/apm/errors',
    element: <ApmErrorAnalysis />,
  },
];
```

---

## 12. 验收标准与量化指标

### 12.1 端到端场景验收

| # | 场景 | 预期结果 |
|---|------|---------|
| 1 | SDK 注入后发起 HTTP 请求 | 请求自动携带 `traceparent` Header，根 Span 自动创建 |
| 2 | 服务 A 调用服务 B | 服务 B 提取 `traceparent`，创建 child Span，`parent_span_id` 指向服务 A 的 `span_id` |
| 3 | 调用链包含 3+ 层嵌套 | `apm_spans` 中 `depth` 字段正确递增（0, 1, 2, ...） |
| 4 | 某服务返回 HTTP 500 | Span `status_code` = `error`，`status_message` = `HTTP 500`，`tags.http.status_code` = `500` |
| 5 | Trace 详情页查看调用链 | Gantt 图按 depth 缩进展示，耗时条颜色正确（>2s 红 / >500ms 橙 / <500ms 绿） |
| 6 | 点击错误 Span 展开详情 | 显示 error stack、tags、logs 完整信息 |
| 7 | 服务拓扑图渲染 | 节点数 ≥ 2，边正确指向，错误节点标红 |
| 8 | 慢调用排行 | P95/P99 数据与数据库中实际 span 耗时一致 |
| 9 | 错误率排行 | 错误率计算 = error_count / total_count，Top Errors 显示错误摘要 |
| 10 | 搜索 Trace（按 service + time range） | 返回结果正确过滤，分页正常 |
| 11 | 自适应采样触发 | 错误率从 1% 升到 10% 时，采样率从 10% 自动提升到 ≥ 50% |
| 12 | 分区自动创建 | 月末自动创建下月分区，写入不报错 |
| 13 | LLM Trace 关联 | APM trace 可通过 `external_trace_id` 关联到 `llm_traces` |

### 12.2 量化指标

| 指标 | 目标值 | 测量方式 |
|------|--------|---------|
| Trace 查询延迟 (trace_id 精准查询) | < 200ms | `EXPLAIN ANALYZE` + 实际 API 响应时间 |
| Trace 列表查询延迟 (< 100 条) | < 2s | API 响应时间 P95 |
| Span 采集吞吐量 | ≥ 1000 spans/s | 压测工具持续上报，监控 Ingestion 队列积压 |
| 拓扑图生成延迟 (< 100 节点) | < 5s | API 响应时间 |
| 慢调用分析查询延迟 | < 3s | API 响应时间 P95 |
| 分区自动创建成功率 | 100% | 定时任务执行日志 |
| 分区清理成功率 | 100% | 定时任务执行日志 |
| SDK 上报失败重试成功率 | > 99% | Ingestion 端 accepted/rejected 比率 |
| 前端页面首屏加载 | < 2s | Lighthouse 性能评分 |
| Gantt 图渲染性能 (100 spans) | < 500ms | React DevTools Profiler |

### 12.3 数据量预估与存储规划

| 指标 | 日数据量 | 月数据量 | 存储估算 |
|------|---------|---------|---------|
| Traces (10% 采样率, 1000 req/s) | ~864,000 | ~26M | apm_traces: ~5GB/月 |
| Spans (平均 5 spans/trace) | ~4.3M | ~130M | apm_spans: ~50GB/月 |
| Services (去重后) | ~100 | ~100 | apm_services: ~1MB |

**存储建议**：
- 单节点 PostgreSQL 可支撑 ≤ 50GB/月 的写入量
- 超过此阈值建议引入 TimescaleDB 扩展（基于 PostgreSQL 的时序数据库）或 ClickHouse 作为 OLAP 查询引擎

---

## 13. 实施计划

### 13.1 数据库迁移文件

```sql
-- orion-platform-service/src/db/migrations/191_create_apm_tracing.sql
-- APM 分布式链路追踪表（迁移 191）

-- 1. apm_traces（主表，按 partition_date 分区）
-- 2. apm_spans（详细表，按 partition_date 分区）
-- 3. apm_services（服务注册表）
-- 4. apm_sampling_configs（采样配置表）
-- 5. apm_error_stats_daily（错误日统计表）

-- 分区初始化（2026 年 5-8 月）
-- 索引创建（trace_id, service_name, operation_name, 时间范围）
-- 触发器创建（分区自动路由）
```

### 13.2 后端开发任务

| 任务 | 文件 | 预估工作量 | 依赖 |
|------|------|-----------|------|
| Migration 191 | `src/db/migrations/191_create_apm_tracing.sql` | 0.5 天 | 无 |
| ApmIngestionService | `src/services/apm/ApmIngestionService.ts` | 2 天 | Migration 191 |
| ApmTraceService / Repository | `src/services/apm/ApmTraceService.ts`, `src/repositories/ApmTraceRepository.ts` | 2 天 | Migration 191 |
| ApmTopologyService | `src/services/apm/ApmTopologyService.ts` | 1.5 天 | ApmIngestionService |
| ApmAnalyticsService | `src/services/apm/ApmAnalyticsService.ts` | 1.5 天 | ApmIngestionService |
| ApmSamplingService | `src/services/apm/ApmSamplingService.ts` | 1.5 天 | Migration 191 |
| PartitionManager | `src/services/apm/PartitionManager.ts` | 1 天 | Migration 191 |
| Apm Routes + Controller | `src/api/apm-routes.ts` | 1 天 | 以上所有 Service |
| Node.js SDK | `src/services/apm/sdk/NodeApmAgent.ts` | 2 天 | ApmIngestionService |
| Python SDK | `orion-apm-sdk-python/` | 2 天 | ApmIngestionService |
| routes.ts 注册 | `src/api/routes.ts` | 0.5 天 | Apm Routes |

### 13.3 前端开发任务

| 任务 | 文件 | 预估工作量 |
|------|------|-----------|
| API 客户端 | `orion-frontend/src/api/apm.ts` | 0.5 天 |
| Trace 搜索页 | `orion-frontend/src/pages/apm/TraceSearch/index.tsx` | 1.5 天 |
| Trace 详情页 (Gantt) | `orion-frontend/src/pages/apm/TraceDetail/index.tsx` | 2 天 |
| 服务列表页 | `orion-frontend/src/pages/apm/ServiceList/index.tsx` | 1 天 |
| 服务拓扑图 | `orion-frontend/src/pages/apm/ServiceTopology/index.tsx` | 1.5 天 |
| 慢调用分析页 | `orion-frontend/src/pages/apm/SlowCalls/index.tsx` | 1 天 |
| 错误分析页 | `orion-frontend/src/pages/apm/ErrorAnalysis/index.tsx` | 1 天 |
| 路由注册 | `orion-frontend/src/router/routes.tsx` | 0.5 天 |

### 13.4 总计

- **后端**: 14 天
- **前端**: 9 天
- **联调 + 测试**: 5 天
- **合计**: **28 天（约 1 人月）**

与升级计划中预估的"1 人月（APM 增强）"一致。

---

## 附录 A. 与 OpenTelemetry 标准的对齐

| OpenTelemetry 概念 | Orion APM 对应 | 对齐程度 |
|-------------------|---------------|---------|
| Trace ID (128-bit) | `apm_traces.trace_id` (32 hex) | 完全对齐 |
| Span ID (64-bit) | `apm_spans.span_id` (16 hex) | 完全对齐 |
| W3C Trace Context | `traceparent` Header | 完全对齐 |
| Span Kind | `apm_spans.span_kind` | 完全对齐 (internal/client/server/producer/consumer) |
| Span Status | `apm_spans.status_code` | 对齐 (ok/error/unset) |
| Span Attributes | `apm_spans.tags` (JSONB) | 对齐（OpenTelemetry 语义约定） |
| Span Events | `apm_spans.logs` (JSONB) | 对齐 |
| Resource Attributes | `apm_spans.resource_attributes` (JSONB) | 对齐 |

## 附录 B. 安全考虑

1. **敏感数据过滤**：SDK 上报前过滤 `Authorization`、`Cookie`、`password` 等敏感 tag
2. **租户隔离**：所有查询通过 `tenant_id` 强制过滤，SDK 上报通过 `service_account` 绑定租户
3. **上报限流**：Ingestion 端按 `service_account` 限流（默认 5000 spans/min），防止恶意刷数据
4. **TraceID 注入攻击防护**：`trace_id` 格式校验（32 hex），防止 SQL 注入
5. **存储加密**：`tags` 中的敏感字段在写入前脱敏

## 附录 C. 性能优化建议

1. **批量写入**：使用 `COPY` 命令或 `INSERT ... VALUES (...), (...), ...` 批量插入 spans
2. **连接池**：使用 `pg` 连接池（最大 50 连接），避免频繁创建连接
3. **Redis 缓存**：服务拓扑图结果缓存 5 分钟，避免重复计算
4. **查询优化**：`apm_spans` 查询必须包含 `partition_date` 条件以利用分区裁剪
5. **索引维护**：每月执行 `REINDEX` 维护分区索引
