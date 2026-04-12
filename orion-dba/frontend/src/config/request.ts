import axios, { AxiosInstance } from 'axios';
import { notification } from 'ant-design-vue';
import { store } from '@/store';
import router from '@/router';
import i18n from '@/lang';

interface Res<T> {
  code: number;
  text: string;
  payload: T;
}

const { t } = i18n.global;

// 微前端：从 Orion 全局状态获取 Token 和 API 基础路径
const getOrionConfig = () => {
  const orion = (window as any).$orion || {};
  return {
    token: orion.token || sessionStorage.getItem('jwt'),
    apiBase: orion.getApiBase?.() || orion.apiBase || '/api/v2',
  };
};

const request: AxiosInstance = axios.create({
  timeout: 200000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const errorHandler = (error: {
  response: { data: { message: string }; status: number };
}) => {
  if (error.response) {
    if (error.response.status === 401) {
      notification.error({
        message: t('common.session.title'),
        description: t('common.session.desc'),
      });
      // 微前端：如果在 Orion 中运行，通知 Orion 会话过期
      if (window.__POWERED_BY_WUJIE__) {
        window.postMessage({ type: 'ORION_SESSION_EXPIRED' }, '*');
      } else {
        router.replace('/login');
      }
      return Promise.reject(error);
    }
    const data = error.response.data;
    notification.error({
      message: t('common.session.state') + `:${error.response.status}`,
      description: data.message,
    });
  }
  return Promise.reject(error);
};

const responseInject = (res: Res<never>) => {
  if (res.text !== '' && res.code === 1200) {
    notification.info({
      message: t('common.session.state') + ':1200',
      description: res.text,
    });
  }

  if (res.code > 1200) {
    notification.error({
      message: t('common.session.state') + `:${res.code}`,
      description: res.text,
    });
  }
};

request.interceptors.request.use((config) => {
  const { token } = getOrionConfig();
  if (token !== null) {
    // 微前端：优先使用 Orion Token
    if (window.__POWERED_BY_WUJIE__) {
      config.headers['X-Orion-Token'] = token;
    } else {
      config.headers['Authorization'] = token;
    }
  }
  return config;
}, errorHandler);

request.interceptors.response.use((response) => {
  responseInject(response.data);
  return response;
}, errorHandler);

const overrideHeaders = () => {
  const { token } = getOrionConfig();
  if (window.__POWERED_BY_WUJIE__) {
    request.defaults.headers.common['X-Orion-Token'] = token;
  } else {
    request.defaults.headers.common['Authorization'] = 'Bearer ' + token;
  }
};

// 微前端：导出 API 基础路径获取函数
export const getApiBase = () => {
  return getOrionConfig().apiBase;
};

// API 基础路径
export const COMMON_URI = '/api/v1/db';

export { request, overrideHeaders, Res };
