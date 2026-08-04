/**
 * FlameGraph API
 *
 * 性能火焰图 (CPU / Memory / IO) 数据接口。
 * 当前为 mock 实现，后端接口预留。
 *
 * 接口约定（后端实现时对接）：
 *   GET  /api/v1/observability/flamegraph/cpu?serviceId=&startTime=&endTime=
 *   GET  /api/v1/observability/flamegraph/memory?serviceId=&startTime=&endTime=
 *   GET  /api/v1/observability/flamegraph/io?serviceId=&startTime=&endTime=
 */

import apiClient from './client';

// ---- 类型定义 ----

/** 火焰图节点（自顶向下调用栈） */
export interface FlameGraphFrame {
  /** 函数名（如 "main.main"） */
  name: string;
  /** 该节点的值（CPU samples / 堆对象数 / IO 字节数） */
  value: number;
  /** 子调用栈（自顶向下结构） */
  children?: FlameGraphFrame[];
  /** 可选分类：用于图例区分（如 "runtime"、"network"、"app"） */
  category?: string;
}

/** 火焰图数据响应 */
export interface FlameGraphProfile {
  /** 节点树 */
  data: FlameGraphFrame;
  /** 时间窗口 */
  timeWindow: {
    start: string;
    end: string;
  };
  /** 采集的服务 / 实例 */
  serviceId: string;
  serviceName: string;
  /** 总 sample / 总字节数 */
  totalValue: number;
}

/** 火焰图类型 */
export type FlameGraphType = 'cpu' | 'memory' | 'io';

/** 火焰图类型标签映射 */
export const FLAME_GRAPH_LABELS: Record<FlameGraphType, string> = {
  cpu: 'CPU',
  memory: 'Memory',
  io: 'IO',
};

/** 火焰图单位映射 */
export const FLAME_GRAPH_UNITS: Record<FlameGraphType, string> = {
  cpu: 'samples',
  memory: 'objects',
  io: 'bytes',
};

/** 火焰图描述映射 */
export const FLAME_GRAPH_DESCRIPTIONS: Record<FlameGraphType, string> = {
  cpu: 'CPU 火焰图 — 框宽度 = 函数占用 CPU 时间占比',
  memory: '内存火焰图 — 框宽度 = 分配对象数 / 大小',
  io: 'IO 火焰图 — 框宽度 = IO 字节数占比',
};

// ---- API 接口（mock + 后端预留） ----

/** 获取火焰图 profile */
export const getFlameGraph = async (
  type: FlameGraphType,
  params?: {
    serviceId?: string;
    startTime?: string;
    endTime?: string;
  },
) => {
  const response = await apiClient.get<FlameGraphProfile>(
    `/api/v1/observability/flamegraph/${type}`,
    { params },
  );
  return response.data;
};

export const flameGraphApi = {
  get: getFlameGraph,
  // 兼容命名
  getCpu: (p?: Parameters<typeof getFlameGraph>[1]) => getFlameGraph('cpu', p),
  getMemory: (p?: Parameters<typeof getFlameGraph>[1]) => getFlameGraph('memory', p),
  getIO: (p?: Parameters<typeof getFlameGraph>[1]) => getFlameGraph('io', p),
};

export default flameGraphApi;

// ---- Mock 数据生成器 ----

/** 生成 CPU 火焰图 mock 数据 */
export const generateCpuFlameGraph = (): FlameGraphProfile => {
  return {
    serviceId: 'svc-001',
    serviceName: 'orion-platform-service',
    totalValue: 1000,
    timeWindow: { start: new Date(Date.now() - 60000).toISOString(), end: new Date().toISOString() },
    data: {
      name: 'main.main',
      value: 1000,
      category: 'app',
      children: [
        {
          name: 'handleRequest',
          value: 600,
          category: 'app',
          children: [
            {
              name: 'authMiddleware',
              value: 80,
              category: 'security',
              children: [
                { name: 'jwtVerify', value: 50, category: 'security', children: [{ name: 'rsaVerify', value: 40, category: 'crypto' }] },
                { name: 'tokenCacheLookup', value: 25, category: 'cache' },
                { name: 'aclCheck', value: 5, category: 'security' },
              ],
            },
            {
              name: 'pipelineHandler',
              value: 320,
              category: 'app',
              children: [
                { name: 'validateInput', value: 30, category: 'app' },
                { name: 'loadPipeline', value: 60, category: 'app', children: [{ name: 'dbQuery', value: 45, category: 'database' }, { name: 'cacheGet', value: 15, category: 'cache' }] },
                { name: 'executeStage', value: 180, category: 'app', children: [
                  { name: 'runTask', value: 140, category: 'app', children: [
                    { name: 'containerStart', value: 90, category: 'runtime', children: [{ name: 'httpCall', value: 70, category: 'network' }, { name: 'logWrite', value: 20, category: 'io' }] },
                    { name: 'waitResult', value: 50, category: 'runtime' },
                  ]},
                  { name: 'notifyWebhook', value: 40, category: 'network' },
                ]},
                { name: 'saveResult', value: 50, category: 'database', children: [{ name: 'dbInsert', value: 35, category: 'database' }, { name: 'updateMetrics', value: 15, category: 'metrics' }] },
              ],
            },
            {
              name: 'artifactHandler',
              value: 120,
              category: 'app',
              children: [
                { name: 'listArtifacts', value: 40, category: 'database' },
                { name: 'readMetadata', value: 35, category: 'io', children: [{ name: 'storageRead', value: 25, category: 'storage' }] },
                { name: 'compressResponse', value: 25, category: 'runtime' },
                { name: 'streamResponse', value: 20, category: 'network' },
              ],
            },
            { name: 'responseSend', value: 80, category: 'network' },
          ],
        },
        {
          name: 'backgroundTasks',
          value: 250,
          category: 'runtime',
          children: [
            { name: 'metricsCollector', value: 80, category: 'metrics', children: [{ name: 'prometheusScrape', value: 50, category: 'network' }, { name: 'metricAggregate', value: 30, category: 'app' }] },
            { name: 'logFlusher', value: 60, category: 'io', children: [{ name: 'fileWrite', value: 40, category: 'io' }, { name: 'rotateLog', value: 20, category: 'io' }] },
            { name: 'gcWorker', value: 50, category: 'runtime' },
            { name: 'heartbeat', value: 60, category: 'network', children: [{ name: 'natsPublish', value: 45, category: 'messaging' }, { name: 'healthCheck', value: 15, category: 'app' }] },
          ],
        },
        {
          name: 'sagaCoordinator',
          value: 150,
          category: 'app',
          children: [
            { name: 'processSagaStep', value: 90, category: 'app', children: [{ name: 'loadTransactionLog', value: 40, category: 'database' }, { name: 'executeCompensation', value: 50, category: 'app' }] },
            { name: 'reconcileState', value: 60, category: 'database' },
          ],
        },
      ],
    },
  };
};

