import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { message } from 'antd';
import type { ApiResponse } from './types';
import { useAuthStore } from '@/stores/authStore';

// 创建 Axios 实例
const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
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

// 响应拦截器 — 带自动 Token 刷新和 ApiResponse 自动解包
apiClient.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    // 自动解包 ApiResponse 格式
    // ApiResponse<T> = { code?, message?, data?: T, success?, meta? }
    // 解包后 response.data 直接是 T
    const rawData = response.data;
    if (rawData && typeof rawData === 'object') {
      // 新格式: { success: true, data: T, meta? }
      if (rawData.success === true && rawData.data !== undefined) {
        response.data = rawData.data as unknown as typeof response.data;
      }
      // 旧格式: { code: 200, message: 'OK', data: T }
      else if (rawData.code === 200 && rawData.data !== undefined) {
        response.data = rawData.data as unknown as typeof response.data;
      }
      // 直接返回 data 字段的格式: { data: T }
      else if (rawData.data !== undefined && rawData.success === undefined && rawData.code === undefined) {
        response.data = rawData.data as unknown as typeof response.data;
      }
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

    // 其他错误处理
    if (error.response) {
      const { status, data } = error.response as AxiosResponse & { data?: Record<string, unknown> };
      if (status === 403) {
        // 后端 RequireAuthorization 返回 { code: 403, message, detail, source }
        const detail = data?.detail as string | undefined;
        const source = data?.source as string | undefined;
        const reason = detail || '没有权限访问该资源';
        const label = source === 'abac' ? '访问策略拒绝' :
                      source === 'relationship' ? '项目权限不足' :
                      source === 'rbac' ? '角色权限不足' : '权限不足';
        message.error(`${label}：${reason}`);
      }
      if (status === 404) {
        console.error('404 Not Found: 资源不存在');
      }
      if (status >= 500) {
        console.error('500 Server Error: 服务器错误');
      }
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
