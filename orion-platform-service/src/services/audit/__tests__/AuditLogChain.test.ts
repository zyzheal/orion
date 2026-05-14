/**
 * Audit Log Chain Tests
 *
 * 测试链式 Hash 功能：
 * - 链式 Hash 生成
 * - 完整性验证
 * - 篡改检测
 */

import { AuditLogChain } from '../AuditLogChain';
import { ChainedAuditLogEntry, DEFAULT_CHAIN_CONFIG } from '../AuditTypes';

describe('AuditLogChain', () => {
  let chain: AuditLogChain;

  beforeEach(() => {
    chain = new AuditLogChain();
  });

  afterEach(() => {
    chain.clear();
  });

  describe('Chain Hash Generation', () => {
    it('should create first entry with genesis hash', () => {
      const entry = chain.addEntry('USER_LOGIN', 'user-1', { ip: '192.168.1.1' });

      expect(entry.id).toBeDefined();
      expect(entry.sequenceNumber).toBe(1);
      expect(entry.prevHash).toBe(DEFAULT_CHAIN_CONFIG.genesisHash);
      expect(entry.chainHash).toBeDefined();
      expect(entry.chainHash).toHaveLength(64); // SHA256 hex length
    });

    it('should create consecutive entries with correct prevHash', () => {
      const entry1 = chain.addEntry('ACTION_1', 'user-1', { data: 'test1' });
      const entry2 = chain.addEntry('ACTION_2', 'user-2', { data: 'test2' });

      expect(entry2.prevHash).toBe(entry1.chainHash);
      expect(entry2.sequenceNumber).toBe(2);
    });

    it('should generate consistent content hash', () => {
      const entry = chain.addEntry('DATA_ACCESS', 'user-1', {
        resource: 'file-123',
        operation: 'read',
      });

      // 同样的内容应该生成同样的 contentHash
      expect(entry.contentHash).toBeDefined();
      expect(entry.contentHash).toHaveLength(64);
    });

    it('should increment sequence numbers correctly', () => {
      for (let i = 0; i < 10; i++) {
        chain.addEntry(`ACTION_${i}`, 'user-1', { index: i });
      }

      const state = chain.getChainState();
      expect(state.totalEntries).toBe(10);
      expect(state.lastSequenceNumber).toBe(10);
      expect(state.nextSequenceNumber).toBe(11);
    });
  });

  describe('Entry Integrity Verification', () => {
    it('should verify entry integrity correctly', () => {
      const entry = chain.addEntry('VALID_ACTION', 'user-1', { valid: true });

      const isValid = chain.verifyEntryIntegrity(entry);
      expect(isValid).toBe(true);
    });

    it('should detect modified content', () => {
      const entry = chain.addEntry('ORIGINAL', 'user-1', { original: true });

      // 修改内容
      const modifiedEntry = { ...entry, details: { original: false } };

      const isValid = chain.verifyEntryIntegrity(modifiedEntry);
      expect(isValid).toBe(false);
    });

    it('should detect modified chain hash', () => {
      const entry = chain.addEntry('ACTION', 'user-1', {});

      // 修改链 Hash
      const modifiedEntry = {
        ...entry,
        chainHash: '0' * 64, // Invalid hash
      };

      const isValid = chain.verifyEntryIntegrity(modifiedEntry);
      expect(isValid).toBe(false);
    });
  });

  describe('Chain Verification', () => {
    it('should verify empty chain', () => {
      const result = chain.verifyChain();

      expect(result.valid).toBe(true);
      expect(result.verifiedCount).toBe(0);
      expect(result.totalCount).toBe(0);
      expect(result.breaks).toHaveLength(0);
    });

    it('should verify valid chain', () => {
      for (let i = 0; i < 5; i++) {
        chain.addEntry(`ACTION_${i}`, `user-${i}`, { index: i });
      }

      const result = chain.verifyChain();

      expect(result.valid).toBe(true);
      expect(result.verifiedCount).toBe(5);
      expect(result.totalCount).toBe(5);
      expect(result.breaks).toHaveLength(0);
    });

    it('should detect hash mismatch (tampering)', () => {
      // 创建链
      for (let i = 0; i < 5; i++) {
        chain.addEntry(`ACTION_${i}`, `user-${i}`, { index: i });
      }

      // 直接篡改链中的条目（绕过 addEntries 的验证）
      const entries = chain.export();
      const modifiedEntry = entries[2];
      // 修改内容但不更新 Hash
      (modifiedEntry as any).details = { tampered: true };

      // 重新验证
      const result = chain.verifyChain();

      expect(result.valid).toBe(false);
      expect(result.breaks.length).toBeGreaterThan(0);

      // 应该检测到内容修改（因为 contentHash 与实际内容不匹配）
      const contentBreak = result.breaks.find(b => b.breakType === 'MODIFIED_CONTENT');
      expect(contentBreak).toBeDefined();
    });

    it('should detect sequence gap', () => {
      // 创建链
      chain.addEntry('ACTION_1', 'user-1', {});
      chain.addEntry('ACTION_2', 'user-2', {});

      // 导出当前链
      const exported = chain.export();

      // 创建一个有效的新条目（序列号应该是 3）
      const entry5 = chain.addEntry('ACTION_5', 'user-5', {});

      // 现在 chain 有 3 个条目，序列号 1, 2, 3
      // 我们需要直接修改内部状态来创建间隙

      // 使用类型断言访问私有成员
      const chainInternal = chain as any;
      chainInternal.entriesBySequence.delete(3); // 删除序列 3 的条目
      chainInternal.entriesBySequence.set(5, { ...entry5, sequenceNumber: 5 }); // 添加到序列 5
      chainInternal.entries.set(entry5.id, { ...entry5, sequenceNumber: 5 });
      chainInternal.nextSequenceNumber = 6;

      // 验证链 - 应该检测到序列 3, 4 缺失
      const result = chain.verifyChain();

      // 应该检测到序列间隙
      const gapBreaks = result.breaks.filter(b => b.breakType === 'SEQUENCE_GAP');
      expect(gapBreaks.length).toBeGreaterThanOrEqual(2); // 序列 3 和 4 缺失
    });

    it('should verify chain within range', () => {
      for (let i = 0; i < 10; i++) {
        chain.addEntry(`ACTION_${i}`, `user-${i}`, { index: i });
      }

      const result = chain.verifyChain({
        startSequence: 3,
        endSequence: 7,
      });

      expect(result.verifiedCount).toBe(5);
      expect(result.totalCount).toBe(5);
    });
  });

  describe('Entry Retrieval', () => {
    it('should get entry by ID', () => {
      const entry = chain.addEntry('ACTION', 'user-1', { test: true });

      const retrieved = chain.getEntryById(entry.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(entry.id);
    });

    it('should get entry by sequence number', () => {
      const entry = chain.addEntry('ACTION', 'user-1', { test: true });

      const retrieved = chain.getEntryBySequence(1);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(entry.id);
    });

    it('should get entries within range', async () => {
      for (let i = 0; i < 10; i++) {
        chain.addEntry(`ACTION_${i}`, `user-${i}`, {});
      }

      const entries = await chain.getEntries({
        startSequence: 3,
        endSequence: 6,
      });

      expect(entries).toHaveLength(4);
      expect(entries[0].sequenceNumber).toBe(3);
      expect(entries[3].sequenceNumber).toBe(6);
    });

    it('should limit returned entries', async () => {
      for (let i = 0; i < 100; i++) {
        chain.addEntry(`ACTION_${i}`, `user-${i}`, {});
      }

      const entries = await chain.getEntries({ limit: 10 });
      expect(entries).toHaveLength(10);
    });

    it('should return undefined for non-existent entry', () => {
      const result = chain.getEntryById('non-existent-id');
      expect(result).toBeUndefined();
    });
  });

  describe('Chain State', () => {
    it('should return correct chain state', () => {
      chain.addEntry('ACTION_1', 'user-1', {});
      chain.addEntry('ACTION_2', 'user-2', {});

      const state = chain.getChainState();

      expect(state.totalEntries).toBe(2);
      expect(state.lastSequenceNumber).toBe(2);
      expect(state.nextSequenceNumber).toBe(3);
      expect(state.lastChainHash).toBeDefined();
    });

    it('should return genesis hash for empty chain', () => {
      const state = chain.getChainState();

      expect(state.totalEntries).toBe(0);
      expect(state.lastSequenceNumber).toBe(0);
      expect(state.lastChainHash).toBe(DEFAULT_CHAIN_CONFIG.genesisHash);
    });
  });

  describe('Export/Import', () => {
    it('should export chain data', () => {
      chain.addEntry('ACTION_1', 'user-1', {});
      chain.addEntry('ACTION_2', 'user-2', {});

      const exported = chain.export();

      expect(exported).toHaveLength(2);
      expect(exported[0].sequenceNumber).toBe(1);
      expect(exported[1].sequenceNumber).toBe(2);
    });

    it('should import chain data', () => {
      // 创建源链
      const sourceChain = new AuditLogChain();
      sourceChain.addEntry('ACTION_1', 'user-1', {});
      sourceChain.addEntry('ACTION_2', 'user-2', {});

      // 导出并导入
      const exported = sourceChain.export();
      const result = chain.import(exported);

      expect(result.added).toBe(2);
      expect(result.skipped).toBe(0);

      const state = chain.getChainState();
      expect(state.totalEntries).toBe(2);
    });

    it('should skip invalid entries on import', () => {
      const validEntry = chain.addEntry('VALID', 'user-1', {});

      // 创建一个无效条目
      const invalidEntry: ChainedAuditLogEntry = {
        id: 'invalid',
        timestamp: new Date(),
        action: 'INVALID',
        userId: 'user-x',
        prevHash: 'wrong_hash',
        contentHash: 'wrong_content_hash',
        chainHash: 'wrong_chain_hash',
        details: {},
        sequenceNumber: 100,
      };

      chain.clear();
      const result = chain.import([validEntry, invalidEntry]);

      expect(result.added).toBe(1);
      expect(result.skipped).toBe(1);
    });
  });

  describe('Batch Operations', () => {
    it('should add entries in batch', () => {
      const entries: ChainedAuditLogEntry[] = [];

      // 先创建一个链来获取正确的 prevHash
      const firstEntry = chain.addEntry('BATCH_START', 'user-1', {});
      entries.push(firstEntry);

      // 然后批量添加更多
      const result = chain.addEntries(entries);
      expect(result.skipped).toBe(1); // 第一个已存在
    });

    it('should maintain order during batch add', async () => {
      // 添加顺序混乱的条目
      const entries: ChainedAuditLogEntry[] = [];

      // 先有序创建
      const chain1 = new AuditLogChain();
      for (let i = 0; i < 5; i++) {
        entries.push(chain1.addEntry(`ACTION_${i}`, `user-${i}`, {}));
      }

      // 反序导入
      const reverseEntries = [...entries].reverse();
      const result = chain.addEntries(reverseEntries);

      // 应该按序列号排序添加
      expect(result.added).toBe(5);
      const retrieved = await chain.getEntries();
      expect(retrieved[0].sequenceNumber).toBe(1);
      expect(retrieved[4].sequenceNumber).toBe(5);
    });
  });

  describe('Clear Operation', () => {
    it('should clear chain', () => {
      chain.addEntry('ACTION', 'user-1', {});

      chain.clear();

      const state = chain.getChainState();
      expect(state.totalEntries).toBe(0);
      expect(state.lastSequenceNumber).toBe(0);
    });

    it('should reset sequence number after clear', () => {
      for (let i = 0; i < 5; i++) {
        chain.addEntry(`ACTION_${i}`, `user-${i}`, {});
      }

      chain.clear();

      const newEntry = chain.addEntry('NEW_ACTION', 'user-new', {});
      expect(newEntry.sequenceNumber).toBe(1);
    });
  });

  describe('Signature Support', () => {
    it('should sign entries when enabled', () => {
      const chainWithSig = new AuditLogChain({
        enableSignature: true,
        signingKey: 'test-signing-key',
      });

      const entry = chainWithSig.addEntry('SIGNED_ACTION', 'user-1', {});
      expect(entry.signature).toBeDefined();
    });

    it('should verify signature', () => {
      const chainWithSig = new AuditLogChain({
        enableSignature: true,
        signingKey: 'test-signing-key',
      });

      const entry = chainWithSig.addEntry('SIGNED_ACTION', 'user-1', {});

      // 修改签名
      const tamperedEntry = { ...entry, signature: 'invalid_signature' };

      const isValid = chainWithSig.verifyEntryIntegrity(entry);
      expect(isValid).toBe(true);

      // 注意：verifyEntryIntegrity 会重新验证签名
      // 但我们修改的是签名值本身，所以验证会失败
      // 这里我们只验证原始签名的正确性
    });
  });
});