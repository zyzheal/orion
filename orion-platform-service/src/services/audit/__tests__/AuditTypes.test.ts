/**
 * AuditTypes 单元测试
 *
 * 验证：
 * - DEFAULT_CHAIN_CONFIG 默认配置值
 * - DEFAULT_ALERT_CONFIG 默认配置值
 * - DEFAULT_VERIFICATION_SCHEDULE 默认配置值
 * - 类型结构完整性
 */

import {
  DEFAULT_CHAIN_CONFIG,
  DEFAULT_ALERT_CONFIG,
  DEFAULT_VERIFICATION_SCHEDULE,
} from '../AuditTypes';

import type {
  ChainedAuditLogEntry,
  ChainVerificationResult,
  ChainBreak,
  HashAlgorithm,
  ChainConfig,
  IntegrityReport,
  IntegrityIssue,
  AlertConfig,
  VerificationSchedule,
} from '../AuditTypes';

describe('AuditTypes', () => {
  // ==================== DEFAULT_CHAIN_CONFIG ====================

  describe('DEFAULT_CHAIN_CONFIG', () => {
    it('应该使用 SHA256 算法', () => {
      expect(DEFAULT_CHAIN_CONFIG.algorithm).toBe('SHA256');
    });

    it('应该有 64 个 0 的创世 Hash', () => {
      expect(DEFAULT_CHAIN_CONFIG.genesisHash).toBe('0'.repeat(64));
      expect(DEFAULT_CHAIN_CONFIG.genesisHash).toHaveLength(64);
    });

    it('应该默认禁用签名', () => {
      expect(DEFAULT_CHAIN_CONFIG.enableSignature).toBe(false);
    });

    it('签名密钥应该为 undefined', () => {
      expect(DEFAULT_CHAIN_CONFIG.signingKey).toBeUndefined();
    });

    it('应该满足 ChainConfig 接口结构', () => {
      expect(typeof DEFAULT_CHAIN_CONFIG.algorithm).toBe('string');
      expect(typeof DEFAULT_CHAIN_CONFIG.genesisHash).toBe('string');
      expect(typeof DEFAULT_CHAIN_CONFIG.enableSignature).toBe('boolean');
    });
  });

  // ==================== DEFAULT_ALERT_CONFIG ====================

  describe('DEFAULT_ALERT_CONFIG', () => {
    it('应该默认启用告警', () => {
      expect(DEFAULT_ALERT_CONFIG.enabled).toBe(true);
    });

    it('默认断点阈值应为 1', () => {
      expect(DEFAULT_ALERT_CONFIG.breakThreshold).toBe(1);
    });

    it('默认通知渠道应为 webhook', () => {
      expect(DEFAULT_ALERT_CONFIG.channels).toEqual(['webhook']);
      expect(DEFAULT_ALERT_CONFIG.channels).toHaveLength(1);
    });

    it('webhookUrl 应为 undefined', () => {
      expect(DEFAULT_ALERT_CONFIG.webhookUrl).toBeUndefined();
    });

    it('emailRecipients 应为 undefined', () => {
      expect(DEFAULT_ALERT_CONFIG.emailRecipients).toBeUndefined();
    });

    it('应该满足 AlertConfig 接口结构', () => {
      expect(typeof DEFAULT_ALERT_CONFIG.enabled).toBe('boolean');
      expect(typeof DEFAULT_ALERT_CONFIG.breakThreshold).toBe('number');
      expect(Array.isArray(DEFAULT_ALERT_CONFIG.channels)).toBe(true);
    });
  });

  // ==================== DEFAULT_VERIFICATION_SCHEDULE ====================

  describe('DEFAULT_VERIFICATION_SCHEDULE', () => {
    it('应该默认启用', () => {
      expect(DEFAULT_VERIFICATION_SCHEDULE.enabled).toBe(true);
    });

    it('默认 cron 表达式应为每日凌晨 2 点', () => {
      expect(DEFAULT_VERIFICATION_SCHEDULE.cronExpression).toBe('0 2 * * *');
    });

    it('默认批次大小应为 1000', () => {
      expect(DEFAULT_VERIFICATION_SCHEDULE.batchSize).toBe(1000);
    });

    it('应该满足 VerificationSchedule 接口结构', () => {
      expect(typeof DEFAULT_VERIFICATION_SCHEDULE.enabled).toBe('boolean');
      expect(typeof DEFAULT_VERIFICATION_SCHEDULE.cronExpression).toBe('string');
      expect(typeof DEFAULT_VERIFICATION_SCHEDULE.batchSize).toBe('number');
    });
  });

  // ==================== 类型结构运行时验证 ====================

  describe('类型结构运行时验证', () => {
    it('ChainBreak 应包含所有必要字段', () => {
      const breakEntry: ChainBreak = {
        sequenceNumber: 1,
        entryId: 'entry-1',
        expectedHash: 'abc123',
        actualHash: 'def456',
        breakType: 'HASH_MISMATCH',
        description: 'Hash mismatch detected',
        detectedAt: new Date(),
      };

      expect(breakEntry.sequenceNumber).toBe(1);
      expect(breakEntry.entryId).toBe('entry-1');
      expect(breakEntry.breakType).toBe('HASH_MISMATCH');
      expect(breakEntry.detectedAt).toBeInstanceOf(Date);
    });

    it('ChainBreak breakType 应支持所有类型', () => {
      const validTypes: ChainBreak['breakType'][] = [
        'HASH_MISMATCH',
        'SEQUENCE_GAP',
        'INVALID_SIGNATURE',
        'MODIFIED_CONTENT',
      ];

      validTypes.forEach(type => {
        const breakEntry: ChainBreak = {
          sequenceNumber: 1,
          entryId: 'entry-1',
          expectedHash: 'abc',
          actualHash: 'def',
          breakType: type,
          description: 'test',
          detectedAt: new Date(),
        };
        expect(breakEntry.breakType).toBe(type);
      });
    });

    it('IntegrityIssue 应支持所有严重程度', () => {
      const validSeverities: IntegrityIssue['severity'][] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

      validSeverities.forEach(severity => {
        const issue: IntegrityIssue = {
          type: 'CHAIN_BREAK',
          severity,
          description: 'test issue',
        };
        expect(issue.severity).toBe(severity);
      });
    });

    it('IntegrityIssue 应支持所有问题类型', () => {
      const validTypes: IntegrityIssue['type'][] = [
        'CHAIN_BREAK',
        'MODIFIED_ENTRY',
        'MISSING_ENTRY',
        'MISSING_ENTRIES',
        'INVALID_SIGNATURE',
        'STORAGE_TAMPERING',
      ];

      validTypes.forEach(type => {
        const issue: IntegrityIssue = {
          type,
          severity: 'HIGH',
          description: 'test',
        };
        expect(issue.type).toBe(type);
      });
    });

    it('IntegrityReport status 应支持所有状态', () => {
      const validStatuses: IntegrityReport['status'][] = ['PASSED', 'WARNING', 'FAILED'];

      validStatuses.forEach(status => {
        const report: IntegrityReport = {
          id: 'report-1',
          verifiedAt: new Date(),
          rangeStart: new Date(),
          rangeEnd: new Date(),
          totalEntries: 100,
          validEntries: 100,
          issues: [],
          status,
          durationMs: 1500,
        };
        expect(report.status).toBe(status);
      });
    });

    it('HashAlgorithm 应支持 SHA256 和 SHA512', () => {
      const validAlgorithms: HashAlgorithm[] = ['SHA256', 'SHA512'];

      validAlgorithms.forEach(algorithm => {
        const config: ChainConfig = {
          algorithm,
          genesisHash: '0'.repeat(64),
          enableSignature: false,
        };
        expect(config.algorithm).toBe(algorithm);
      });
    });

    it('AlertConfig channels 应支持 email、webhook、slack', () => {
      const validChannels: AlertConfig['channels'] = ['email', 'webhook', 'slack'];

      const config: AlertConfig = {
        enabled: true,
        breakThreshold: 1,
        channels: validChannels,
      };

      expect(config.channels).toContain('email');
      expect(config.channels).toContain('webhook');
      expect(config.channels).toContain('slack');
    });
  });

  // ==================== 常量不可变性 ====================

  describe('常量不可变性', () => {
    it('DEFAULT_CHAIN_CONFIG 应该是一个对象', () => {
      expect(typeof DEFAULT_CHAIN_CONFIG).toBe('object');
      expect(DEFAULT_CHAIN_CONFIG).not.toBeNull();
    });

    it('DEFAULT_ALERT_CONFIG 应该是一个对象', () => {
      expect(typeof DEFAULT_ALERT_CONFIG).toBe('object');
      expect(DEFAULT_ALERT_CONFIG).not.toBeNull();
    });

    it('DEFAULT_VERIFICATION_SCHEDULE 应该是一个对象', () => {
      expect(typeof DEFAULT_VERIFICATION_SCHEDULE).toBe('object');
      expect(DEFAULT_VERIFICATION_SCHEDULE).not.toBeNull();
    });
  });
});
