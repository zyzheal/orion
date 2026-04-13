import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import type { ApiResponse } from './types';

// 创建 Axios 实例
const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
apiClient.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    return response;
  },
  (error: AxiosError<ApiResponse>) => {
    if (error.response) {
      const { status } = error.response;

      // 401: 未授权，跳转到登录页
      if (status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }

      // 403: 禁止访问
      if (status === 403) {
        console.error('403 Forbidden: 没有权限访问该资源');
      }

      // 404: 资源不存在
      if (status === 404) {
        console.error('404 Not Found: 资源不存在');
      }

      // 500: 服务器错误
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
  ): Promise<AxiosResponse<ApiResponse<T>>> {
    return apiClient.get(url, config) as Promise<AxiosResponse<ApiResponse<T>>>;
  },

  post<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<ApiResponse<T>>> {
    return apiClient.post(url, data, config) as Promise<AxiosResponse<ApiResponse<T>>>;
  },

  put<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<ApiResponse<T>>> {
    return apiClient.put(url, data, config) as Promise<AxiosResponse<ApiResponse<T>>>;
  },

  delete<T = unknown>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<ApiResponse<T>>> {
    return apiClient.delete(url, config) as Promise<AxiosResponse<ApiResponse<T>>>;
  },

  patch<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<ApiResponse<T>>> {
    return apiClient.patch(url, data, config) as Promise<AxiosResponse<ApiResponse<T>>>;
  },
};

export default apiClient;
