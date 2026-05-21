import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
} from 'axios';
import { message } from '@ctzhian/ui';

type BasicResponse<T> = {
  data: T;
  success: boolean;
  message: string;
};

type ErrorResponse = {
  data: unknown;
  success: boolean;
  message: string;
};

type Response<T> = BasicResponse<T> | ErrorResponse;

const request = <T>(options: AxiosRequestConfig): Promise<T> => {
  // 优先使用子应用自己的 token，其次使用主应用传递的 token
  const token = localStorage.getItem('orion_knowledge_token') ||
    (window as any)?.$orion?.token ||
    (window as any)?.__orionToken || '';
  const config = {
    baseURL: '/',
    timeout: 0,
    withCredentials: true,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    ...options,
  };
  const service: AxiosInstance = axios.create(config);
  service.interceptors.response.use(
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    (response: AxiosResponse<Response<T>>) => {
      if (response.status === 200) {
        const res = response.data;
        if (res.success) {
          return res.data;
        }
        message.error(res.message || '网络异常');
        return Promise.reject(res);
      }
      message.error(response.statusText);
      return Promise.reject(response);
    },
    (error: AxiosError) => {
      // 子应用模式下不跳转登录，由主应用处理认证
      if (error.response?.status === 401 && !(window as any).__POWERED_BY_ORION__) {
        window.location.href = window.__BASENAME__ + '/login';
        localStorage.removeItem('orion_knowledge_token');
      }
      message.error(error.response?.statusText || '网络异常');
      return Promise.reject(error.response);
    },
  );

  return service(options);
};

export default request;
