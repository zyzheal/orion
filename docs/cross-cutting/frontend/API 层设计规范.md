# Orion 前端 API 层设计规范

> 版本：v1.0  
> 创建日期：2026-04-10  
> 适用范围：React + TypeScript 前端项目

---

## 一、概述

### 1.1 设计目标

| 目标 | 说明 |
|------|------|
| 类型安全 | 完整的 TypeScript 类型定义 |
| 统一规范 | 一致的请求/响应处理流程 |
| 易于维护 | 清晰的模块划分和代码组织 |
| 错误处理 | 统一的错误捕获和用户提示 |
| 认证集成 | 无缝的 Token 管理和刷新机制 |
| 可扩展性 | 支持新增业务模块 without 修改核心逻辑 |

### 1.2 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Axios | 1.x | HTTP 客户端 |
| TypeScript | 5.x | 类型系统 |
| React Query | 5.x | 数据获取和缓存 |
| Zustand | 4.x | 认证状态管理 |

---

## 二、目录结构

```
src/api/
├── types.ts                    # 通用类型定义
├── constants.ts                # 常量定义（错误码等）
├── client.ts                   # Axios 实例配置
├── interceptors.ts             # 请求/响应拦截器
├── error.ts                    # 错误处理逻辑
├── auth.ts                     # 认证相关 API
├── modules/                    # 业务模块 API
│   ├── pipeline.ts
│   ├── approval.ts
│   ├── deployment.ts
│   ├── efficiency.ts
│   ├── tool.ts
│   ├── artifact.ts
│   ├── library.ts
│   ├── skill.ts
│   └── notification.ts
├── hooks/                      # API Hooks 封装
│   ├── usePipeline.ts
│   ├── useApproval.ts
│   ├── useDeployment.ts
│   └── useNotification.ts
└── index.ts                    # 统一导出
```

---

## 三、API 类型定义

### 3.1 统一响应结构

```typescript
// api/types.ts

/**
 * API 响应基础结构
 */
export interface ApiResponse<T = any> {
  /** 业务状态码，0 表示成功 */
  code: number
  /** 状态消息 */
  message: string
  /** 响应数据 */
  data: T
  /** 元数据 */
  meta?: ResponseMeta
}

/**
 * 响应元数据
 */
export interface ResponseMeta {
  /** 请求 ID，用于链路追踪 */
  requestId: string
  /** 服务器响应时间戳 */
  timestamp: string
}

/**
 * 空响应数据类型
 */
export type VoidData = null

/**
 * 成功响应快捷类型
 */
export type SuccessResponse<T = any> = ApiResponse<T> & { code: 0 }
```

### 3.2 错误码枚举

```typescript
// api/constants.ts

/**
 * 错误码枚举
 */
export enum ErrorCode {
  // 成功
  SUCCESS = 0,

  // 通用错误 (10000-10099)
  INVALID_PARAMS = 10000,
  RESOURCE_NOT_FOUND = 10001,
  RESOURCE_EXISTS = 10002,
  PARAM_REQUIRED = 10003,
  PARAM_FORMAT_ERROR = 10004,
  PARAM_OUT_OF_RANGE = 10005,

  // 认证授权错误 (10100-10199)
  UNAUTHORIZED = 10101,
  TOKEN_EXPIRED = 10102,
  FORBIDDEN = 10103,
  RESOURCE_DELETED = 10104,

  // 业务错误 (10200-10299)
  BUSINESS_ERROR = 10200,
  INVALID_STATUS = 10201,
  DEPENDENCY_NOT_FOUND = 10202,
  OPERATION_TIMEOUT = 10203,

  // 系统错误 (20000-20099)
  INTERNAL_ERROR = 20000,
  DATABASE_ERROR = 20001,
  EXTERNAL_SERVICE_ERROR = 20002,
  SERVICE_UNAVAILABLE = 20003,
  SERVICE_BUSY = 20004
}

/**
 * HTTP 状态码到业务错误码的映射
 */
export const HTTP_STATUS_TO_ERROR_CODE: Record<number, ErrorCode> = {
  400: ErrorCode.INVALID_PARAMS,
  401: ErrorCode.UNAUTHORIZED,
  403: ErrorCode.FORBIDDEN,
  404: ErrorCode.RESOURCE_NOT_FOUND,
  409: ErrorCode.RESOURCE_EXISTS,
  422: ErrorCode.PARAM_FORMAT_ERROR,
  429: ErrorCode.SERVICE_BUSY,
  500: ErrorCode.INTERNAL_ERROR,
  502: ErrorCode.EXTERNAL_SERVICE_ERROR,
  503: ErrorCode.SERVICE_UNAVAILABLE,
  504: ErrorCode.OPERATION_TIMEOUT
}

/**
 * 错误消息映射
 */
export const ERROR_MESSAGE_MAP: Record<ErrorCode, string> = {
  [ErrorCode.SUCCESS]: '操作成功',
  [ErrorCode.INVALID_PARAMS]: '请求参数无效',
  [ErrorCode.RESOURCE_NOT_FOUND]: '资源不存在',
  [ErrorCode.RESOURCE_EXISTS]: '资源已存在',
  [ErrorCode.PARAM_REQUIRED]: '参数必填',
  [ErrorCode.PARAM_FORMAT_ERROR]: '参数格式错误',
  [ErrorCode.PARAM_OUT_OF_RANGE]: '参数超出范围',
  [ErrorCode.UNAUTHORIZED]: '未登录或登录已过期',
  [ErrorCode.TOKEN_EXPIRED]: 'Token 已过期',
  [ErrorCode.FORBIDDEN]: '无权限访问',
  [ErrorCode.RESOURCE_DELETED]: '资源已被删除',
  [ErrorCode.BUSINESS_ERROR]: '业务校验失败',
  [ErrorCode.INVALID_STATUS]: '当前状态不允许此操作',
  [ErrorCode.DEPENDENCY_NOT_FOUND]: '依赖资源不存在',
  [ErrorCode.OPERATION_TIMEOUT]: '操作超时',
  [ErrorCode.INTERNAL_ERROR]: '服务器内部错误',
  [ErrorCode.DATABASE_ERROR]: '数据库异常',
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: '外部服务调用失败',
  [ErrorCode.SERVICE_UNAVAILABLE]: '服务暂时不可用',
  [ErrorCode.SERVICE_BUSY]: '系统繁忙，请稍后重试'
}
```

### 3.3 分页类型定义

