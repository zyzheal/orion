// 三级分层格式: LEVEL.CATEGORY.SEQUENCE
// LEVEL: SYS (系统级), CLIENT (客户端级), BIZ (业务级)

export const ErrorCodes = {
  // ========== 系统级错误 SYS.xxx ==========
  SYS_INTERNAL_ERROR: 'SYS.500.001',
  SYS_SERVICE_UNAVAILABLE: 'SYS.503.001',
  SYS_TIMEOUT: 'SYS.504.001',

  // ========== 客户端级错误 CLIENT.xxx ==========
  CLIENT_PARAM_INVALID: 'CLIENT.400.001',
  CLIENT_PARAM_MISSING: 'CLIENT.400.002',
  CLIENT_AUTH_EXPIRED: 'CLIENT.401.001',
  CLIENT_PERMISSION_DENIED: 'CLIENT.403.001',
  CLIENT_RESOURCE_NOT_FOUND: 'CLIENT.404.001',
  CLIENT_CONFLICT: 'CLIENT.409.001',
  CLIENT_RATE_LIMITED: 'CLIENT.429.001',

  // ========== 业务级错误 BIZ.{MODULE}.xxx ==========
  // 租户模块
  BIZ_TENANT_NOT_FOUND: 'BIZ.TENANT.001',
  BIZ_TENANT_NAME_EXISTS: 'BIZ.TENANT.002',
  BIZ_TENANT_QUOTA_EXCEEDED: 'BIZ.TENANT.003',
  BIZ_TENANT_STATUS_INVALID: 'BIZ.TENANT.004',

  // Pipeline 模块
  BIZ_PIPELINE_NOT_FOUND: 'BIZ.PIPELINE.001',
  BIZ_PIPELINE_RUN_FAILED: 'BIZ.PIPELINE.002',
  BIZ_PIPELINE_STAGE_NOT_FOUND: 'BIZ.PIPELINE.003',

  // 用户模块
  BIZ_USER_NOT_FOUND: 'BIZ.USER.001',
  BIZ_USER_EMAIL_EXISTS: 'BIZ.USER.002',

  // 认证模块
  BIZ_AUTH_TOKEN_INVALID: 'BIZ.AUTH.001',
  BIZ_AUTH_TOKEN_EXPIRED: 'BIZ.AUTH.002',

  // 通用业务错误
  BIZ_OPERATION_FAILED: 'BIZ.COMMON.001',
  BIZ_RESOURCE_CONFLICT: 'BIZ.COMMON.002',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

// 便捷工具函数
export function isClientError(code: ErrorCode): boolean {
  return code.startsWith('CLIENT.');
}

export function isSystemError(code: ErrorCode): boolean {
  return code.startsWith('SYS.');
}

export function isBusinessError(code: ErrorCode): boolean {
  return code.startsWith('BIZ.');
}