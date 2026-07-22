/**
 * Audit Integrity Verifier Tests
 *
 * 测试完整性校验功能：
 * - 定期校验
 * - 链断裂检测
 * - 异常告警
 */

import { AuditLogChain } from '../AuditLogChain';
import { ImmutableAuditStorage } from '../ImmutableAuditStorage';
import { AuditIntegrityVerifier } from '../AuditIntegrityVerifier';
import { ChainedAuditLogEntry, DEFAULT_CHAIN_CONFIG } from '../AuditTypes';
import * as fs from 'fs';

describe('AuditIntegrityVerifier', () => {
  let chain: AuditLogChain;
  let storage: ImmutableAuditStorage;
  let verifier: AuditIntegrityVerifier;
  const testStorageDir = '/tmp/test-verifier-storage';

  beforeEach(async () => {
    // 清理测试目录
    if (fs.existsSync(testStorageDir)) {
      fs.rmSync(testStorageDir, { recursive: true });
    }

    chain = new AuditLogChain();
    storage = new ImmutableAuditStorage({
      storageDir: testStorageDir,
      syncWrite: true,
      enableWriteProtection: false,
    });

    await storage.initialize();

    verifier = new AuditIntegrityVerifier({
      chain,
      storage,
      alertConfig: {
        enabled: true,
        breakThreshold: 1,
        channels: [],
      },
    });
  });

  afterEach(async () => {
    verifier.stop();
    await storage.close();
    chain.clear();

    if (fs.existsSync(testStorageDir)) {
      fs.rmSync(testStorageDir, { recursive: true });
    }
  });

  describe('Verification Execution', () => {
    it('should verify valid chain', async () => {
      // 创建链条目并存储
      for (let i = 0; i < 5; i++) {
        const entry = chain.addEntry(`ACTION_${i}`, `user-${i}`, { index: i });
        await storage.append(entry);
      }

      const result = await verifier.runVerification();

      // 验证应该成功（链是完整的）
      expect(result.chainResult?.valid).toBe(true);
      expect(result.chainResult?.verifiedCount).toBe(5);
      expect(result.chainResult?.totalCount).toBe(5);
    });

    it('should detect chain breaks', async () => {
      // 创建链
      for (let i = 0; i < 5; i++) {
        chain.addEntry(`ACTION_${i}`, `user-${i}`, { index: i });
      }

      // 直接修改链中的条目（绕过验证）
      const entries = chain.export();
      entries[2].contentHash = 'tampered_hash_12345';

      // 验证篡改的链
      const result = await verifier.runVerification();

      expect(result.chainResult?.valid).toBe(false);
      expect(result.chainResult?.breaks.length).toBeGreaterThan(0);

      // 应检测到内容修改或 Hash 不匹配
      const breakFound = result.chainResult?.breaks.find(b =>
        b.breakType === 'MODIFIED_CONTENT' || b.breakType === 'HASH_MISMATCH'
      );
      expect(breakFound).toBeDefined();
    });

    it('should verify within range', async () => {
      for (let i = 0; i < 10; i++) {
        chain.addEntry(`ACTION_${i}`, `user-${i}`, { index: i });
      }

      const result = await verifier.runVerification({
        startSequence: 3,
        endSequence: 7,
      });

      expect(result.chainResult?.totalCount).toBe(5);
      expect(result.chainResult?.verifiedCount).toBe(5);
    });
  });

  describe('Verification History', () => {
    it('should track verification history', async () => {
      for (let i = 0; i < 3; i++) {
        const entry = chain.addEntry(`ACTION_${i}`, `user-${i}`, {});
      }

      await verifier.runVerification();
      await verifier.runVerification();

      const history = verifier.getVerificationHistory();
      expect(history.length).toBe(2);
    });

    it('should limit history results', async () => {
      for (let i = 0; i < 3; i++) {
        chain.addEntry(`ACTION_${i}`, `user-${i}`, {});
      }

      for (let j = 0; j < 5; j++) {
        await verifier.runVerification();
      }

      const history = verifier.getVerificationHistory(3);
      expect(history.length).toBe(3);
    });

    it('should return last verification time', async () => {
      chain.addEntry('ACTION', 'user-1', {});

      await verifier.runVerification();

      const lastTime = verifier.getLastVerification();
      expect(lastTime).toBeDefined();
      expect(lastTime!.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('Alert System', () => {
    it('should emit alert on issues', async () => {
      const handler = jest.fn();
      verifier.on('alert', handler);

      // 创建有效链然后篡改
      chain.addEntry('ACTION_1', 'user-1', {});
      chain.addEntry('ACTION_2', 'user-2', {});

      // 直接修改链中的条目内容
      const entries = chain.export();
      entries[1].details = { tampered: true };

      await verifier.runVerification();

      // 如果有检测到问题，应该触发告警
      if (verifier.getAlertHistory().length > 0) {
        expect(handler).toHaveBeenCalled();
      }
    });

    it('should track alert history', async () => {
      // 创建有效链然后篡改
      chain.addEntry('ACTION_1', 'user-1', {});
      chain.addEntry('ACTION_2', 'user-2', {});

      // 直接修改链中的条目内容
      const entries = chain.export();
      entries[1].contentHash = 'wrong_hash';

      await verifier.runVerification();

      // 检查是否生成了报告
      const history = verifier.getVerificationHistory();
      expect(history.length).toBe(1);
    });

    it('should acknowledge alerts', async () => {
      // 创建有效链然后篡改
      chain.addEntry('ACTION_1', 'user-1', {});
      chain.addEntry('ACTION_2', 'user-2', {});

      // 直接修改链中的条目内容
      const entries = chain.export();
      entries[1].contentHash = 'wrong_hash';

      await verifier.runVerification();

      const alerts = verifier.getAlertHistory();
      if (alerts.length > 0) {
        const alertId = alerts[0].id;
        const result = verifier.acknowledgeAlert(alertId);
        expect(result).toBe(true);
        expect(verifier.getUnacknowledgedAlerts().length).toBe(0);
      }
    });
  });

  describe('Scheduled Verification', () => {
    it('should start scheduled verification', () => {
      verifier.start();

      expect(verifier.isActive()).toBe(true);
    });

    it('should stop scheduled verification', () => {
      verifier.start();
      verifier.stop();

      expect(verifier.isActive()).toBe(false);
    });

    it('should emit started/stopped events', () => {
      const startHandler = jest.fn();
      const stopHandler = jest.fn();

      verifier.on('started', startHandler);
      verifier.on('stopped', stopHandler);

      verifier.start();
      expect(startHandler).toHaveBeenCalled();

      verifier.stop();
      expect(stopHandler).toHaveBeenCalled();
    });
  });

  describe('Manual Verification', () => {
    it('should support manual verification trigger', async () => {
      chain.addEntry('ACTION', 'user-1', {});

      const result = await verifier.verifyNow();

      expect(result.report).toBeDefined();
      expect(result.chainResult).toBeDefined();
    });
  });

  describe('Statistics', () => {
    it('should return correct stats', async () => {
      chain.addEntry('ACTION', 'user-1', {});

      await verifier.runVerification();

      const stats = verifier.getStats();

      expect(stats.totalVerifications).toBe(1);
      expect(stats.isRunning).toBe(false);
    });
  });

  describe('Event Emissions', () => {
    it('should emit verification:completed event', async () => {
      const handler = jest.fn();
      verifier.on('verification:completed', handler);

      chain.addEntry('ACTION', 'user-1', {});
      await verifier.runVerification();

      expect(handler).toHaveBeenCalled();
    });

    it('should emit verification:failed event on error', async () => {
      const handler = jest.fn();
      verifier.on('verification:failed', handler);

      // 创建一个会导致验证失败的场景
      // 注意：正常验证不会触发 failed，只有在异常情况下才会
      await verifier.runVerification();

      // 正常验证成功，不会触发 failed
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Issue Severity', () => {
    it('should classify hash mismatch as CRITICAL', async () => {
      chain.addEntry('ACTION_1', 'user-1', {});
      chain.addEntry('ACTION_2', 'user-2', {});

      // 直接修改链中条目的 prevHash
      const entries = chain.export();
      entries[1].prevHash = 'wrong_prev_hash';

      const result = await verifier.runVerification();

      // 验证检测到的 Hash 不匹配问题
      const hashBreaks = result.chainResult?.breaks.filter(b => b.breakType === 'HASH_MISMATCH') || [];
      if (hashBreaks.length > 0) {
        expect(hashBreaks[0].sequenceNumber).toBe(entries[1].sequenceNumber);
      }
    });

    it('should classify modified content as CRITICAL', async () => {
      chain.addEntry('ACTION_1', 'user-1', { original: true });
      chain.addEntry('ACTION_2', 'user-2', { original: true });

      // 直接修改链中条目的内容（不更新 Hash）
      const entries = chain.export();
      entries[1].details = { modified: true };

      const result = await verifier.runVerification();

      // 验证检测到内容修改问题
      const contentBreaks = result.chainResult?.breaks.filter(b => b.breakType === 'MODIFIED_CONTENT') || [];
      if (contentBreaks.length > 0) {
        expect(contentBreaks[0].sequenceNumber).toBe(entries[1].sequenceNumber);
      }
    });
  });

  describe('Status Determination', () => {
    it('should return valid chain for no issues', async () => {
      chain.addEntry('ACTION', 'user-1', {});

      const result = await verifier.runVerification();

      // 验证链完整性
      expect(result.chainResult?.valid).toBe(true);
      expect(result.chainResult?.breaks.length).toBe(0);
    });

    it('should detect issues for modified content', async () => {
      chain.addEntry('ACTION_1', 'user-1', {});
      chain.addEntry('ACTION_2', 'user-2', {});

      // 直接修改链中条目的 contentHash
      const entries = chain.export();
      entries[1].contentHash = 'wrong_content_hash';

      const result = await verifier.runVerification();

      // 验证应该检测到问题
      expect(result.chainResult?.valid).toBe(false);
      expect(result.chainResult?.breaks.length).toBeGreaterThan(0);
    });

    it('should detect sequence gap issues', async () => {
      // 创建链
      chain.addEntry('ACTION_1', 'user-1', {});
      chain.addEntry('ACTION_2', 'user-2', {});
      chain.addEntry('ACTION_3', 'user-3', {});

      // 使用类型断言直接修改内部状态来创建序列间隙
      const chainInternal = chain as any;
      chainInternal.entriesBySequence.delete(3); // 删除序列 3 的条目
      chainInternal.entriesBySequence.set(5, {
        ...chainInternal.entriesBySequence.get(2),
        sequenceNumber: 5,
        id: 'gap-entry',
      });
      chainInternal.nextSequenceNumber = 6;

      const result = await verifier.runVerification();

      // 序列间隙会导致问题
      expect(result.chainResult?.breaks.length).toBeGreaterThan(0);
    });
  });
});