```typescript
// api/types.ts

/**
 * 分页请求参数
 */
export interface PaginationRequest {
  /** 页码，从 1 开始 */
  page?: number
  /** 每页数量，默认 20，最大 100 */
  pageSize?: number
  /** 游标，用于基于游标的分页 */
  cursor?: string
}

/**
 * 分页响应数据
 */
export interface PaginationResponse<T = any> {
  /** 数据列表 */
  items: T[]
  /** 分页元数据 */
  pagination: PaginationMeta
}

/**
 * 分页元数据
 */
export interface PaginationMeta {
  /** 总记录数 */
  total: number
  /** 当前页码 */
  page: number
  /** 每页数量 */
  pageSize: number
  /** 总页数 */
  totalPages: number
  /** 下一页游标 */
  nextCursor?: string
  /** 上一页游标 */
  prevCursor?: string
}

/**
 * 带分页的 API 响应
 */
export type PagedApiResponse<T> = ApiResponse<PaginationResponse<T>>
```

### 3.4 通用字段类型

```typescript
// api/types.ts

/**
 * 基础实体字段
 */
export interface BaseEntity {
  /** 唯一标识 */
  id: string
  /** 创建时间 */
  createdAt: string
  /** 更新时间 */
  updatedAt: string
  /** 创建人 ID */
  createdBy?: string
  /** 更新人 ID */
  updatedBy?: string
}

/**
 * 用户信息
 */
export interface UserInfo {
  id: string
  username: string
  email: string
  avatar?: string
  displayName: string
  department?: string
  role: UserRole
}

/**
 * 用户角色枚举
 */
export enum UserRole {
  ADMIN = 'admin',
  DEVELOPER = 'developer',
  VIEWER = 'viewer',
  APPROVER = 'approver'
}

/**
 * 状态枚举
 */
export enum Status {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  CANCELLED = 'cancelled'
}

/**
 * 时间范围
 */
export interface TimeRange {
  startTime: string
  endTime: string
}

/**
 * 排序选项
 */
export interface SortOption {
  field: string
  order: 'asc' | 'desc'
}
```

---

## 四、API 客户端封装

### 4.1 Axios 实例配置

```typescript
// api/client.ts

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { ApiResponse } from './types'
import { ErrorCode } from './constants'

/**
 * API 基础配置
 */
const API_CONFIG = {
  /** API 基础 URL */
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  /** 请求超时时间（毫秒） */
  timeout: 30000,
  /** 默认 Headers */
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  }
}

/**
 * 创建 Axios 实例
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_CONFIG.baseURL,
  timeout: API_CONFIG.timeout,
  headers: API_CONFIG.headers
})

/**
 * 获取默认请求配置
 */
export const getDefaultConfig = (): AxiosRequestConfig => ({
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Version': import.meta.env.VITE_APP_VERSION || '1.0.0'
  }
})
```

### 4.2 请求/响应拦截器

```typescript
// api/interceptors.ts

import type { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios'
import { apiClient } from './client'
import { ErrorCode, ERROR_MESSAGE_MAP } from './constants'
import { handleAuthError, handleTokenRefresh } from './auth'

/**
 * 请求拦截器
 */
export const setupRequestInterceptors = () => {
  apiClient.interceptors.request.use(
    (config) => {
      // 注入认证 Token
      const token = getAuthToken()
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }

      // 添加请求时间戳（防止缓存）
      if (config.method === 'GET') {
        const separator = config.url?.includes('?') ? '&' : '?'
        config.url = `${config.url || ''}${separator}_t=${Date.now()}`
      }

      // 添加请求 ID（用于链路追踪）
      config.headers['X-Request-ID'] = generateRequestId()

      return config
    },
    (error: AxiosError) => {
      console.error('[API] Request error:', error)
      return Promise.reject(error)
    }
  )
}

/**
 * 响应拦截器
 */
export const setupResponseInterceptors = () => {
  apiClient.interceptors.response.use(
    (response: AxiosResponse<ApiResponse>) => {
      const { data, config } = response

      // 检查业务错误码
      if (data.code !== ErrorCode.SUCCESS) {
        const error = createApiError(data.code, data.message, config)
        return Promise.reject(error)
      }

      return response
    },
    async (error: AxiosError<ApiResponse>) => {
      const { response, config } = error

      // HTTP 错误处理
      if (response) {
        const { status, data } = response

        // Token 过期处理
        if (status === 401) {
          const isTokenRefreshed = await handleTokenRefresh()
          if (isTokenRefreshed) {
            // 重试原请求
            return apiClient(config!)
          }
          // Token 刷新失败，跳转登录
          handleAuthError()
          return Promise.reject(createApiError(ErrorCode.UNAUTHORIZED, '登录已过期'))
        }

        // 权限不足处理
        if (status === 403) {
          handleForbiddenError()
          return Promise.reject(createApiError(ErrorCode.FORBIDDEN, data?.message || '无权限访问'))
        }

        // 其他错误
        const errorCode = data?.code || status
        const errorMessage = data?.message || ERROR_MESSAGE_MAP[errorCode as ErrorCode] || '请求失败'
        return Promise.reject(createApiError(errorCode, errorMessage, config))
      }

      // 网络错误
      if (!response) {
        return Promise.reject(createApiError(ErrorCode.SERVICE_UNAVAILABLE, '网络连接失败，请检查网络'))
      }

      return Promise.reject(error)
    }
  )
}

/**
 * 生成请求 ID
 */
const generateRequestId = (): string => {
  return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 获取认证 Token
 */
const getAuthToken = (): string | null => {
  return localStorage.getItem('auth_token')
}

/**
 * 创建 API 错误对象
 */
const createApiError = (
  code: number,
  message: string,
  config?: AxiosRequestConfig
): ApiError => {
  const error = new Error(message) as ApiError
  error.code = code
  error.message = message
  error.config = config
  error.timestamp = new Date().toISOString()
  return error
}

/**
 * 处理无权限访问
 */
const handleForbiddenError = () => {
  // 可以在这里添加权限不足的统一处理逻辑
  // 例如：显示权限提示、记录日志等
  console.warn('[API] 无权限访问')
}
```

### 4.3 错误统一处理

