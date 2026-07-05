/**
 * ChatOps Errors 单元测试
 *
 * 测试 ChatOps 特定错误类型：ChatOpsErrorCode、CommandNotFoundError、
 * CommandDisabledError、WebhookVerificationError、IMPlatformError。
 */

import {
  ChatOpsErrorCode,
  CommandNotFoundError,
  CommandDisabledError,
  WebhookVerificationError,
  IMPlatformError,
  ErrorCode,
  OrionError,
} from '../Errors';

describe('ChatOps Errors', () => {
  describe('ChatOpsErrorCode enum', () => {
    it('should have command-related error codes', () => {
      expect(ChatOpsErrorCode.UNKNOWN_COMMAND).toBe('UNKNOWN_COMMAND');
      expect(ChatOpsErrorCode.COMMAND_NOT_FOUND).toBe('COMMAND_NOT_FOUND');
      expect(ChatOpsErrorCode.COMMAND_DISABLED).toBe('COMMAND_DISABLED');
    });

    it('should have execution-related error codes', () => {
      expect(ChatOpsErrorCode.EXECUTION_FAILED).toBe('EXECUTION_FAILED');
      expect(ChatOpsErrorCode.EXECUTION_TIMEOUT).toBe('EXECUTION_TIMEOUT');
    });

    it('should have webhook-related error codes', () => {
      expect(ChatOpsErrorCode.WEBHOOK_VERIFICATION_FAILED).toBe('WEBHOOK_VERIFICATION_FAILED');
      expect(ChatOpsErrorCode.WEBHOOK_SIGNATURE_INVALID).toBe('WEBHOOK_SIGNATURE_INVALID');
    });

    it('should have IM platform-related error codes', () => {
      expect(ChatOpsErrorCode.IM_PLATFORM_UNAVAILABLE).toBe('IM_PLATFORM_UNAVAILABLE');
      expect(ChatOpsErrorCode.IM_RATE_LIMITED).toBe('IM_RATE_LIMITED');
    });
  });

  describe('CommandNotFoundError', () => {
    it('should create error with command name', () => {
      const error = new CommandNotFoundError('deploy');
      expect(error.message).toBe('未知命令: deploy。使用 /help 查看可用命令列表');
      expect(error.code).toBe(ErrorCode.NOT_FOUND);
      expect(error.recoverable).toBe(false);
      expect(error.name).toBe('CommandNotFoundError');
    });

    it('should be an instance of OrionError', () => {
      const error = new CommandNotFoundError('test');
      expect(error).toBeInstanceOf(OrionError);
    });

    it('should include commandName in details', () => {
      const error = new CommandNotFoundError('restart');
      expect(error.details).toEqual({ commandName: 'restart' });
    });
  });

  describe('CommandDisabledError', () => {
    it('should create error with default reason', () => {
      const error = new CommandDisabledError('deploy');
      expect(error.message).toBe('命令 deploy 已禁用: 请联系管理员');
      expect(error.code).toBe(ErrorCode.FORBIDDEN);
      expect(error.recoverable).toBe(false);
      expect(error.name).toBe('CommandDisabledError');
    });

    it('should create error with custom reason', () => {
      const error = new CommandDisabledError('deploy', '维护中');
      expect(error.message).toBe('命令 deploy 已禁用: 维护中');
    });

    it('should be an instance of OrionError', () => {
      const error = new CommandDisabledError('test');
      expect(error).toBeInstanceOf(OrionError);
    });

    it('should include commandName and reason in details', () => {
      const error = new CommandDisabledError('deploy', '过期');
      expect(error.details).toEqual({ commandName: 'deploy', reason: '过期' });
    });
  });

  describe('WebhookVerificationError', () => {
    it('should create error with default reason', () => {
      const error = new WebhookVerificationError('slack');
      expect(error.message).toBe('Webhook 签名验证失败 (slack): 签名验证失败');
      expect(error.code).toBe(ErrorCode.FORBIDDEN);
      expect(error.recoverable).toBe(false);
      expect(error.name).toBe('WebhookVerificationError');
    });

    it('should create error with custom reason', () => {
      const error = new WebhookVerificationError('dingtalk', '签名过期');
      expect(error.message).toBe('Webhook 签名验证失败 (dingtalk): 签名过期');
    });

    it('should be an instance of OrionError', () => {
      const error = new WebhookVerificationError('test');
      expect(error).toBeInstanceOf(OrionError);
    });

    it('should include platform and reason in details', () => {
      const error = new WebhookVerificationError('feishu', '缺少签名头');
      expect(error.details).toEqual({ platform: 'feishu', reason: '缺少签名头' });
    });
  });

  describe('IMPlatformError', () => {
    it('should create error with default reason', () => {
      const error = new IMPlatformError('dingtalk');
      expect(error.message).toBe('IM 平台 dingtalk 不可用: 请稍后重试');
      expect(error.code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
      expect(error.recoverable).toBe(true);
      expect(error.name).toBe('IMPlatformError');
    });

    it('should create error with custom reason', () => {
      const error = new IMPlatformError('slack', 'rate limit exceeded');
      expect(error.message).toBe('IM 平台 slack 不可用: rate limit exceeded');
    });

    it('should be recoverable', () => {
      const error = new IMPlatformError('feishu');
      expect(error.recoverable).toBe(true);
    });

    it('should be an instance of OrionError', () => {
      const error = new IMPlatformError('test');
      expect(error).toBeInstanceOf(OrionError);
    });

    it('should include platform and reason in details', () => {
      const error = new IMPlatformError('wecom', 'API 限流');
      expect(error.details).toEqual({ platform: 'wecom', reason: 'API 限流' });
    });
  });

  describe('re-exports from global errors', () => {
    it('should re-export ErrorCode', () => {
      expect(ErrorCode).toBeDefined();
      expect(ErrorCode.NOT_FOUND).toBe('NOT_FOUND');
    });

    it('should re-export OrionError', () => {
      expect(OrionError).toBeDefined();
      const error = new OrionError('test', 'INTERNAL_ERROR');
      expect(error).toBeInstanceOf(OrionError);
    });
  });
});
