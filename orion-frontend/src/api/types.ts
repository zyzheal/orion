// API 类型定义
// 支持两种响应格式：
// 1. 新格式: { success: boolean, data: T, meta?: {...} }
// 2. 旧格式: { code: number, message: string, data: T }
export interface ApiResponse<T = unknown> {
  code?: number;
  message?: string;
  data?: T;
  success?: boolean;
  meta?: Record<string, unknown>;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // 过期时间戳（毫秒）
  user: UserInfo;
}

export interface UserInfo {
  id: string;
  username: string;
  email: string;
  role: string;
  roles?: string[];  // 多角色支持
  avatar?: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface DashboardStats {
  totalProjects: number;
  activePipelines: number;
  totalUsers: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
}