```typescript
// api/error.ts

import { message } from 'antd'
import type { AxiosRequestConfig } from 'axios'
import { ErrorCode, ERROR_MESSAGE_MAP } from './constants'

/**
 * API 错误类
 */
export class ApiError extends Error {
  code: number
  message: string
  config?: AxiosRequestConfig
  timestamp: string
  details?: Record<string, any>

  constructor(code: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.message = message
    this.timestamp = new Date().toISOString()
  }
}

/**
 * 错误处理选项
 */
export interface ErrorHandleOptions {
  /** 是否显示错误提示，默认 true */
  showMessage?: boolean
  /** 错误提示类型，默认 'error' */
  messageType?: 'error' | 'warning' | 'info'
  /** 自定义错误消息 */
  customMessage?: string
  /** 错误回调 */
  onError?: (error: ApiError) => void
}

/**
 * 统一错误处理
 */
export const handleApiError = (
  error: unknown,
  options: ErrorHandleOptions = {}
) => {
  const {
    showMessage = true,
    messageType = 'error',
    customMessage,
    onError
  } = options

  let apiError: ApiError

  if (error instanceof ApiError) {
    apiError = error
  } else if (error instanceof Error) {
    apiError = new ApiError(ErrorCode.INTERNAL_ERROR, error.message)
  } else {
    apiError = new ApiError(ErrorCode.INTERNAL_ERROR, '未知错误')
  }

  // 执行错误回调
  onError?.(apiError)

  // 显示错误提示
  if (showMessage) {
    const displayMessage = customMessage || apiError.message
    message[messageType](displayMessage)
  }

  // 记录错误日志（生产环境可上报到监控系统）
  if (import.meta.env.DEV) {
    console.error('[API Error]', {
      code: apiError.code,
      message: apiError.message,
      config: apiError.config,
      timestamp: apiError.timestamp
    })
  }

  return apiError
}

/**
 * 静默错误处理（不显示提示）
 */
export const handleApiErrorSilently = (error: unknown) => {
  return handleApiError(error, { showMessage: false })
}

/**
 * 批量请求错误处理
 */
export interface BatchErrorResult {
  successCount: number
  failedCount: number
  errors: Array<{ index: number; error: ApiError }>
}

export const handleBatchErrors = (
  results: Array<PromiseSettledResult<any>>
): BatchErrorResult => {
  const errors: Array<{ index: number; error: ApiError }> = []

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      errors.push({
        index,
        error: handleApiErrorSilently(result.reason)
      })
    }
  })

  return {
    successCount: results.filter(r => r.status === 'fulfilled').length,
    failedCount: errors.length,
    errors
  }
}
```

### 4.4 重试机制

```typescript
// api/retry.ts

import type { AxiosError, AxiosRequestConfig } from 'axios'
import { apiClient } from './client'
import { ErrorCode } from './constants'

/**
 * 重试配置
 */
export interface RetryConfig {
  /** 最大重试次数，默认 3 */
  maxRetries?: number
  /** 重试延迟（毫秒），默认 1000 */
  retryDelay?: number
  /** 是否使用指数退避，默认 true */
  useExponentialBackoff?: boolean
  /** 哪些状态码需要重试，默认 [408, 429, 500, 502, 503, 504] */
  retryStatusCodes?: number[]
  /** 哪些错误码需要重试 */
  retryCodes?: number[]
}

const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  retryDelay: 1000,
  useExponentialBackoff: true,
  retryStatusCodes: [408, 429, 500, 502, 503, 504],
  retryCodes: [ErrorCode.SERVICE_UNAVAILABLE, ErrorCode.SERVICE_BUSY]
}

/**
 * 计算重试延迟
 */
const calculateRetryDelay = (
  attempt: number,
  config: Required<RetryConfig>
): number => {
  if (config.useExponentialBackoff) {
    // 指数退避：1s, 2s, 4s, 8s...
    return config.retryDelay * Math.pow(2, attempt)
  }
  return config.retryDelay
}

/**
 * 是否需要重试
 */
const shouldRetry = (error: AxiosError, config: Required<RetryConfig>): boolean => {
  const { response } = error

  if (response) {
    // 检查状态码
    if (config.retryStatusCodes.includes(response.status)) {
      return true
    }

    // 检查业务错误码
    const errorCode = response.data?.code
    if (errorCode && config.retryCodes.includes(errorCode)) {
      return true
    }
  }

  // 网络错误也重试
  if (!response) {
    return true
  }

  return false
}

/**
 * 带重试的请求封装
 */
export const requestWithRetry = async <T = any>(
  config: AxiosRequestConfig,
  retryConfig: RetryConfig = {}
): Promise<T> => {
  const config = { ...DEFAULT_RETRY_CONFIG, ...retryConfig }
  let lastError: AxiosError | null = null

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await apiClient.get<T>(config.url!, config)
      return response.data
    } catch (error) {
      lastError = error as AxiosError

      if (!shouldRetry(lastError, config) || attempt === config.maxRetries) {
        throw error
      }

      // 等待后重试
      const delay = calculateRetryDelay(attempt, config)
      console.log(`[API] 重试 ${attempt + 1}/${config.maxRetries}, 延迟 ${delay}ms`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

/**
 * 为 Axios 实例添加重试拦截器
 */
export const setupRetryInterceptor = (retryConfig: RetryConfig = {}) => {
  const config = { ...DEFAULT_RETRY_CONFIG, ...retryConfig }
  const retryCounts = new WeakMap()

  apiClient.interceptors.response.use(
    response => response,
    async error => {
      const { config: requestConfig } = error
      if (!requestConfig) {
        return Promise.reject(error)
      }

      const currentRetryCount = retryCounts.get(requestConfig) || 0

      if (!shouldRetry(error, config) || currentRetryCount >= config.maxRetries) {
        return Promise.reject(error)
      }

      retryCounts.set(requestConfig, currentRetryCount + 1)

      const delay = calculateRetryDelay(currentRetryCount, config)
      console.log(`[API] 自动重试 ${currentRetryCount + 1}/${config.maxRetries}`)

      await new Promise(resolve => setTimeout(resolve, delay))
      return apiClient(requestConfig)
    }
  )
}
```

---

## 五、认证集成

### 5.1 认证状态管理

```typescript
// api/auth.ts

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { apiClient } from './client'
import type { UserInfo, UserRole } from './types'

/**
 * 登录请求参数
 */
export interface LoginRequest {
  username: string
  password: string
  remember?: boolean
  captcha?: string
}

/**
 * 登录响应
 */
export interface LoginResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: 'Bearer'
  userInfo: UserInfo
}

/**
 * Token 刷新响应
 */
export interface RefreshTokenResponse {
  accessToken: string
  expiresIn: number
}

/**
 * 认证状态
 */
interface AuthState {
  /** 是否已认证 */
  isAuthenticated: boolean
  /** 当前用户信息 */
  userInfo: UserInfo | null
  /** Access Token */
  accessToken: string | null
  /** 是否正在刷新 Token */
  isRefreshing: boolean
  /** 登录 */
  login: (credentials: LoginRequest) => Promise<LoginResponse>
  /** 登出 */
  logout: () => Promise<void>
  /** 刷新 Token */
  refreshToken: () => Promise<void>
  /** 清除认证状态 */
  clearAuth: () => void
}

/**
 * 创建认证 Store
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      userInfo: null,
      accessToken: null,
      isRefreshing: false,

      login: async (credentials) => {
        const response = await apiClient.post<ApiResponse<LoginResponse>>(
          '/auth/login',
          credentials
        )
        const { data } = response

        set({
          isAuthenticated: true,
          userInfo: data.data.userInfo,
          accessToken: data.data.accessToken
        })

        // 存储 Token 到 localStorage
        localStorage.setItem('auth_token', data.data.accessToken)
        localStorage.setItem('refresh_token', data.data.refreshToken)

        return data.data
      },

      logout: async () => {
        try {
          // 通知服务端失效 Token
          await apiClient.post('/auth/logout')
        } catch (error) {
          console.error('[Auth] Logout error:', error)
        } finally {
          get().clearAuth()
        }
      },

      refreshToken: async () => {
        const refreshToken = localStorage.getItem('refresh_token')
        if (!refreshToken) {
          throw new Error('No refresh token available')
        }

        set({ isRefreshing: true })

        try {
          const response = await apiClient.post<ApiResponse<RefreshTokenResponse>>(
            '/auth/refresh',
            { refreshToken }
          )
          const { data } = response

          set({
            accessToken: data.data.accessToken,
            isRefreshing: false
          })

          localStorage.setItem('auth_token', data.data.accessToken)

          return data.data
        } catch (error) {
          set({ isRefreshing: false })
          throw error
        }
      },

      clearAuth: () => {
        set({
          isAuthenticated: false,
          userInfo: null,
          accessToken: null,
          isRefreshing: false
        })

        localStorage.removeItem('auth_token')
        localStorage.removeItem('refresh_token')

        // 跳转到登录页
        redirectToLogin()
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        userInfo: state.userInfo,
        accessToken: state.accessToken
      })
    }
  )
)

/**
 * 处理认证错误
 */
export const handleAuthError = () => {
  useAuthStore.getState().clearAuth()
}

/**
 * 处理 Token 刷新
 */
export const handleTokenRefresh = async (): Promise<boolean> => {
  try {
    await useAuthStore.getState().refreshToken()
    return true
  } catch (error) {
    console.error('[Auth] Token refresh failed:', error)
    return false
  }
}

/**
 * 跳转到登录页
 */
const redirectToLogin = () => {
  const currentPath = window.location.pathname + window.location.search
  window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`
}

