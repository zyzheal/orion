/**
 * Page Context Extractor
 *
 * FE-2: 路由正则集中管理，避免散落在多处
 * 当 routes.ts 变更时，同步更新此文件的路由模式
 */

export interface PageContext {
  type: string;
  id?: string;
  resourcePath?: string;
}

/**
 * 从 routes.ts 中实际存在的路由提取路径模式
 * 集中管理，避免硬编码散落在 ChatTrigger 等多处
 */
const ROUTE_CONTEXT_MAP: Array<{ pattern: RegExp; type: string; idParam?: string }> = [
  { pattern: /^\/pipelines\/(\d+)$/, type: 'pipeline', idParam: 'id' },
  { pattern: /^\/pipelines\/new$/, type: 'pipeline_editor' },
  { pattern: /^\/deployments\/(\d+)$/, type: 'deployment', idParam: 'id' },
  { pattern: /^\/alerts$/, type: 'alert_list' },
  { pattern: /^\/alerts\/(\d+)$/, type: 'alert_detail', idParam: 'id' },
  { pattern: /^\/cmdb$/, type: 'cmdb' },
  { pattern: /^\/cmdb\/([^/]+)\/([^/]+)/, type: 'cmdb_detail', idParam: 'id' },
  { pattern: /^\/console\/chatops/, type: 'chatops_admin' },
  { pattern: /^\/ephemeral-envs$/, type: 'ephemeral_env_list' },
  { pattern: /^\/ephemeral-envs\/(\d+)$/, type: 'ephemeral_env_detail', idParam: 'id' },
  { pattern: /^\/artifacts$/, type: 'artifact_list' },
  { pattern: /^\/artifacts\/(\d+)$/, type: 'artifact_detail', idParam: 'id' },
  { pattern: /^\/projects\/(\d+)$/, type: 'project', idParam: 'id' },
  { pattern: /^\/code-mgmt\/branch-policy/, type: 'branch_policy' },
];

export function extractPageContext(pathname: string): PageContext {
  for (const { pattern, type, idParam } of ROUTE_CONTEXT_MAP) {
    const match = pathname.match(pattern);
    if (match) {
      const ctx: PageContext = { type, resourcePath: pathname };
      if (idParam && match[1]) ctx.id = match[1];
      return ctx;
    }
  }

  // 默认: 从路径第一段推断
  const firstSegment = pathname.split('/')[1];
  if (firstSegment) {
    return { type: firstSegment, resourcePath: pathname };
  }
  return { type: 'general', resourcePath: pathname };
}

/**
 * 获取当前路由的模式列表（用于调试/测试）
 */
export function getRoutePatterns(): string[] {
  return ROUTE_CONTEXT_MAP.map(r => r.pattern.source);
}
