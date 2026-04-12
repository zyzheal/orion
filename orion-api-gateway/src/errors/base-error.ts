/**
 * 错误基类
 *
 * 所有应用错误都应继承此类，提供统一的错误处理基础
 */

export interface ErrorDetails {
  field?: string;
  reason?: string;
  [key: string]: any;
}

export interface ErrorMetadata {
  timestamp: string;
  requestId?: string;
  path?: string;
  method?: string;
}

export abstract class BaseError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: ErrorDetails;
  public readonly metadata: ErrorMetadata;
  public readonly category: ErrorCategory;

  constructor(
    code: string,
    message: string,
    statusCode: number,
    details?: ErrorDetails
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.metadata = {
      timestamp: new Date().toISOString(),
    };
    this.category = this.parseCategory(code);
  }

  /**
   * 解析错误码获取错误分类
   */
  private parseCategory(code: string): ErrorCategory {
    const categoryCode = parseInt(code.charAt(0), 10);
    switch (categoryCode) {
      case 1:
        return ErrorCategory.PLATFORM;
      case 2:
        return ErrorCategory.AUTH;
      case 3:
        return ErrorCategory.BUSINESS;
      case 4:
        return ErrorCategory.EXTERNAL;
      default:
        return ErrorCategory.UNKNOWN;
    }
  }

  /**
   * 转换为 JSON 响应格式
   */
  toJSON(requestId?: string, path?: string, method?: string): ErrorResponse {
    return {
      error: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      requestId,
      timestamp: this.metadata.timestamp,
      path,
      method,
    };
  }

  /**
   * 添加请求上下文信息
   */
  withContext(requestId: string, path: string, method: string): this {
    this.metadata.requestId = requestId;
    this.metadata.path = path;
    this.metadata.method = method;
    return this;
  }
}

export interface ErrorResponse {
  error: string;
  message: string;
  code: string;
  details?: ErrorDetails;
  requestId?: string;
  timestamp: string;
  path?: string;
  method?: string;
}

/**
 * 错误分类枚举
 */
export enum ErrorCategory {
  PLATFORM = 'PLATFORM',
  AUTH = 'AUTH',
  BUSINESS = 'BUSINESS',
  EXTERNAL = 'EXTERNAL',
  UNKNOWN = 'UNKNOWN',
}