/**
 * 获取当前 Token
 */
export const getCurrentToken = (): string | null => {
  return useAuthStore.getState().accessToken
}

/**
 * 获取当前用户
 */
export const getCurrentUser = (): UserInfo | null => {
  return useAuthStore.getState().userInfo
}

/**
 * 检查用户角色
 */
export const hasRole = (roles: UserRole | UserRole[]): boolean => {
  const user = getCurrentUser()
  if (!user) return false

  const roleList = Array.isArray(roles) ? roles : [roles]
  return roleList.includes(user.role)
}

/**
 * 检查权限
 */
export const hasPermission = (permission: string): boolean => {
  const user = getCurrentUser()
  if (!user) return false

  // 管理员拥有所有权限
  if (user.role === UserRole.ADMIN) return true

  // 这里可以根据用户角色和权限配置进行更细粒度的检查
  // 例如：检查 user.permissions 是否包含指定权限
  return false
}
```

### 5.2 401/403 统一处理

```typescript
// api/auth-handler.ts

import { notification } from 'antd'
import { useAuthStore } from './auth'
import { ErrorCode } from './constants'

/**
 * 登录态过期重定向配置
 */
interface AuthRedirectOptions {
  /** 是否显示提示，默认 true */
  showMessage?: boolean
  /** 自定义提示消息 */
  message?: string
  /** 重定向地址，默认 /login */
  redirectPath?: string
}

/**
 * 处理 401 未认证
 */
export const handle401 = (options: AuthRedirectOptions = {}) => {
  const {
    showMessage = true,
    message = '登录已过期，请重新登录',
    redirectPath = '/login'
  } = options

  if (showMessage) {
    notification.warning({
      message: '登录已过期',
      description: message,
      duration: 2
    })
  }

  // 清除认证状态并跳转
  useAuthStore.getState().clearAuth()

  // 保存当前页面，登录后返回
  const redirect = encodeURIComponent(window.location.href)
  window.location.href = `${redirectPath}?redirect=${redirect}`
}

/**
 * 处理 403 无权限
 */
export const handle403 = (options: { showMessage?: boolean; message?: string } = {}) => {
  const { showMessage = true, message = '抱歉，您没有权限访问此资源' } = options

  if (showMessage) {
    notification.error({
      message: '无权限访问',
      description: message,
      duration: 3
    })
  }

  // 可选：记录权限违规日志
  console.warn('[Permission Denied]', {
    user: useAuthStore.getState().userInfo,
    path: window.location.pathname,
    timestamp: new Date().toISOString()
  })
}

/**
 * Token 刷新队列（避免并发刷新）
 */
let refreshQueue: Array<() => void> = []
let isRefreshing = false

/**
 * 执行 Token 刷新（带队列）
 */
export const executeTokenRefresh = async (): Promise<string | null> => {
  return new Promise((resolve) => {
    if (!isRefreshing) {
      isRefreshing = true

      useAuthStore.getState()
        .refreshToken()
        .then((data) => {
          // 执行队列中的所有回调
          refreshQueue.forEach((cb) => cb())
          refreshQueue = []
          resolve(data?.accessToken || null)
        })
        .catch(() => {
          handle401()
          resolve(null)
        })
        .finally(() => {
          isRefreshing = false
        })
    } else {
      // 加入队列
      refreshQueue.push(() => {
        const token = useAuthStore.getState().accessToken
        resolve(token)
      })
    }
  })
}
```

---

## 六、业务模块 API

### 6.1 流水线模块

```typescript
// api/modules/pipeline.ts

import { apiClient } from '../client'
import type {
  ApiResponse,
  BaseEntity,
  PaginationRequest,
  PaginationResponse,
  Status
} from '../types'

/**
 * 流水线实体
 */
export interface Pipeline extends BaseEntity {
  name: string
  description?: string
  productLine: string
  status: 'active' | 'inactive' | 'deleted'
  stages: PipelineStage[]
  triggers: TriggerConfig[]
  lastRun?: PipelineRun
  statistics: PipelineStatistics
}

/**
 * 流水线阶段
 */
export interface PipelineStage {
  name: string
  type: 'build' | 'test' | 'scan' | 'approve' | 'deploy'
  config: Record<string, any>
  timeout?: number
  retryPolicy?: RetryPolicy
}

/**
 * 重试策略
 */
export interface RetryPolicy {
  maxRetries: number
  retryDelay: number
  retryConditions: string[]
}

/**
 * 触发器配置
 */
export interface TriggerConfig {
  type: 'manual' | 'schedule' | 'webhook' | 'code_push'
  enabled: boolean
  config: Record<string, any>
}

/**
 * 流水线统计
 */
export interface PipelineStatistics {
  totalRuns: number
  successRate: number
  avgDuration: number
  lastWeekRuns: number
}

/**
 * 流水线运行记录
 */
export interface PipelineRun extends BaseEntity {
  pipelineId: string
  triggerType: string
  triggerBy: string
  status: Status
  stages: StageRun[]
  duration: number
  errorMessage?: string
}

/**
 * 阶段运行记录
 */
export interface StageRun {
  name: string
  status: Status
  startTime?: string
  endTime?: string
  duration?: number
  errorMessage?: string
  retryCount: number
}

/**
 * 创建流水线请求
 */
export interface CreatePipelineRequest {
  name: string
  description?: string
  productLine: string
  stages: PipelineStage[]
  triggers?: TriggerConfig[]
}

