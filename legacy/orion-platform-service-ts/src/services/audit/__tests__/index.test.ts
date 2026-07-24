/**
 * audit 模块导出测试
 *
 * 验证 index.ts 正确导出所有公共类型、类和常量
 */

import {
  // 类
  AuditLogChain,
  ImmutableAuditStorage,
  AuditIntegrityVerifier,
  AuditRepository,
  AuditService,
  AuditServiceError,

  // 常量
  DEFAULT_CHAIN_CONFIG,
  DEFAULT_ALERT_CONFIG,
  DEFAULT_VERIFICATION_SCHEDULE,
} from '../index';

// 类型导入（编译时检查）
import type {
  IAuditLogChainRepository,
  ChainedAuditLogEntry,
  ChainVerificationResult,
  ChainBreak,
  HashAlgorithm,
  ChainConfig,
  IntegrityReport,
  IntegrityIssue,
  AlertConfig,
  VerificationSchedule,
} from '../index';

describe('audit 模块导出', () => {
  // ==================== 类导出 ====================

  describe('类导出', () => {
    it('应该导出 AuditLogChain', () => {
      expect(AuditLogChain).toBeDefined();
      expect(typeof AuditLogChain).toBe('function');
    });

    it('应该导出 ImmutableAuditStorage', () => {
      expect(ImmutableAuditStorage).toBeDefined();
      expect(typeof ImmutableAuditStorage).toBe('function');
    });

    it('应该导出 AuditIntegrityVerifier', () => {
      expect(AuditIntegrityVerifier).toBeDefined();
      expect(typeof AuditIntegrityVerifier).toBe('function');
    });

    it('应该导出 AuditRepository', () => {
      expect(AuditRepository).toBeDefined();
      expect(typeof AuditRepository).toBe('function');
    });

    it('应该导出 AuditService', () => {
      expect(AuditService).toBeDefined();
      expect(typeof AuditService).toBe('function');
    });

    it('应该导出 AuditServiceError', () => {
      expect(AuditServiceError).toBeDefined();
      expect(typeof AuditServiceError).toBe('function');
    });
  });

  // ==================== 常量导出 ====================

  describe('常量导出', () => {
    it('应该导出 DEFAULT_CHAIN_CONFIG', () => {
      expect(DEFAULT_CHAIN_CONFIG).toBeDefined();
      expect(DEFAULT_CHAIN_CONFIG.algorithm).toBe('SHA256');
      expect(DEFAULT_CHAIN_CONFIG.genesisHash).toBe('0'.repeat(64));
      expect(DEFAULT_CHAIN_CONFIG.enableSignature).toBe(false);
    });

    it('应该导出 DEFAULT_ALERT_CONFIG', () => {
      expect(DEFAULT_ALERT_CONFIG).toBeDefined();
      expect(DEFAULT_ALERT_CONFIG.enabled).toBe(true);
      expect(DEFAULT_ALERT_CONFIG.breakThreshold).toBe(1);
      expect(DEFAULT_ALERT_CONFIG.channels).toEqual(['webhook']);
    });

    it('应该导出 DEFAULT_VERIFICATION_SCHEDULE', () => {
      expect(DEFAULT_VERIFICATION_SCHEDULE).toBeDefined();
      expect(DEFAULT_VERIFICATION_SCHEDULE.enabled).toBe(true);
      expect(DEFAULT_VERIFICATION_SCHEDULE.cronExpression).toBe('0 2 * * *');
      expect(DEFAULT_VERIFICATION_SCHEDULE.batchSize).toBe(1000);
    });
  });

  // ==================== AuditServiceError 实例验证 ====================

  describe('AuditServiceError', () => {
    it('应该创建具有正确属性的错误实例', () => {
      const error = new AuditServiceError('测试错误', 'TEST_CODE');

      expect(error.message).toBe('测试错误');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('AuditServiceError');
    });

    it('应该是 Error 的实例', () => {
      const error = new AuditServiceError('msg', 'code');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AuditServiceError);
    });

    it('应该保留 stack trace', () => {
      const error = new AuditServiceError('msg', 'code');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AuditServiceError');
    });
  });

  // ==================== 实例化验证 ====================

  describe('实例化验证', () => {
    it('应该能够创建 AuditRepository 实例', () => {
      const mockPool = { query: jest.fn() };
      const repo = new AuditRepository(mockPool as any);

      expect(repo).toBeDefined();
      expect(repo.findById).toBeDefined();
      expect(repo.create).toBeDefined();
    });

    it('应该能够创建 AuditService 实例', () => {
      const mockPool = { query: jest.fn() };
      const repo = new AuditRepository(mockPool as any);
      const service = new AuditService(repo);

      expect(service).toBeDefined();
    });
  });
});
