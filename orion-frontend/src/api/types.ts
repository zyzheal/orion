// =============================================================================
// Orion API 统一类型定义
// 后端统一响应格式: { success: boolean, data?: T, error?: string, code?: string,
//                       details?: Record<string,any>, requestId?: string, timestamp: string }
// =============================================================================

/** 统一后端响应信封 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  details?: Record<string, unknown>;
  requestId?: string;
  timestamp: string;
}

/** 分页元数据 */
export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
}

/** 分页响应 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/** 统一错误 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
  timestamp: string;
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
