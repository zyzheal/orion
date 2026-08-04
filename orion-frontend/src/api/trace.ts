/**
 * Trace API - Distributed tracing / OpenTelemetry trace queries
 *
 * P1-08: Trace 详情可视化 (Trace Waterfall / Gantt Chart)
 *
 * 当前为 mock 实现，接口预留，待后端 OTel 集成完成后替换。
 */

// apiClient is used for production calls (commented out for mock mode)
import _apiClient from './client';

// ---- 核心数据结构 ----

/** Span 事件 (OTel Span Event) */
export interface SpanEvent {
  name: string;
  timestamp: string;       // ISO 时间字符串
  attributes?: Record<string, string>;
}

/** Span 属性类型 - 支持 string / number / boolean */
export type SpanAttributeValue = string | number | boolean;

/** 单个 Span 详情 */
export interface Span {
  traceId: string;
  spanId: string;
  parentId?: string;
  name: string;
  service?: string;         // 所属服务名
  startTime: string;        // ISO 时间
  endTime: string;          // ISO 时间
  durationNs: number;       // 持续时长 (纳秒)
  durationMs?: number;      // 持续时长 (毫秒，可选)
  statusCode: 'OK' | 'ERROR' | 'UNSET';
  statusMessage?: string;
  kind?: string;            // server | client | producer | consumer | internal
  attributes?: Record<string, SpanAttributeValue>;
  events?: SpanEvent[];
}

/** Trace 搜索条件 */
export interface TraceSearchParams {
  serviceName?: string;
  operationName?: string;
  status?: 'OK' | 'ERROR';
  minDurationMs?: number;
  maxDurationMs?: number;
  startTime?: string;
  endTime?: string;
  tags?: Record<string, string>;
  tenantId?: string;
  limit?: number;
  offset?: number;
}

/** Trace 摘要 (列表页用) */
export interface TraceSummary {
  traceId: string;
  rootSpanName: string;
  rootService: string;
  startTime: string;
  endTime: string;
  durationNs: number;
  durationMs: number;
  spanCount: number;
  statusCode: 'OK' | 'ERROR' | 'UNSET';
  services: string[];
}

/** Trace 详情 (详情页用) */
export interface TraceDetail {
  traceId: string;
  rootSpanName: string;
  rootService: string;
  startTime: string;
  endTime: string;
  totalDurationNs: number;
  totalDurationMs: number;
  spanCount: number;
  spanCountByService: Record<string, number>;
  spans: Span[];
}

/** Trace 搜索结果 */
export interface TraceSearchResult {
  traces: TraceSummary[];
  total: number;
  limit: number;
  offset: number;
}

// ---- API 客户端 ----

