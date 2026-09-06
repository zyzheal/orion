/**
 * constants.ts - 向量存储常量
 * 抽取自 VectorStorePage.tsx (P2-9 Phase 93)
 */
export const statusColorMap: Record<string, string> = {
  active: 'green',
  creating: 'blue',
  processing: 'blue',
  error: 'red',
  failed: 'red',
};

export const indexTypeLabelMap: Record<string, string> = {
  flat: 'FLAT',
  ivf_flat: 'IVF_FLAT',
  hnsw: 'HNSW',
  annoy: 'Annoy',
};

export const metricLabelMap: Record<string, string> = {
  cosine: '余弦相似度',
  euclidean: '欧氏距离',
  dot_product: '点积',
};

export const statusLabelMap: Record<string, string> = {
  active: '活跃',
  creating: '创建中',
  processing: '处理中',
  error: '错误',
  failed: '失败',
};

export const docStatusLabelMap: Record<string, string> = {
  active: '就绪',
  processing: '处理中',
  failed: '失败',
};

export const TOP_K_OPTIONS = [
  { label: 'Top 3', value: 3 },
  { label: 'Top 5', value: 5 },
  { label: 'Top 10', value: 10 },
  { label: 'Top 20', value: 20 },
];

export const DIMENSION_OPTIONS = [
  { label: '384 (all-MiniLM)', value: 384 },
  { label: '768 (BGE-base)', value: 768 },
  { label: '1024 (BGE-large)', value: 1024 },
  { label: '1536 (OpenAI/Ada)', value: 1536 },
  { label: '3072 (GTE-large)', value: 3072 },
];

export const INDEX_TYPE_OPTIONS = [
  { label: 'HNSW (推荐)', value: 'hnsw' },
  { label: 'IVF_FLAT', value: 'ivf_flat' },
  { label: 'FLAT (精确)', value: 'flat' },
  { label: 'Annoy', value: 'annoy' },
];

export const METRIC_OPTIONS = [
  { label: '余弦相似度', value: 'cosine' },
  { label: '欧氏距离', value: 'euclidean' },
  { label: '点积', value: 'dot_product' },
];