/**
 * 更新流水线请求
 */
export interface UpdatePipelineRequest {
  name?: string
  description?: string
  productLine?: string
  stages?: PipelineStage[]
  triggers?: TriggerConfig[]
  status?: 'active' | 'inactive' | 'deleted'
}

/**
 * 触发流水线请求
 */
export interface TriggerPipelineRequest {
  branch?: string
  variables?: Record<string, string>
  skipStages?: string[]
}

/**
 * 获取流水线列表
 */
export const getPipelines = (params: PaginationRequest & {
  productLine?: string
  status?: string
  keyword?: string
}) => {
  return apiClient.get<ApiResponse<PaginationResponse<Pipeline>>>('/pipelines', { params })
}

/**
 * 获取流水线详情
 */
export const getPipeline = (id: string) => {
  return apiClient.get<ApiResponse<Pipeline>>(`/pipelines/${id}`)
}

/**
 * 创建流水线
 */
export const createPipeline = (data: CreatePipelineRequest) => {
  return apiClient.post<ApiResponse<Pipeline>>('/pipelines', data)
}

/**
 * 更新流水线
 */
export const updatePipeline = (id: string, data: UpdatePipelineRequest) => {
  return apiClient.put<ApiResponse<Pipeline>>(`/pipelines/${id}`, data)
}

/**
 * 删除流水线
 */
export const deletePipeline = (id: string) => {
  return apiClient.delete<ApiResponse>(`/pipelines/${id}`)
}

/**
 * 触发流水线运行
 */
export const triggerPipeline = (id: string, data: TriggerPipelineRequest) => {
  return apiClient.post<ApiResponse<PipelineRun>>(`/pipelines/${id}/run`, data)
}

/**
 * 获取运行历史
 */
export const getPipelineRuns = (
  pipelineId: string,
  params: PaginationRequest & { status?: Status }
) => {
  return apiClient.get<ApiResponse<PaginationResponse<PipelineRun>>>(
    `/pipelines/${pipelineId}/runs`,
    { params }
  )
}

/**
 * 获取运行详情
 */
export const getPipelineRun = (pipelineId: string, runId: string) => {
  return apiClient.get<ApiResponse<PipelineRun>>(`/pipelines/${pipelineId}/runs/${runId}`)
}

/**
 * 停止运行
 */
export const stopPipelineRun = (pipelineId: string, runId: string) => {
  return apiClient.post<ApiResponse<PipelineRun>>(`/pipelines/${pipelineId}/runs/${runId}/stop`)
}

/**
 * 重试运行
 */
export const retryPipelineRun = (pipelineId: string, runId: string) => {
  return apiClient.post<ApiResponse<PipelineRun>>(`/pipelines/${pipelineId}/runs/${runId}/retry`)
}

/**
 * 获取阶段日志
 */
export const getStageLogs = (
  pipelineId: string,
  runId: string,
  stageName: string,
  params?: { tail?: number; cursor?: string }
) => {
  return apiClient.get<ApiResponse<{ logs: string; nextCursor?: string }>>(
    `/pipelines/${pipelineId}/runs/${runId}/stages/${stageName}/logs`,
    { params }
  )
}
```

### 6.2 审批模块

```typescript
// api/modules/approval.ts

import { apiClient } from '../client'
import type { ApiResponse, BaseEntity, PaginationRequest, PaginationResponse, UserInfo } from '../types'

/**
 * 审批类型
 */
export enum ApprovalType {
  DEPLOYMENT = 'deployment',
  PRODUCTION_CHANGE = 'production_change',
  RESOURCE_ACCESS = 'resource_access',
  CUSTOM = 'custom'
}

/**
 * 审批状态
 */
export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  TRANSFERRED = 'transferred'
}

/**
 * 审批实体
 */
export interface Approval extends BaseEntity {
  title: string
  description?: string
  type: ApprovalType
  status: ApprovalStatus
  applicant: UserInfo
  approvers: Approver[]
  resourceType: string
  resourceId: string
  currentStep: number
  totalSteps: number
  minApprovals: number
  approvedCount: number
  comment?: string
}

/**
 * 审批人
 */
export interface Approver {
  id: string
  user: UserInfo
  status: ApprovalStatus
  comment?: string
  actedAt?: string
  order: number
}

/**
 * 创建审批请求
 */
export interface CreateApprovalRequest {
  title: string
  description?: string
  type: ApprovalType
  resourceType: string
  resourceId: string
  approverIds: string[]
  minApprovals?: number
}

/**
 * 审批通过请求
 */
export interface ApproveRequest {
  comment?: string
}

/**
 * 审批拒绝请求
 */
export interface RejectRequest {
  reason: string
}

/**
 * 审批转交请求
 */
export interface TransferRequest {
  toUserId: string
  reason: string
}

/**
 * 批量审批请求
 */
export interface BatchApproveRequest {
  approvalIds: string[]
  comment?: string
}

/**
 * 获取审批列表
 */
export const getApprovals = (params: PaginationRequest & {
  status?: ApprovalStatus
  type?: ApprovalType
  keyword?: string
}) => {
  return apiClient.get<ApiResponse<PaginationResponse<Approval>>>('/approvals', { params })
}

/**
 * 获取审批详情
 */
export const getApproval = (id: string) => {
  return apiClient.get<ApiResponse<Approval>>(`/approvals/${id}`)
}

/**
 * 创建审批
 */
export const createApproval = (data: CreateApprovalRequest) => {
  return apiClient.post<ApiResponse<Approval>>('/approvals', data)
}

/**
 * 审批通过
 */
export const approveApproval = (id: string, data: ApproveRequest = {}) => {
  return apiClient.post<ApiResponse<Approval>>(`/approvals/${id}/approve`, data)
}

/**
 * 审批拒绝
 */
export const rejectApproval = (id: string, data: RejectRequest) => {
  return apiClient.post<ApiResponse<Approval>>(`/approvals/${id}/reject`, data)
}

/**
 * 审批转交
 */
export const transferApproval = (id: string, data: TransferRequest) => {
  return apiClient.post<ApiResponse<Approval>>(`/approvals/${id}/transfer`, data)
}

/**
 * 取消审批
 */
export const cancelApproval = (id: string) => {
  return apiClient.post<ApiResponse<Approval>>(`/approvals/${id}/cancel`)
}

/**
 * 批量审批
 */
export const batchApprove = (data: BatchApproveRequest) => {
  return apiClient.post<ApiResponse<{ successCount: number; failedCount: number }>>(
    '/approvals/batch-approve',
    data
  )
}

/**
 * 获取我的待办
 */
export const getMyTodos = (params?: PaginationRequest) => {
  return apiClient.get<ApiResponse<PaginationResponse<Approval>>>('/approvals/my-todos', { params })
}

/**
 * 获取我的申请
 */