export const traceApi = {
  /**
   * 搜索 Trace 列表
   */
  searchTraces: async (params?: TraceSearchParams): Promise<TraceSearchResult> => {
    // TODO: 对接真实后端后替换为以下调用
    // const response = await apiClient.get('/trace/search', { params });
    // return response.data as TraceSearchResult;

    // Mock 实现：返回模拟 trace 列表
    await mockDelay();
    const _mockServices = ['api-gateway', 'user-service', 'order-service', 'payment-service', 'inventory-service', 'notification-service'];
    void _mockServices;
    const mockTraces: TraceSummary[] = [
      {
        traceId: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
        rootSpanName: 'POST /api/orders',
        rootService: 'api-gateway',
        startTime: new Date(Date.now() - 5 * 60000).toISOString(),
        endTime: new Date(Date.now() - 5 * 60000 + 320).toISOString(),
        durationNs: 320_000_000,
        durationMs: 320,
        spanCount: 18,
        statusCode: 'ERROR',
        services: ['api-gateway', 'order-service', 'payment-service', 'inventory-service'],
      },
      {
        traceId: 'b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7',
        rootSpanName: 'GET /api/users/123',
        rootService: 'api-gateway',
        startTime: new Date(Date.now() - 10 * 60000).toISOString(),
        endTime: new Date(Date.now() - 10 * 60000 + 45).toISOString(),
        durationNs: 45_000_000,
        durationMs: 45,
        spanCount: 5,
        statusCode: 'OK',
        services: ['api-gateway', 'user-service'],
      },
      {
        traceId: 'c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8',
        rootSpanName: 'POST /api/payments',
        rootService: 'api-gateway',
        startTime: new Date(Date.now() - 20 * 60000).toISOString(),
        endTime: new Date(Date.now() - 20 * 60000 + 520).toISOString(),
        durationNs: 520_000_000,
        durationMs: 520,
        spanCount: 12,
        statusCode: 'OK',
        services: ['api-gateway', 'payment-service'],
      },
      {
        traceId: 'd4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9',
        rootSpanName: 'GET /api/orders/list',
        rootService: 'api-gateway',
        startTime: new Date(Date.now() - 30 * 60000).toISOString(),
        endTime: new Date(Date.now() - 30 * 60000 + 89).toISOString(),
        durationNs: 89_000_000,
        durationMs: 89,
        spanCount: 6,
        statusCode: 'OK',
        services: ['api-gateway', 'order-service'],
      },
      {
        traceId: 'e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0',
        rootSpanName: 'POST /api/inventory/reserve',
        rootService: 'inventory-service',
        startTime: new Date(Date.now() - 60 * 60000).toISOString(),
        endTime: new Date(Date.now() - 60 * 60000 + 1200).toISOString(),
        durationNs: 1_200_000_000,
        durationMs: 1200,
        spanCount: 8,
        statusCode: 'ERROR',
        services: ['inventory-service', 'notification-service'],
      },
    ];

    return { traces: mockTraces, total: mockTraces.length, limit: 10, offset: 0 };
  },

  /**
   * 获取 Trace 详情 (包含所有 Span)
   */
  getTrace: async (traceId: string): Promise<TraceDetail> => {
    // TODO: 对接真实后端后替换为以下调用
    // const response = await apiClient.get(`/trace/${traceId}`);
    // return response.data as TraceDetail;

    await mockDelay();
    return generateMockTraceDetail(traceId);
  },

  /**
   * 获取 Trace 摘要
   */
  getTraceSummary: async (traceId: string): Promise<TraceSummary> => {
    // TODO: 对接真实后端后替换为以下调用
    // const response = await apiClient.get(`/api/v1/trace/${traceId}/summary`);
    // return response.data as TraceSummary;
    const detail = await traceApi.getTrace(traceId);
    return {
      traceId,
      rootSpanName: detail.rootSpanName,
      rootService: detail.rootService,
      startTime: detail.startTime,
      endTime: detail.endTime,
      durationNs: detail.totalDurationNs,
      durationMs: detail.totalDurationMs,
      spanCount: detail.spanCount,
      statusCode: detail.spans.find((s) => !s.parentId)?.statusCode || 'UNSET',
      services: Object.keys(detail.spanCountByService),
    };
  },

  /**
   * 获取 Span 事件
   */
  getSpanEvents: async (_traceId: string, _spanId: string): Promise<SpanEvent[]> => {
    // TODO: 对接真实后端后替换
    // const response = await apiClient.get(`/api/v1/trace/${traceId}/span/${spanId}/events`);
    // return response.data as SpanEvent[];

    await mockDelay(50);
    return [];
  },
};

// ---- Mock 工具函数 ----

const mockDelay = (ms: number = 200): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 生成模拟 Trace 详情数据 (用于开发和演示)
 */
