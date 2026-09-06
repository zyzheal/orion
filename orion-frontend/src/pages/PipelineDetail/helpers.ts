/**
 * PipelineDetail - helpers
 * API 响应解析工具函数
 *
 * 兼容后端裸对象和 { data: ... } 包装两种格式。
 *
 * Axios 响应结构：
 *   response (AxiosResponse)
 *     └── data = 后端实际响应（Fastify 不包 { code, message }）
 *
 * 后端返回格式：
 *   - 列表接口: { data: [...], total: N }
 *   - 详情接口: { id, name, ... } 或 { run, stages, tasks }
 *   - 创建/更新: { id, name, ... }
 */

/**
 * 统一解析 API 响应：兼容后端裸对象和 { data: ... } 包装两种格式
 */
export function extractData<T = unknown>(response: unknown): T | null {
  const res = response as { data?: T } | T;
  if (!res) return null;

  // 第一层：AxiosResponse.data → 后端实际响应
  const backendResponse =
    typeof res === 'object' && res !== null && 'data' in res ? (res as { data?: T }).data : res;

  if (!backendResponse) return null;

  // 如果后端返回的是 { data: X } 格式（X 可能是对象或数组），返回 X
  if (backendResponse && typeof backendResponse === 'object' && 'data' in backendResponse) {
    return (backendResponse as { data?: T }).data ?? null;
  }

  // 否则直接返回后端响应（详情接口直接返回对象，无 data 包装）
  return backendResponse as T;
}

/**
 * 统一解析列表 API 响应
 */
export function extractList<T = unknown>(response: unknown): T[] {
  const res = response as { data?: T[] } | T[] | { runs?: T[] } | { items?: T[] };
  if (!res) return [];

  // 第一层：AxiosResponse.data → 后端实际响应
  const backendResponse = 'data' in res ? (res as { data?: T[] }).data : res;

  // 后端列表格式: { data: [...], total: N }
  if (Array.isArray(backendResponse)) return backendResponse;
  const runs = (backendResponse as Record<string, unknown>)?.runs;
  if (Array.isArray(runs)) return runs as T[];
  const items = (backendResponse as Record<string, unknown>)?.items;
  if (Array.isArray(items)) return items as T[];
  return [];
}
