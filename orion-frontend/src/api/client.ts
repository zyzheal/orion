import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { message } from 'antd';
import type { ApiResponse } from './types';
import { useAuthStore } from '@/stores/authStore';

// ---- 统一配置 ----

/** API 基础路径：所有 API 文件使用相对路径（如 /projects），
 *  client.ts 自动拼接 /api/v1 前缀。
 *  硬编码 /api/v1/xxx 的旧文件需迁移到相对路径。
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// 创建 Axios 实例
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 — 使用 authStore.getToken() 支持自动刷新
apiClient.interceptors.request.use(
  async (config) => {
    const authStore = useAuthStore.getState();
    const token = await authStore.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // 添加租户 ID header
    const tenantId = localStorage.getItem('tenant_id') || 'default';
    config.headers['x-tenant-id'] = tenantId;
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 401 响应时的刷新队列 — 防止并发请求同时触发多次刷新
let isRefreshing = false;
type PendingRequest = {
  resolve: (token: string) => void;
  reject: (error: Error) => void;
};
let failedQueue: PendingRequest[] = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else if (token) {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

// 响应拦截器 — 统一响应格式解包 + 自动 Token 刷新
apiClient.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    const wrapped = response.data as unknown as Record<string, unknown> | undefined;
    // 统一格式: { success: true, data: T, meta?, requestId?, timestamp }
    // 如果 success 为 true，自动解包 data 字段，让调用方直接拿到 T
    if (wrapped && typeof wrapped === 'object' && 'success' in wrapped) {
      if (wrapped.success === true && wrapped.data !== undefined) {
        response.data = wrapped.data as unknown as typeof response.data;
      }
      // 如果 success 为 false，不解包，保留原始错误信息供调用方处理
    }
    // 兼容旧格式: { code: 200, message: 'OK', data: T } — 过渡期支持
    else if (wrapped && typeof wrapped === 'object' && 'code' in wrapped && wrapped.code === 200 && wrapped.data !== undefined) {
      response.data = wrapped.data as unknown as typeof response.data;
    }
    // 兼容直接返回 data 字段的格式: { data: T } — 过渡期支持
    else if (wrapped && typeof wrapped === 'object' && 'data' in wrapped && !('success' in wrapped) && !('code' in wrapped)) {
      response.data = wrapped.data as unknown as typeof response.data;
    }
    return response;
  },
  async (error: AxiosError<ApiResponse>) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      // 排除 auth 相关请求，防止无限循环
      const url = originalRequest.url || '';
      if (url.includes('/v1/auth/')) {
        // Token 刷新本身也 401，说明 refresh token 也失效了
        useAuthStore.getState().logout();
        // 不再做 window.location.href 跳转，让调用方的 catch 处理
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // 已有请求在刷新 token，将当前请求加入队列
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers = {
              ...originalRequest.headers,
              Authorization: `Bearer ${token}`,
            };
            return apiClient(originalRequest);
          })
          .catch((refreshError) => {
            return Promise.reject(refreshError);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        // 直接调用刷新端点（绕过当前 axios 实例的拦截器，避免递归）
        const response = await axios.post(
          `${import.meta.env.VITE_API_BASE_URL || '/api'}/v1/auth/refresh`,
          { refreshToken },
          { timeout: 10000 }
        );

        const { accessToken, refreshToken: newRefreshToken, expiresAt } = response.data.data;

        // 更新 authStore
        useAuthStore.getState().setTokens(
          accessToken,
          newRefreshToken || refreshToken,
          expiresAt
        );

        // 处理队列中的等待请求
        processQueue(null, accessToken);

        // 重试原始请求
        originalRequest.headers = {
          ...originalRequest.headers,
          Authorization: `Bearer ${accessToken}`,
        };
        return apiClient(originalRequest);
      } catch (refreshError) {
        // 刷新失败 — 清除所有状态，让调用方的 catch 处理
        processQueue(refreshError as Error, null);
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // 统一错误处理 — 所有后端错误都走 ResponseEnvelope 格式
    if (error.response) {
      const { status, data } = error.response as AxiosResponse & { data?: ApiResponse };
      if (status === 401) {
        // 401 已在上面处理，这里只处理其他场景
        return Promise.reject(error);
      }

      // 统一错误格式: { success: false, error: string, code: string, details, requestId }
      const errMsg = data?.error || '请求失败';
      const errCode = data?.code || `ERR_${status}`;
      const requestId = data?.requestId || '';

      if (status === 403) {
        // 权限错误 — 从 details 中提取更具体的信息
        const details = data?.details as Record<string, string> | undefined;
        const source = details?.source || 'unknown';
        const reason = details?.reason || errMsg;
        const label =
          source === 'abac' ? 'ABAC 策略拒绝' :
          source === 'rbac' ? '角色权限不足' :
          source === 'relationship' ? '项目权限不足' : '权限不足';
        message.error(`${label}：${reason}`);
        if (requestId) console.warn(`[403] requestId=${requestId}`);
      } else if (status === 404) {
        console.warn(`[404] ${errCode}: ${errMsg}${requestId ? ` (requestId=${requestId})` : ''}`);
      } else if (status >= 500) {
        console.error(`[500] ${errCode}: ${errMsg}${requestId ? ` (requestId=${requestId})` : ''}`);
        if (status === 502 || status === 503) {
          message.error('服务暂不可用，请稍后重试');
        } else {
          message.error('服务器内部错误，请联系管理员');
        }
      } else if (status === 400 || status === 422) {
        // 参数校验错误
        const details = data?.details as Record<string, string[]> | undefined;
        if (details) {
          const firstError = Object.values(details).flat()[0];
          message.error(firstError || errMsg);
        } else {
          message.error(errMsg);
        }
      } else if (status === 409) {
        message.error(`操作冲突：${errMsg}`);
      } else if (status === 429) {
        message.error('请求过于频繁，请稍后重试');
      }
    } else if (error.request) {
      // 网络错误（无响应）
      console.error('[Network] 请求未收到响应:', error.message);
      message.error('网络连接失败，请检查网络');
    }

    return Promise.reject(error);
  }
);

// 导出请求方法
export const api = {
  get<T = unknown>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return apiClient.get(url, config) as Promise<AxiosResponse<T>>;
  },

  post<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return apiClient.post(url, data, config) as Promise<AxiosResponse<T>>;
  },

  put<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return apiClient.put(url, data, config) as Promise<AxiosResponse<T>>;
  },

  delete<T = unknown>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return apiClient.delete(url, config) as Promise<AxiosResponse<T>>;
  },

  patch<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return apiClient.patch(url, data, config) as Promise<AxiosResponse<T>>;
  },
};

export default apiClient;
