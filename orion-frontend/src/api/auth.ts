import { api } from './client';
import type {
  LoginRequest,
  LoginResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  UserInfo,
} from './types';

/**
 * 用户登录
 */
export const login = async (data: LoginRequest): Promise<LoginResponse> => {
  const response = await api.post<LoginResponse>('/auth/login', data);
  // 响应格式：{ success: true, data: { accessToken, ... } }
  return response.data.data as LoginResponse;
};

/**
 * 用户登出
 */
export const logout = async (): Promise<void> => {
  await api.post('/auth/logout');
};

/**
 * 刷新 Token
 */
export const refreshToken = async (refreshToken: string): Promise<RefreshTokenResponse> => {
  const response = await api.post<RefreshTokenResponse>('/auth/refresh', { refreshToken });
  return response.data.data;
};

/**
 * 刷新 Token 的简化调用
 */
export const refreshAuthToken = async (refreshToken: string): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}> => {
  const response = await refreshToken(refreshToken);
  return {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
    expiresAt: response.expiresAt || Date.now() + 24 * 60 * 60 * 1000,
  };
};

/**
 * 获取当前用户信息
 */
export const getCurrentUser = async (): Promise<UserInfo> => {
  const response = await api.get<UserInfo>('/auth/me');
  return response.data.data;
};