export const getMyRequests = (params: PaginationRequest & { status?: ApprovalStatus }) => {
  return apiClient.get<ApiResponse<PaginationResponse<Approval>>>('/approvals/my-requests', { params })
}
```

### 6.3 部署模块

```typescript
// api/modules/deployment.ts

import { apiClient } from '../client'
import type { ApiResponse, BaseEntity, PaginationRequest, PaginationResponse, Status } from '../types'

/**
 * 部署类型
 */
export enum DeploymentType {
  ROLLING = 'rolling',
  BLUE_GREEN = 'blue_green',
  CANARY = 'canary'
}

/**
 * 部署目标
 */
export enum DeploymentTarget {
  DEV = 'dev',
  TEST = 'test',
  STAGING = 'staging',
  PRODUCTION = 'production'
}

/**
 * 部署实体
 */
export interface Deployment extends BaseEntity {
  name: string
  type: DeploymentType
  target: DeploymentTarget
  status: Status
  pipelineId: string
  pipelineRunId: string
  artifactId: string
  version: string
  progress: DeploymentProgress
  deployedBy: string
  approvedBy?: string
  errorMessage?: string
}

/**
 * 部署进度
 */
export interface DeploymentProgress {
  total: number
  current: number
  percentage: number
  currentStep: string
  details: DeploymentStep[]
}

/**
 * 部署步骤
 */
export interface DeploymentStep {
  name: string
  status: Status
  startedAt?: string
  completedAt?: string
  message?: string
}

/**
 * 创建部署请求
 */
export interface CreateDeploymentRequest {
  pipelineRunId: string
  target: DeploymentTarget
  type?: DeploymentType
  config?: Record<string, any>
}

/**
 * 回滚请求
 */
export interface RollbackRequest {
  targetVersion: string
  reason?: string
}

/**
 * 获取部署列表
 */
export const getDeployments = (params: PaginationRequest & {
  target?: DeploymentTarget
  status?: Status
  keyword?: string
}) => {
  return apiClient.get<ApiResponse<PaginationResponse<Deployment>>>('/deployments', { params })
}

/**
 * 获取部署详情
 */
export const getDeployment = (id: string) => {
  return apiClient.get<ApiResponse<Deployment>>(`/deployments/${id}`)
}

/**
 * 创建部署
 */
export const createDeployment = (data: CreateDeploymentRequest) => {
  return apiClient.post<ApiResponse<Deployment>>('/deployments', data)
}

/**
 * 获取部署进度
 */
export const getDeploymentProgress = (id: string) => {
  return apiClient.get<ApiResponse<DeploymentProgress>>(`/deployments/${id}/progress`)
}

/**
 * 暂停部署
 */
export const pauseDeployment = (id: string) => {
  return apiClient.post<ApiResponse<Deployment>>(`/deployments/${id}/pause`)
}

/**
 * 恢复部署
 */
export const resumeDeployment = (id: string) => {
  return apiClient.post<ApiResponse<Deployment>>(`/deployments/${id}/resume`)
}

/**
 * 回滚部署
 */
export const rollbackDeployment = (id: string, data: RollbackRequest) => {
  return apiClient.post<ApiResponse<Deployment>>(`/deployments/${id}/rollback`, data)
}

/**
 * 获取部署历史
 */
export const getDeploymentHistory = (
  resourceId: string,
  params?: PaginationRequest
) => {
  return apiClient.get<ApiResponse<PaginationResponse<Deployment>>>(
    `/deployments/history/${resourceId}`,
    { params }
  )
}
```

### 6.4 通知模块

```typescript
// api/modules/notification.ts

import { apiClient } from '../client'
import type { ApiResponse, BaseEntity, PaginationRequest, PaginationResponse } from '../types'

/**
 * 通知类型
 */
export enum NotificationType {
  PIPELINE = 'pipeline',
  APPROVAL = 'approval',
  DEPLOYMENT = 'deployment',
  ALERT = 'alert',
  SYSTEM = 'system'
}

/**
 * 通知级别
 */
export enum NotificationLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

/**
 * 通知实体
 */
export interface Notification extends BaseEntity {
  title: string
  content: string
  type: NotificationType
  level: NotificationLevel
  isRead: boolean
  readAt?: string
  actionUrl?: string
  actionText?: string
  extra?: Record<string, any>
}

/**
 * 通知设置
 */
export interface NotificationSettings {
  emailEnabled: boolean
  smsEnabled: boolean
  pushEnabled: boolean
  soundEnabled: boolean
  dndEnabled: boolean
  dndStart?: string
  dndEnd?: string
  subscribedTypes: NotificationType[]
}

/**
 * 免打扰设置
 */
export interface DNDSettings {
  enabled: boolean
  startTime: string
  endTime: string
  days: number[]
}

/**
 * 获取通知列表
 */
export const getNotifications = (params: PaginationRequest & {
  isRead?: boolean
  type?: NotificationType
  level?: NotificationLevel
}) => {
  return apiClient.get<ApiResponse<PaginationResponse<Notification>>>('/notifications', { params })
}

/**
 * 获取通知详情
 */
export const getNotification = (id: string) => {
  return apiClient.get<ApiResponse<Notification>>(`/notifications/${id}`)
}

/**
 * 标记已读
 */
export const markAsRead = (id: string) => {
  return apiClient.post<ApiResponse<Notification>>(`/notifications/${id}/read`)
}

/**
 * 批量标记已读
 */
export const markAllAsRead = (params?: { before?: string }) => {
  return apiClient.post<ApiResponse<{ count: number }>>('/notifications/read-all', params)
}

/**
 * 删除通知
 */
export const deleteNotification = (id: string) => {
  return apiClient.delete<ApiResponse>(`/notifications/${id}`)
}

/**
 * 获取未读数量
 */
export const getUnreadCount = () => {
  return apiClient.get<ApiResponse<{ count: number }>>('/notifications/unread-count')
}

/**
 * 获取通知设置
 */
export const getNotificationSettings = () => {
  return apiClient.get<ApiResponse<NotificationSettings>>('/notifications/settings')
}

/**
 * 更新通知设置
 */
export const updateNotificationSettings = (data: Partial<NotificationSettings>) => {
  return apiClient.put<ApiResponse<NotificationSettings>>('/notifications/settings', data)
}

/**
 * 获取免打扰设置
 */
export const getDNDSettings = () => {
  return apiClient.get<ApiResponse<DNDSettings>>('/notifications/dnd')
}

/**
 * 更新免打扰设置
 */
export const updateDNDSettings = (data: DNDSettings) => {
  return apiClient.put<ApiResponse<DNDSettings>>('/notifications/dnd', data)
}
```

---

## 七、React Hooks 封装

### 7.1 usePipeline Hook

```typescript
// api/hooks/usePipeline.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getPipelines,
  getPipeline,
  createPipeline,
  updatePipeline,
  deletePipeline,
  triggerPipeline,
  getPipelineRuns,
  getPipelineRun,
  stopPipelineRun,
  retryPipelineRun,
  type CreatePipelineRequest,
  type UpdatePipelineRequest,
  type TriggerPipelineRequest
} from '../modules/pipeline'
import { handleApiError } from '../error'

