/**
 * Utility constants for VectorStore display maps
 * Extracted from constants.ts - mock data has been removed.
 */

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
