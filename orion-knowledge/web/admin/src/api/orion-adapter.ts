/**
 * Orion 微前端 API 调用适配
 *
 * 提供统一的 API 客户端封装，支持：
 * - getApiBase() 获取 API 基础路径
 * - X-Orion-Token Header 自动携带
 * - Token 刷新处理
 * - 错误处理统一
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { OrionGlobalState } from '@/main';

// ============================================
// 获取 API 基础路径
// ============================================
export function getApiBase(): string {
  // 优先从 $orion 获取
  if (typeof window !== 'undefined') {
    const orion = (window as any).$orion;
    if (orion?.apiBase) {
      return orion.apiBase;
    }
  }

  // 降级：环境变量
  return import.meta.env.VITE_API_BASE_URL || '/api';
}

// ============================================
// 获取 Token
// ============================================
export function getToken(): string | null {
  // 优先从 $orion 获取
  if (typeof window !== 'undefined') {
    const orion = (window as any).$orion;
    if (orion?.token) {
      return orion.token;
    }
  }

  // 降级：从 localStorage 获取
  return localStorage.getItem('orion_token');
}

// ============================================
// 创建 Axios 实例
// ============================================
const apiClient: AxiosInstance = axios.create({
  baseURL: getApiBase(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================
// 请求拦截器
// ============================================
apiClient.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers['X-Orion-Token'] = token;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ============================================
// 响应拦截器
// ============================================
apiClient.interceptors.response.use(
  (response) => {
    const { data } = response;

    // 处理业务错误
    if (data.code !== 0 && data.code !== 200) {
      handleApiError(data);
      return Promise.reject(new Error(data.message));
    }

    return data.data;
  },
  (error) => {
    if (error.response) {
      const { status } = error.response;

      switch (status) {
        case 401:
          handleUnauthorized();
          break;
        case 403:
          handleForbidden();
          break;
        case 404:
          handleError('资源不存在');
          break;
        case 429:
          handleError('请求过于频繁');
          break;
        case 500:
        case 502:
        case 503:
          handleServerError();
          break;
        default:
          handleError(error.response.data?.message || '请求失败');
      }
    } else if (error.message?.includes('Network Error')) {
      handleError('网络连接失败，请检查网络设置');
    } else if (error.code === 'ECONNABORTED') {
      handleError('请求超时，请重试');
    }

    return Promise.reject(error);
  }
);

// ============================================
// 错误处理函数
// ============================================
function handleApiError(data: any) {
  console.error('[API Error]', data.message);
  showMessage('error', data.message);
}

function handleUnauthorized() {
  console.error('[401] 认证失败，请重新登录');
  // 触发 Token 刷新或跳转登录
  window.dispatchEvent(
    new CustomEvent('orion-unauthorized', { detail: {} })
  );
}

function handleForbidden() {
  console.error('[403] 权限不足');
  showMessage('error', '权限不足');
}

function handleServerError() {
  console.error('[Server Error] 服务器内部错误');
  showMessage('error', '服务器错误，请稍后重试');
}

function handleError(message: string) {
  console.error('[Error]', message);
  showMessage('error', message);
}

function showMessage(type: 'success' | 'error', message: string) {
  // 优先使用主应用的消息组件
  const orion = (window as any).$orion;
  if (orion?.showMessage) {
    orion.showMessage(type, message);
    return;
  }

  // 降级：使用子应用自己的消息组件
  if (type === 'error') {
    console.error(message);
  }
}

// ============================================
// 导出 API 客户端
// ============================================
export default apiClient;

// ============================================
// 常用请求方法封装
// ============================================
export const api = {
  get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return apiClient.get(url, config);
  },

  post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return apiClient.post(url, data, config);
  },

  put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return apiClient.put(url, data, config);
  },

  delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return apiClient.delete(url, config);
  },

  upload<T>(url: string, formData: FormData): Promise<T> {
    return apiClient.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};