/**
 * 查询参数类型
 */
interface PipelineListParams {
  productLine?: string
  status?: string
  keyword?: string
  page?: number
  pageSize?: number
}

/**
 * 获取流水线列表
 */
export const usePipelines = (params: PipelineListParams = {}) => {
  return useQuery({
    queryKey: ['pipelines', params],
    queryFn: () => getPipelines(params).then(res => res.data),
    staleTime: 30 * 1000, // 30 秒
    select: (data) => data.data
  })
}

/**
 * 获取流水线详情
 */
export const usePipeline = (id: string) => {
  return useQuery({
    queryKey: ['pipeline', id],
    queryFn: () => getPipeline(id).then(res => res.data),
    enabled: !!id,
    staleTime: 10 * 1000,
    select: (data) => data.data
  })
}

/**
 * 创建流水线
 */
export const useCreatePipeline = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreatePipelineRequest) => createPipeline(data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] })
    },
    onError: (error) => {
      handleApiError(error)
    }
  })
}

/**
 * 更新流水线
 */
export const useUpdatePipeline = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePipelineRequest }) =>
      updatePipeline(id, data).then(res => res.data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', id] })
      queryClient.invalidateQueries({ queryKey: ['pipelines'] })
    },
    onError: (error) => {
      handleApiError(error)
    }
  })
}

/**
 * 删除流水线
 */
export const useDeletePipeline = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deletePipeline(id).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] })
    },
    onError: (error) => {
      handleApiError(error)
    }
  })
}

/**
 * 触发流水线
 */
export const useTriggerPipeline = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TriggerPipelineRequest }) =>
      triggerPipeline(id, data).then(res => res.data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', id] })
    },
    onError: (error) => {
      handleApiError(error)
    }
  })
}

/**
 * 获取运行历史
 */
export const usePipelineRuns = (pipelineId: string, params = {}) => {
  return useQuery({
    queryKey: ['pipeline-runs', pipelineId, params],
    queryFn: () => getPipelineRuns(pipelineId, params).then(res => res.data),
    enabled: !!pipelineId,
    staleTime: 5 * 1000,
    select: (data) => data.data
  })
}

/**
 * 获取运行详情
 */
export const usePipelineRun = (pipelineId: string, runId: string) => {
  return useQuery({
    queryKey: ['pipeline-run', pipelineId, runId],
    queryFn: () => getPipelineRun(pipelineId, runId).then(res => res.data),
    enabled: !!pipelineId && !!runId,
    staleTime: 3 * 1000, // 实时性要求高
    select: (data) => data.data
  })
}

/**
 * 停止运行
 */
export const useStopPipelineRun = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ pipelineId, runId }: { pipelineId: string; runId: string }) =>
      stopPipelineRun(pipelineId, runId).then(res => res.data),
    onSuccess: (_, { pipelineId, runId }) => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-run', pipelineId, runId] })
      queryClient.invalidateQueries({ queryKey: ['pipeline-runs', pipelineId] })
    },
    onError: (error) => {
      handleApiError(error)
    }
  })
}

/**
 * 重试运行
 */
export const useRetryPipelineRun = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ pipelineId, runId }: { pipelineId: string; runId: string }) =>
      retryPipelineRun(pipelineId, runId).then(res => res.data),
    onSuccess: (_, { pipelineId, runId }) => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-run', pipelineId, runId] })
      queryClient.invalidateQueries({ queryKey: ['pipeline-runs', pipelineId] })
    },
    onError: (error) => {
      handleApiError(error)
    }
  })
}
```

### 7.2 useApproval Hook

```typescript
// api/hooks/useApproval.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getApprovals,
  getApproval,
  createApproval,
  approveApproval,
  rejectApproval,
  transferApproval,
  cancelApproval,
  batchApprove,
  getMyTodos,
  getMyRequests,
  type CreateApprovalRequest,
  type ApproveRequest,
  type RejectRequest,
  type TransferRequest,
  ApprovalStatus
} from '../modules/approval'
import { handleApiError } from '../error'

/**
 * 获取审批列表
 */
export const useApprovals = (params = {}) => {
  return useQuery({
    queryKey: ['approvals', params],
    queryFn: () => getApprovals(params).then(res => res.data),
    staleTime: 30 * 1000,
    select: (data) => data.data
  })
}

/**
 * 获取审批详情
 */
export const useApproval = (id: string) => {
  return useQuery({
    queryKey: ['approval', id],
    queryFn: () => getApproval(id).then(res => res.data),
    enabled: !!id,
    staleTime: 10 * 1000,
    select: (data) => data.data
  })
}

/**
 * 创建审批
 */
export const useCreateApproval = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateApprovalRequest) => createApproval(data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
      queryClient.invalidateQueries({ queryKey: ['my-requests'] })
    },
    onError: (error) => {
      handleApiError(error)
    }
  })
}

/**
 * 审批通过
 */
export const useApprove = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: ApproveRequest }) =>
      approveApproval(id, data).then(res => res.data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['approval', id] })
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
      queryClient.invalidateQueries({ queryKey: ['my-todos'] })
    },
    onError: (error) => {
      handleApiError(error)
    }
  })
}

/**
 * 审批拒绝
 */
export const useReject = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: RejectRequest }) =>
      rejectApproval(id, data).then(res => res.data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['approval', id] })
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
      queryClient.invalidateQueries({ queryKey: ['my-todos'] })
    },
    onError: (error) => {
      handleApiError(error)
    }
  })
}

/**
 * 审批转交
 */
export const useTransfer = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TransferRequest }) =>
      transferApproval(id, data).then(res => res.data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['approval', id] })
      queryClient.invalidateQueries({ queryKey: ['my-todos'] })
    },
    onError: (error) => {
      handleApiError(error)
    }
  })
}

/**
 * 取消审批
 */
export const useCancelApproval = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => cancelApproval(id).then(res => res.data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['approval', id] })
      queryClient.invalidateQueries({ queryKey: ['my-requests'] })
    },
    onError: (error) => {
      handleApiError(error)
    }
  })
}

/**
 * 批量审批
 */
export const useBatchApprove = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { approvalIds: string[]; comment?: string }) =>
      batchApprove(data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
      queryClient.invalidateQueries({ queryKey: ['my-todos'] })
    },
    onError: (error) => {
      handleApiError(error)
    }
  })
}

/**
 * 获取我的待办
 */
export const useMyTodos = (params = {}) => {
  return useQuery({
    queryKey: ['my-todos', params],
    queryFn: () => getMyTodos(params).then(res => res.data),
    staleTime: 30 * 1000,
    select: (data) => data.data
  })
}

/**
 * 获取我的申请
 */