function generateMockTraceDetail(traceId: string): TraceDetail {
  const baseTime = Date.now() - 5 * 60 * 1000;
  const isError = traceId.includes('a1b2') || traceId.includes('e5f6');

  // 模拟 span 树结构: HTTP GET/POST → DB → Redis → external API
  const spans: Span[] = [
    // Root span
    {
      traceId,
      spanId: 'root-span-001',
      name: 'POST /api/orders',
      service: 'api-gateway',
      startTime: new Date(baseTime).toISOString(),
      endTime: new Date(baseTime + 320).toISOString(),
      durationNs: 320_000_000,
      durationMs: 320,
      statusCode: isError ? 'ERROR' : 'OK',
      statusMessage: isError ? 'Database timeout on order-service' : undefined,
      kind: 'server',
      attributes: {
        'http.method': 'POST',
        'http.route': '/api/orders',
        'http.status_code': isError ? '500' : '200',
        'server.address': '10.0.1.1',
      },
    },
    // api-gateway -> order-service
    {
      traceId,
      spanId: 'span-002',
      parentId: 'root-span-001',
      name: 'order-service.createOrder',
      service: 'order-service',
      startTime: new Date(baseTime + 5).toISOString(),
      endTime: new Date(baseTime + 310).toISOString(),
      durationNs: 305_000_000,
      durationMs: 305,
      statusCode: isError ? 'ERROR' : 'OK',
      kind: 'client',
      attributes: {
        'rpc.system': 'grpc',
        'rpc.method': 'CreateOrder',
        'db.operation': 'insert',
      },
    },
    // order-service -> payment-service (parallel child)
    {
      traceId,
      spanId: 'span-003',
      parentId: 'span-002',
      name: 'payment-service.charge',
      service: 'payment-service',
      startTime: new Date(baseTime + 10).toISOString(),
      endTime: new Date(baseTime + 150).toISOString(),
      durationNs: 140_000_000,
      durationMs: 140,
      statusCode: 'OK',
      kind: 'client',
      attributes: {
        'rpc.system': 'grpc',
        'payment.amount': '99.99',
      },
    },
    {
      traceId,
      spanId: 'span-004',
      parentId: 'span-003',
      name: 'payment-external-api',
      service: 'payment-service',
      startTime: new Date(baseTime + 20).toISOString(),
      endTime: new Date(baseTime + 140).toISOString(),
      durationNs: 120_000_000,
      durationMs: 120,
      statusCode: 'OK',
      kind: 'client',
      attributes: {
        'http.url': 'https://stripe.com/charges',
        'http.method': 'POST',
      },
    },
    {
      traceId,
      spanId: 'span-005',
      parentId: 'span-003',
      name: 'redis:cache_payment_result',
      service: 'payment-service',
      startTime: new Date(baseTime + 145).toISOString(),
      endTime: new Date(baseTime + 149).toISOString(),
      durationNs: 4_000_000,
      durationMs: 4,
      statusCode: 'OK',
      kind: 'internal',
      attributes: {
        'db.system': 'redis',
        'db.operation': 'SET',
      },
    },
    // order-service -> inventory-service (parallel child)
    {
      traceId,
      spanId: 'span-006',
      parentId: 'span-002',
      name: 'inventory-service.reserve',
      service: 'inventory-service',
      startTime: new Date(baseTime + 155).toISOString(),
      endTime: new Date(baseTime + 250).toISOString(),
      durationNs: 95_000_000,
      durationMs: 95,
      statusCode: isError ? 'ERROR' : 'OK',
      kind: 'client',
      attributes: {
        'rpc.system': 'grpc',
        'inventory.quantity': '2',
      },
    },
    {
      traceId,
      spanId: 'span-007',
      parentId: 'span-006',
      name: 'pg:SELECT inventory',
      service: 'inventory-service',
      startTime: new Date(baseTime + 160).toISOString(),
      endTime: new Date(baseTime + 220).toISOString(),
      durationNs: 60_000_000,
      durationMs: 60,
      statusCode: isError ? 'ERROR' : 'OK',
      kind: 'internal',
      statusMessage: isError ? 'Connection pool exhausted' : undefined,
      attributes: {
        'db.system': 'postgresql',
        'db.operation': 'SELECT',
        'db.statement': 'SELECT * FROM inventory WHERE product_id = $1',
      },
    },
    {
      traceId,
      spanId: 'span-008',
      parentId: 'span-006',
      name: 'pg:UPDATE inventory',
      service: 'inventory-service',
      startTime: new Date(baseTime + 225).toISOString(),
      endTime: new Date(baseTime + 245).toISOString(),
      durationNs: 20_000_000,
      durationMs: 20,
      statusCode: 'OK',
      kind: 'internal',
      attributes: {
        'db.system': 'postgresql',
        'db.operation': 'UPDATE',
      },
    },
    // order-service -> notification-service
    {
      traceId,
      spanId: 'span-009',
      parentId: 'span-002',
      name: 'notification-service.sendConfirmation',
      service: 'notification-service',
      startTime: new Date(baseTime + 255).toISOString(),
      endTime: new Date(baseTime + 300).toISOString(),
      durationNs: 45_000_000,
      durationMs: 45,
      statusCode: 'OK',
      kind: 'producer',
      attributes: {
        'messaging.system': 'rabbitmq',
        'messaging.destination': 'order_notifications',
      },
    },
    // order-service -> db
    {
      traceId,
      spanId: 'span-010',
      parentId: 'span-002',
      name: 'pg:INSERT orders',
      service: 'order-service',
      startTime: new Date(baseTime + 300).toISOString(),
      endTime: new Date(baseTime + 308).toISOString(),
      durationNs: 8_000_000,
      durationMs: 8,
      statusCode: 'OK',
      kind: 'internal',
      attributes: {
        'db.system': 'postgresql',
        'db.operation': 'INSERT',
      },
    },
    // redis cache lookup (parallel to order-service)
    {
      traceId,
      spanId: 'span-011',
      parentId: 'root-span-001',
      name: 'redis:get_user_session',
      service: 'api-gateway',
      startTime: new Date(baseTime + 1).toISOString(),
      endTime: new Date(baseTime + 4).toISOString(),
      durationNs: 3_000_000,
      durationMs: 3,
      statusCode: 'OK',
      kind: 'client',
      attributes: {
        'db.system': 'redis',
        'db.operation': 'GET',
      },
    },
    // auth check
    {
      traceId,
      spanId: 'span-012',
      parentId: 'root-span-001',
      name: 'auth-service.verifyToken',
      service: 'api-gateway',
      startTime: new Date(baseTime + 2).toISOString(),
      endTime: new Date(baseTime + 6).toISOString(),
      durationNs: 4_000_000,
      durationMs: 4,
      statusCode: 'OK',
      kind: 'client',
      attributes: {
        'auth.type': 'JWT',
      },
    },
    // Span events (示例)
    ...(isError
      ? [
          // 为错误的 span 添加事件
          {
            traceId,
            spanId: 'span-007',
            parentId: 'span-006',
            name: 'pg:SELECT inventory',
            service: 'inventory-service',
            startTime: new Date(baseTime + 160).toISOString(),
            endTime: new Date(baseTime + 220).toISOString(),
            durationNs: 60_000_000,
            durationMs: 60,
            statusCode: 'ERROR',
            kind: 'internal',
            attributes: {
              'db.system': 'postgresql',
              'db.operation': 'SELECT',
            },
            events: [
              {
                name: 'exception',
                timestamp: new Date(baseTime + 215).toISOString(),
                attributes: {
                  'exception.type': 'QueryExecutionError',
                  'exception.message': 'Connection pool exhausted',
                },
              },
              {
                name: 'retries',
                timestamp: new Date(baseTime + 218).toISOString(),
                attributes: {
                  'retry.count': '3',
                },
              },
            ],
          } as Span,
        ]
      : []),
  ];

  // 如果已包含 event 的 span，用新数据替换
  const spanMap = new Map<string, Span>();
  for (const s of spans) {
    spanMap.set(s.spanId, s);
  }

  const finalSpans = Array.from(spanMap.values());
  const spanCountByService: Record<string, number> = {};
  for (const s of finalSpans) {
    if (s.service) {
      spanCountByService[s.service] = (spanCountByService[s.service] || 0) + 1;
    }
  }

  return {
    traceId,
    rootSpanName: 'POST /api/orders',
    rootService: 'api-gateway',
    startTime: new Date(baseTime).toISOString(),
    endTime: new Date(baseTime + 320).toISOString(),
    totalDurationNs: 320_000_000,
    totalDurationMs: 320,
    spanCount: finalSpans.length,
    spanCountByService: spanCountByService,
    spans: finalSpans,
  };
}

export default traceApi;
