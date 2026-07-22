/**
 * ChatOps Error Types - 模块特定错误类型
 *
 * ARCH-006: 统一 ChatOps 模块的错误类型
 * ARCH-013: 继承全局 OrionError 类型系统
 *
 * - 所有错误继承自全局 OrionError
 * - 包含 code、recoverable、statusCode 等属性
 * - Controller 层统一处理错误响应
 */

import {
  ErrorCode,
  OrionError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ServiceUnavailableError,
  FallbackModeError,
  handleError,
  isRecoverable,
} from '../../errors';

// 导出全局错误类型供 ChatOps 模块使用
export {
  ErrorCode,
  OrionError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ServiceUnavailableError,
  FallbackModeError,
  handleError,
  isRecoverable,
};

/**
 * ChatOps 特定的错误代码
 * ARCH-013: 扩展全局 ErrorCode
 */
export enum ChatOpsErrorCode {
  // 命令相关
  UNKNOWN_COMMAND = 'UNKNOWN_COMMAND',
  COMMAND_NOT_FOUND = 'COMMAND_NOT_FOUND',
  COMMAND_DISABLED = 'COMMAND_DISABLED',

  // 执行相关
  EXECUTION_FAILED = 'EXECUTION_FAILED',
  EXECUTION_TIMEOUT = 'EXECUTION_TIMEOUT',

  // Webhook 相关
  WEBHOOK_VERIFICATION_FAILED = 'WEBHOOK_VERIFICATION_FAILED',
  WEBHOOK_SIGNATURE_INVALID = 'WEBHOOK_SIGNATURE_INVALID',

  // IM 平台相关
  IM_PLATFORM_UNAVAILABLE = 'IM_PLATFORM_UNAVAILABLE',
  IM_RATE_LIMITED = 'IM_RATE_LIMITED',
}

/**
 * ChatOps 特定错误类型
 */

/** 命令不存在错误 */
export class CommandNotFoundError extends OrionError {
  constructor(commandName: string) {
    super(
      `未知命令: ${commandName}。使用 /help 查看可用命令列表`,
      ErrorCode.NOT_FOUND,
      false,
      { commandName },
    );
    this.name = 'CommandNotFoundError';
  }
}

/** 命令禁用错误 */
export class CommandDisabledError extends OrionError {
  constructor(commandName: string, reason?: string) {
    super(
      `命令 ${commandName} 已禁用: ${reason || '请联系管理员'}`,
      ErrorCode.FORBIDDEN,
      false,
      { commandName, reason },
    );
    this.name = 'CommandDisabledError';
  }
}

/** Webhook 签名验证失败 */
export class WebhookVerificationError extends OrionError {
  constructor(platform: string, reason: string = '签名验证失败') {
    super(
      `Webhook 签名验证失败 (${platform}): ${reason}`,
      ErrorCode.FORBIDDEN,
      false,
      { platform, reason },
    );
    this.name = 'WebhookVerificationError';
  }
}

/** IM 平台不可用 */
export class IMPlatformError extends OrionError {
  constructor(platform: string, reason?: string) {
    super(
      `IM 平台 ${platform} 不可用: ${reason || '请稍后重试'}`,
      ErrorCode.SERVICE_UNAVAILABLE,
      true,  // 可恢复
      { platform, reason },
    );
    this.name = 'IMPlatformError';
  }
}