export const useMyRequests = (params: { status?: ApprovalStatus } = {}) => {
  return useQuery({
    queryKey: ['my-requests', params],
    queryFn: () => getMyRequests(params).then(res => res.data),
    staleTime: 30 * 1000,
    select: (data) => data.data
  })
}
```

### 7.3 useNotification Hook

```typescript
// api/hooks/useNotification.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount,
  getNotificationSettings,
  updateNotificationSettings,
  type NotificationSettings
} from '../modules/notification'
import { handleApiError } from '../error'

/**
 * 获取通知列表
 */
export const useNotifications = (params = {}) => {
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: () => getNotifications(params).then(res => res.data),
    staleTime: 30 * 1000,
    select: (data) => data.data
  })
}

/**
 * 获取未读数量
 */
export const useUnreadCount = () => {
  return useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () => getUnreadCount().then(res => res.data),
    staleTime: 10 * 1000,
    select: (data) => data.data.count
  })
}

/**
 * 标记已读
 */
export const useMarkAsRead = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => markAsRead(id).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] })
    },
    onError: (error) => {
      handleApiError(error)
    }
  })
}

/**
 * 批量标记已读
 */
export const useMarkAllAsRead = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params?: { before?: string }) => markAllAsRead(params).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] })
    },
    onError: (error) => {
      handleApiError(error)
    }
  })
}

/**
 * 删除通知
 */
export const useDeleteNotification = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteNotification(id).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] })
    },
    onError: (error) => {
      handleApiError(error)
    }
  })
}

/**
 * 获取通知设置
 */
export const useNotificationSettings = () => {
  return useQuery({
    queryKey: ['notification-settings'],
    queryFn: () => getNotificationSettings().then(res => res.data),
    staleTime: 60 * 1000,
    select: (data) => data.data
  })
}

/**
 * 更新通知设置
 */
export const useUpdateNotificationSettings = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Partial<NotificationSettings>) =>
      updateNotificationSettings(data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-settings'] })
    },
    onError: (error) => {
      handleApiError(error)
    }
  })
}
```

---

## 八、使用示例

### 8.1 基础使用

```typescript
// pages/PipelineList.tsx

import React, { useState } from 'react'
import {
  usePipelines,
  useDeletePipeline,
  useTriggerPipeline
} from '@/api/hooks/usePipeline'
import { PipelineCard } from '@/components/PipelineCard'
import { Button, Pagination, Spin, Empty } from 'antd'

export const PipelineList: React.FC = () => {
  const [page, setPage] = useState(1)
  const pageSize = 20

  const { data, isLoading, error } = usePipelines({ page, pageSize })
  const deletePipeline = useDeletePipeline()
  const triggerPipeline = useTriggerPipeline()

  if (isLoading) return <Spin />
  if (error) return <Empty description="加载失败" />
  if (!data?.items.length) return <Empty description="暂无流水线" />

  return (
    <div>
      <div className="grid gap-4">
        {data.items.map((pipeline) => (
          <PipelineCard
            key={pipeline.id}
            id={pipeline.id}
            name={pipeline.name}
            productLine={pipeline.productLine}
            status={pipeline.status}
            lastRun={pipeline.lastRun}
            statistics={pipeline.statistics}
            onRun={() => triggerPipeline.mutate({ id: pipeline.id, data: {} })}
            onEdit={() => {/* 跳转编辑 */}}
            onView={() => {/* 跳转详情 */}}
            onDelete={() => deletePipeline.mutate(pipeline.id)}
          />
        ))}
      </div>

      <Pagination
        className="mt-4 flex justify-center"
        current={page}
        pageSize={pageSize}
        total={data.pagination.total}
        onChange={setPage}
      />
    </div>
  )
}
```

### 8.2 审批操作示例

```typescript
// components/ApprovalActions.tsx

import React, { useState } from 'react'
import { useApprove, useReject } from '@/api/hooks/useApproval'
import { Button, Modal, Input, Space } from 'antd'

interface ApprovalActionsProps {
  approvalId: string
  onSuccess?: () => void
}

export const ApprovalActions: React.FC<ApprovalActionsProps> = ({
  approvalId,
  onSuccess
}) => {
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [comment, setComment] = useState('')
  const [reason, setReason] = useState('')

  const approve = useApprove()
  const reject = useReject()

  const handleApprove = async () => {
    await approve.mutateAsync({ id: approvalId, data: { comment } })
    setShowApproveModal(false)
    setComment('')
    onSuccess?.()
  }

  const handleReject = async () => {
    await reject.mutateAsync({ id: approvalId, data: { reason } })
    setShowRejectModal(false)
    setReason('')
    onSuccess?.()
  }

  return (
    <>
      <Space>
        <Button type="primary" onClick={() => setShowApproveModal(true)}>
          审批通过
        </Button>
        <Button danger onClick={() => setShowRejectModal(true)}>
          拒绝
        </Button>
      </Space>

      <Modal
        title="审批通过"
        open={showApproveModal}
        onOk={handleApprove}
        onCancel={() => setShowApproveModal(false)}
      >
        <Input.TextArea
          placeholder="请输入审批意见（可选）"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
        />
      </Modal>

      <Modal
        title="拒绝审批"
        open={showRejectModal}
        onOk={handleReject}
        onCancel={() => setShowRejectModal(false)}
      >
        <Input.TextArea
          placeholder="请说明拒绝原因"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
        />
      </Modal>
    </>
  )
}
```

---

## 九、最佳实践

### 9.1 错误处理

```typescript
// 推荐：使用 Hook 的错误回调
const createPipeline = useCreatePipeline()
createPipeline.mutate(data, {
  onError: (error) => {
    // 自定义错误处理
    console.error('创建失败:', error)
  }
})

// 推荐：静默错误处理
try {
  await api.mutateAsync(data, { throwError: true })
} catch (error) {
  // 不显示默认提示，自行处理
  handleCustomError(error)
}
```

### 9.2 性能优化

```typescript
// 使用 select 只选择需要的数据
const { data } = usePipelines({
  select: (pipelines) => pipelines.items.map(p => ({ id: p.id, name: p.name }))
})

// 使用 placeholderData 显示缓存
const { data } = usePipeline(id, {
  placeholderData: (previousData) => previousData
})

// 预取数据
queryClient.prefetchQuery({
  queryKey: ['pipeline', id],
  queryFn: () => getPipeline(id)
})
```

### 9.3 实时数据

```typescript
// 轮询
const { data } = usePipelineRun(pipelineId, runId, {
  refetchInterval: 3000 // 3 秒轮询
})

// WebSocket 订阅
useEffect(() => {
  const ws = new WebSocket('wss://orion.internal/ws')
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data)
    queryClient.setQueryData(['pipeline-run', pipelineId, runId], data)
  }
  return () => ws.close()
}, [])
```

---

_文档版本：v1.0_  
_创建日期：2026-04-10_  
_状态：草稿，待评审_
