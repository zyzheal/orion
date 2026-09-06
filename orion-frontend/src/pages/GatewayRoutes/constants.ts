/**
 * GatewayRoutes constants
 * API 网关路由页常量（抽取自 index.tsx）
 */

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

export const HTTP_METHOD_COLORS: Record<string, string> = {
  GET: 'blue',
  POST: 'green',
  PUT: 'orange',
  DELETE: 'red',
  PATCH: 'cyan',
  HEAD: 'default',
  OPTIONS: 'default',
};

export const METHOD_LABELS: Record<string, string> = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
  PATCH: 'PATCH',
  HEAD: 'HEAD',
  OPTIONS: 'OPTIONS',
};
