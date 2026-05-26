/**
 * 前端 API 响应解包辅助函数
 *
 * 统一处理新旧两种响应格式，消除 `.data.data` 嵌套解包。
 *
 * 用法:
 *   import { unwrapResponse } from '@/api/unwrapper';
 *
 *   const data = unwrapResponse(await listTenants());
 *   // 自动处理:
 *   // 新格式 { success: true, data: T, meta: {...} } → 返回 T
 *   // 旧格式 { code: 200, message: 'OK', data: T } → 返回 T
 *   // 裸数据 T → 返回 T
 */

import type { AxiosResponse } from 'axios';

/**
 * 错误扩展接口
 */
interface ErrorWithCode extends Error {
  code?: string;
  requestId?: string;
}

/**
 * 新标准响应格式
 */
interface OrionResponseBody<T = unknown> {
  success: boolean;
  data: T | null;
  error?: { code: string; message: string; details?: unknown };
  meta?: Record<string, unknown>;
}

/**
 * 旧响应格式（兼容）
 */
interface LegacyResponseBody<T = unknown> {
  code?: number;
  message?: string;
  data?: T;
  [key: string]: unknown;
}

export type UnwrappedData<T> = T;

/**
 * 统一解包函数
 *
 * @param response Axios 响应对象
 * @returns 解包后的 data 字段
 * @throws 当响应格式错误 or success=false 时
 */
export function unwrapResponse<T>(response: AxiosResponse<OrionResponseBody<T> | LegacyResponseBody<T> | T>): UnwrappedData<T> {
  const body = response.data;

  if (!body || typeof body !== 'object') {
    // 非对象类型，直接返回
    return (body as unknown) as UnwrappedData<T>;
  }

  // 新标准格式: { success, data, meta }
  if ('success' in body) {
    const newFormat = body as OrionResponseBody<T>;
    if (!newFormat.success) {
      const errorMsg = newFormat.error?.message || '请求失败';
      const error: ErrorWithCode = new Error(errorMsg);
      // error.code 和 error.requestId 的类型是 string | undefined
      if (newFormat.error?.code) error.code = newFormat.error.code;
      error.requestId = newFormat.meta?.requestId as string | undefined;
      throw error;
    }
    // 列表接口: data 为数组或 null（null → 空数组）
    if (newFormat.data === null) {
      return [] as unknown as UnwrappedData<T>;
    }
    // newFormat.data 的类型是 T | null，需要断言
    return (newFormat.data ?? undefined) as UnwrappedData<T>;
  }

  // 旧格式: { code, message, data }
  if ('code' in body) {
    const legacy = body as LegacyResponseBody<T>;
    if (legacy.code && legacy.code !== 200) {
      const error: ErrorWithCode = new Error(legacy.message || '请求失败');
      error.code = `LEGACY.${legacy.code}`;
      throw error;
    }
    if (legacy.data !== undefined) {
      return (legacy.data ?? undefined) as UnwrappedData<T>;
    }
    // 旧格式但没有 data 字段，返回整个 body
    return (body as unknown) as UnwrappedData<T>;
  }

  // 裸数据（后端直接返回业务对象）
  return (body as unknown) as UnwrappedData<T>;
}

/**
 * 安全解包函数（不抛异常，失败返回 null）
 *
 * 适用于可选数据的场景
 */
export function unwrapResponseSafe<T>(response: AxiosResponse<OrionResponseBody<T> | LegacyResponseBody<T> | T> | null | undefined): UnwrappedData<T> | null {
  if (!response) return null;
  try {
    return unwrapResponse(response);
  } catch {
    return null;
  }
}

/**
 * 解包分页数据
 *
 * @returns { data: T[], meta: { page, limit, total, totalPages } }
 */
export function unwrapPaginatedResponse<T>(
  response: AxiosResponse<OrionResponseBody<T[]> | LegacyResponseBody<T[]> | T[]>
): { data: T[]; total: number; page: number; limit: number; totalPages: number } {
  const body = response.data;

  // 新标准格式
  if ('success' in body) {
    const newFormat = body as OrionResponseBody<T[]>;
    const meta = newFormat.meta || {};
    return {
      data: newFormat.data || [],
      total: (meta.total as number) || 0,
      page: (meta.page as number) || 1,
      limit: (meta.limit as number) || 20,
      totalPages: (meta.totalPages as number) || 0,
    };
  }

  // 旧格式
  if ('code' in body) {
    const legacy = body as LegacyResponseBody<T[]>;
    return {
      data: (legacy.data as T[]) || [],
      total: (legacy.total as number) || 0,
      page: (legacy.page as number) || 1,
      limit: (legacy.pageSize as number) || (legacy.limit as number) || 20,
      totalPages: Math.ceil(((legacy.total as number) || 0) / ((legacy.pageSize as number) || (legacy.limit as number) || 20)),
    };
  }

  // 裸数组
  if (Array.isArray(body)) {
    return {
      data: body,
      total: body.length,
      page: 1,
      limit: body.length,
      totalPages: 1,
    };
  }

  // 其他对象，尝试提取
  return {
    data: [],
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  };
}
