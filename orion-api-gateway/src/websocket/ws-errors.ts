/**
 * WebSocket 错误码定义
 */

export const WS_ERROR_CODES = {
  // 认证相关
  AUTH_REQUIRED: 4001, // 需要认证
  AUTH_FAILED: 4002, // 认证失败
  TOKEN_EXPIRED: 4003, // Token 过期
  TOKEN_INVALID: 4004, // Token 无效

  // 连接相关
  CONNECTION_LIMIT: 4005, // 连接数超限
  SERVER_CLOSING: 4006, // 服务器关闭中

  // 消息相关
  INVALID_MESSAGE: 4007, // 无效消息格式
  MESSAGE_TOO_LARGE: 4008, // 消息过大

  // 心跳相关
  HEARTBEAT_TIMEOUT: 4009, // 心跳超时

  // 业务相关
  PERMISSION_DENIED: 4010, // 权限不足
  RESOURCE_NOT_FOUND: 4011, // 资源不存在
} as const;

export type WebSocketErrorCode = (typeof WS_ERROR_CODES)[keyof typeof WS_ERROR_CODES];

export interface WebSocketErrorMessage {
  type: 'error';
  code: WebSocketErrorCode;
  message: string;
  timestamp: number;
}

export function createWsErrorMessage(
  code: WebSocketErrorCode,
  message: string
): WebSocketErrorMessage {
  return {
    type: 'error',
    code,
    message,
    timestamp: Date.now(),
  };
}
