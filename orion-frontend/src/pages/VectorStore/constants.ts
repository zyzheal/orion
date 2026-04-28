/**
 * Shared constants and mock data for VectorStore
 */
import type { VectorCollection, VectorDocument, SearchHit, VectorStats } from '@/api/vector-store';

// Color maps for status display
export const statusColorMap: Record<string, string> = {
  active: 'green',
  creating: 'blue',
  processing: 'blue',
  error: 'red',
  failed: 'red',
};

// Index type labels
export const indexTypeLabelMap: Record<string, string> = {
  flat: 'FLAT',
  ivf_flat: 'IVF_FLAT',
  hnsw: 'HNSW',
  annoy: 'Annoy',
};

// Distance metric labels
export const metricLabelMap: Record<string, string> = {
  cosine: '余弦相似度',
  euclidean: '欧氏距离',
  dot_product: '点积',
};

// Mock collections data
export const MOCK_COLLECTIONS: VectorCollection[] = [
  {
    name: 'orion-knowledge',
    displayName: 'Orion 知识库',
    description: 'Orion 平台技术文档和操作手册的向量集合',
    documentCount: 1250,
    dimensions: 1536,
    indexType: 'hnsw',
    distanceMetric: 'cosine',
    status: 'active',
    createdAt: '2024-01-15T08:00:00Z',
    updatedAt: '2026-04-25T14:30:00Z',
  },
  {
    name: 'code-snippets',
    displayName: '代码片段库',
    description: '常用代码片段和最佳实践的语义检索集合',
    documentCount: 3420,
    dimensions: 1536,
    indexType: 'hnsw',
    distanceMetric: 'cosine',
    status: 'active',
    createdAt: '2024-02-01T10:00:00Z',
    updatedAt: '2026-04-24T09:15:00Z',
  },
  {
    name: 'incident-reports',
    displayName: '故障报告库',
    description: '历史故障报告和解决方案的向量集合',
    documentCount: 867,
    dimensions: 768,
    indexType: 'ivf_flat',
    distanceMetric: 'euclidean',
    status: 'active',
    createdAt: '2024-03-10T12:00:00Z',
    updatedAt: '2026-04-20T16:45:00Z',
  },
  {
    name: 'api-docs',
    displayName: 'API 文档库',
    description: 'API 接口文档和示例的向量集合',
    documentCount: 2100,
    dimensions: 1536,
    indexType: 'hnsw',
    distanceMetric: 'cosine',
    status: 'active',
    createdAt: '2024-04-05T08:30:00Z',
    updatedAt: '2026-04-26T08:00:00Z',
  },
  {
    name: 'user-feedback',
    displayName: '用户反馈库',
    description: '用户反馈和建议的语义分析集合',
    documentCount: 543,
    dimensions: 384,
    indexType: 'flat',
    distanceMetric: 'dot_product',
    status: 'creating',
    createdAt: '2026-04-26T10:00:00Z',
    updatedAt: '2026-04-26T10:00:00Z',
  },
];

// Mock documents data
export const MOCK_DOCUMENTS: VectorDocument[] = [
  {
    id: 'doc-1',
    content: 'Orion 平台使用 Tekton 进行 CI/CD 流水线编排，支持多阶段构建和部署...',
    metadata: { source: 'tekton-guide.md', category: 'pipeline' },
    collection: 'orion-knowledge',
    dimensions: 1536,
    status: 'active',
    createdAt: '2026-04-20T10:00:00Z',
    updatedAt: '2026-04-20T10:00:00Z',
  },
  {
    id: 'doc-2',
    content: 'Knative 自动扩缩容配置：通过设置 minScale 和 maxScale 控制实例数量...',
    metadata: { source: 'knative-scaling.md', category: 'deployment' },
    collection: 'orion-knowledge',
    dimensions: 1536,
    status: 'active',
    createdAt: '2026-04-21T14:00:00Z',
    updatedAt: '2026-04-21T14:00:00Z',
  },
  {
    id: 'doc-3',
    content: 'Prometheus 告警规则配置示例：针对 CPU 使用率、内存占用和磁盘空间的监控...',
    metadata: { source: 'prometheus-alerts.md', category: 'monitoring' },
    collection: 'orion-knowledge',
    dimensions: 1536,
    status: 'active',
    createdAt: '2026-04-22T09:00:00Z',
    updatedAt: '2026-04-22T09:00:00Z',
  },
  {
    id: 'doc-4',
    content: '数据库连接池优化建议：使用 PgBouncer 进行连接复用，设置合适的 pool_size...',
    metadata: { source: 'db-optimization.md', category: 'database' },
    collection: 'orion-knowledge',
    dimensions: 1536,
    status: 'processing',
    createdAt: '2026-04-25T16:00:00Z',
    updatedAt: '2026-04-25T16:00:00Z',
  },
];

// Mock search results
export const MOCK_SEARCH_RESULTS: SearchHit[] = [
  {
    id: 'doc-1',
    content:
      'Orion 平台使用 Tekton 进行 CI/CD 流水线编排，支持多阶段构建和部署。Tekton 提供了原生的 Kubernetes 资源定义，使流水线可以无缝集成到集群环境中。',
    score: 0.92,
    metadata: { source: 'tekton-guide.md', category: 'pipeline' },
    collection: 'orion-knowledge',
  },
  {
    id: 'doc-2',
    content:
      'Knative 自动扩缩容配置：通过设置 minScale 和 maxScale 控制实例数量，配合 HPA 实现基于请求量的弹性伸缩。',
    score: 0.85,
    metadata: { source: 'knative-scaling.md', category: 'deployment' },
    collection: 'orion-knowledge',
  },
  {
    id: 'doc-3',
    content:
      'Prometheus 告警规则配置示例：针对 CPU 使用率、内存占用和磁盘空间的监控，设置合理的阈值和告警策略。',
    score: 0.78,
    metadata: { source: 'prometheus-alerts.md', category: 'monitoring' },
    collection: 'orion-knowledge',
  },
];

// Mock stats
export const MOCK_STATS: VectorStats = {
  documentCount: 8180,
  collectionCount: 5,
  totalEmbeddings: 8180,
  avgDimensions: 1152,
};
