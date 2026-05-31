import { api } from './client';
import type { LoginRequest, LoginResponse, RefreshTokenResponse, UserInfo } from './types';

/**
 * 用户登录
 */
export const login = async (data: LoginRequest): Promise<LoginResponse> => {
  const response = await api.post<LoginResponse>('/v1/auth/login', data);
  return response.data;
};

/**
 * 用户登出
 *
 * Phase 3.8.4: 单点登出 — 通知后端广播 OrionBus 事件
 * 前端需传递 accessToken 和 refreshToken 以触发 token 黑名单
 */
export const logout = async (accessToken?: string, refreshToken?: string): Promise<void> => {
  await api.post('/v1/auth/logout', {
    accessToken,
    refreshToken,
  });
};

/**
 * 刷新 Token
 */
export const refreshToken = async (refreshToken: string): Promise<RefreshTokenResponse> => {
  const response = await api.post<RefreshTokenResponse>('/v1/auth/refresh', { refreshToken });
  return response.data;
};

/**
 * 刷新 Token 的简化调用
 */
export const refreshAuthTokenApi = async (
  token: string
): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}> => {
  const response = await refreshToken(token);
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
  const response = await api.get<UserInfo>('/v1/auth/me');
  return response.data;
};

/**
 * 获取启用的 SSO 提供商列表（公开接口，无需登录）
 *
 * Phase 3.8.3: 登录页动态展示可用 SSO Provider
 */
export const getEnabledSsoProviders = async (): Promise<Array<{
  name: string;
  type: string;
  display_name: string;
  display_icon?: string;
}>> => {
  const response = await api.get('/v1/auth/sso/providers-enabled');
  return (response.data || []) as { name: string; type: string; display_name: string; display_icon?: string }[];
};

/**
 * 获取 SSO 登录状态
 */
export const getSsoStatus = async (): Promise<{
  ssoEnabled: boolean;
  ssoIssuer: string | null;
  ssoScopes: string[];
}> => {
  const response = await api.get('/v1/auth/sso/status');
  return response.data as { ssoEnabled: boolean; ssoIssuer: string | null; ssoScopes: string[] };
};

/**
 * 获取 JWT 密钥轮换状态（管理员接口）
 *
 * Phase 3.8.1: 统一 JWT 密钥管理
 */
export const getJwtKeyStatus = async (): Promise<{
  initialized: boolean;
  activeKeyId?: string;
  verificationKeyCount: number;
  nextRotationDate?: string;
}> => {
  const response = await api.get('/v1/auth/keys');
  return response.data as { initialized: boolean; activeKeyId?: string; verificationKeyCount: number; nextRotationDate?: string };
};