/** 生成 Memory 火焰图 mock 数据 */
export const generateMemoryFlameGraph = (): FlameGraphProfile => {
  return {
    serviceId: 'svc-002',
    serviceName: 'orion-ai-service',
    totalValue: 800,
    timeWindow: { start: new Date(Date.now() - 60000).toISOString(), end: new Date().toISOString() },
    data: {
      name: 'python:app',
      value: 800,
      category: 'runtime',
      children: [
        {
          name: 'handle_ai_request',
          value: 450,
          category: 'app',
          children: [
            {
              name: 'load_model',
              value: 200,
              category: 'ml',
              children: [
                { name: 'model_from_disk', value: 150, category: 'io', children: [{ name: 'mmap', value: 100, category: 'runtime' }, { name: 'deserialize', value: 50, category: 'runtime' }] },
                { name: 'model_validate', value: 50, category: 'ml' },
              ],
            },
            {
              name: 'process_input',
              value: 130,
              category: 'app',
              children: [
                { name: 'tokenize', value: 80, category: 'ml', children: [{ name: 'vocab_lookup', value: 60, category: 'runtime' }] },
                { name: 'batch_prepare', value: 50, category: 'ml' },
              ],
            },
            { name: 'store_result', value: 120, category: 'database', children: [{ name: 'json_serialize', value: 70, category: 'runtime' }, { name: 'db_insert', value: 50, category: 'database' }] },
          ],
        },
        {
          name: 'background_workers',
          value: 350,
          category: 'runtime',
          children: [
            { name: 'cache_manager', value: 120, category: 'cache', children: [{ name: 'lru_evict', value: 80, category: 'runtime' }] },
            { name: 'event_loop', value: 100, category: 'runtime' },
            { name: 'gunicorn_worker', value: 130, category: 'runtime', children: [{ name: 'request_parse', value: 60, category: 'network' }, { name: 'response_buffer', value: 70, category: 'runtime' }] },
          ],
        },
      ],
    },
  };
};

/** 生成 IO 火焰图 mock 数据 */
export const generateIOFlameGraph = (): FlameGraphProfile => {
  return {
    serviceId: 'svc-003',
    serviceName: 'orion-visor',
    totalValue: 1200,
    timeWindow: { start: new Date(Date.now() - 60000).toISOString(), end: new Date().toISOString() },
    data: {
      name: 'visor-server',
      value: 1200,
      category: 'app',
      children: [
        {
          name: 'ingest_pipeline',
          value: 700,
          category: 'app',
          children: [
            {
              name: 'kafka_consumer',
              value: 400,
              category: 'messaging',
              children: [
                { name: 'poll_messages', value: 150, category: 'network' },
                { name: 'decode_payload', value: 120, category: 'runtime' },
                { name: 'validate_schema', value: 130, category: 'app' },
              ],
            },
            {
              name: 'storage_writer',
              value: 300,
              category: 'storage',
              children: [
                { name: 'parquet_write', value: 180, category: 'io', children: [{ name: 'os_write', value: 140, category: 'io' }, { name: 'flush_buffer', value: 40, category: 'io' }] },
                { name: 'index_update', value: 120, category: 'database' },
              ],
            },
          ],
        },
        {
          name: 'query_handler',
          value: 500,
          category: 'app',
          children: [
            {
              name: 'clickhouse_query',
              value: 300,
              category: 'database',
              children: [
                { name: 'tcp_connect', value: 40, category: 'network' },
                { name: 'execute_sql', value: 160, category: 'database' },
                { name: 'result_scan', value: 100, category: 'io' },
              ],
            },
            {
              name: 'response_stream',
              value: 200,
              category: 'network',
              children: [
                { name: 'protobuf_encode', value: 80, category: 'runtime' },
                { name: 'http_chunk_write', value: 120, category: 'io' },
              ],
            },
          ],
        },
      ],
    },
  };
};
