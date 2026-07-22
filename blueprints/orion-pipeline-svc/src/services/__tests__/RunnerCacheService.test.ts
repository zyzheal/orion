/**
 * RunnerCacheService 测试
 *
 * 验证：
 * 1. 缓存保存与恢复
 * 2. 前缀匹配恢复
 * 3. 缓存过期清理
 * 4. 缓存统计信息
 * 5. 缓存键版本化
 * 6. 竞态条件保护（并发写入）
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RunnerCacheService } from '../RunnerCacheService';
import * as fs from 'fs';
import * as path from 'path';

describe('RunnerCacheService', () => {
  let cacheDir: string;
  let service: RunnerCacheService;

  beforeEach(() => {
    cacheDir = path.join('/tmp', `orion-cache-test-${Date.now()}`);
    service = new RunnerCacheService({
      cacheDir,
      defaultMaxAge: 3600, // 1 hour
      enableRedisLock: false, // 测试中禁用 Redis 锁
    });
  });

  afterEach(() => {
    if (fs.existsSync(cacheDir)) {
      fs.rmSync(cacheDir, { recursive: true, force: true });
    }
  });

  it('should create cache directory on initialization', () => {
    expect(fs.existsSync(cacheDir)).toBe(true);
  });

  it('should save and restore cache with exact key match', async () => {
    // Create test file
    const testDir = path.join(cacheDir, 'test-source');
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(path.join(testDir, 'file.txt'), 'test content');

    const saved = await service.saveCache('run-1', 'stage-1', 'test-key', [testDir]);
    expect(saved).not.toBeNull();
    expect(saved!.key).toBe('test-key');

    const restored = await service.restoreCache('test-key');
    expect(restored.restored).toBe(true);
    expect(restored.key).toBe('test-key');
  });

  it('should not restore non-existent cache', async () => {
    const restored = await service.restoreCache('non-existent-key');
    expect(restored.restored).toBe(false);
  });

  it('should track cache stats', async () => {
    const stats = await service.getStats();
    expect(typeof stats.totalEntries).toBe('number');
    expect(typeof stats.totalSize).toBe('number');
  });

  it('should cleanup expired cache', async () => {
    // Create cache with very short TTL (0 seconds)
    const testDir = path.join(cacheDir, 'test-source-expired');
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(path.join(testDir, 'file.txt'), 'test');

    await service.saveCache('run-1', 'stage-1', 'expired-key', [testDir], 0);

    // Manually expire by modifying the metadata
    const entries = fs.readdirSync(cacheDir);
    for (const entry of entries) {
      if (entry.startsWith('.')) continue;
      const metadataPath = path.join(cacheDir, entry, '.metadata.json');
      if (fs.existsSync(metadataPath)) {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        metadata.expiresAt = new Date(Date.now() - 1000).toISOString(); // Expired
        fs.writeFileSync(metadataPath, JSON.stringify(metadata));
      }
    }

    const { cleaned } = await service.cleanup();
    expect(cleaned).toBeGreaterThan(0);
  });

  // ==================== 缓存键版本化测试 ====================

  describe('Cache Key Versioning', () => {
    it('should generate versioned cache keys', () => {
      const key = RunnerCacheService.versionedCacheKey('npm', 'node-modules', '1.0.0');
      expect(key).toBe('npm-node-modules-v1.0.0');
    });

    it('should generate versioned cache keys with default version', () => {
      const key = RunnerCacheService.versionedCacheKey('pip', 'requirements');
      expect(key).toBe('pip-requirements-v1.0.0');
    });

    it('should parse versioned cache keys', () => {
      const parsed = RunnerCacheService.parseVersionedKey('npm-node-modules-v2.1.0');
      expect(parsed).not.toBeNull();
      expect(parsed!.type).toBe('npm');
      expect(parsed!.identifier).toBe('node-modules');
      expect(parsed!.version).toBe('2.1.0');
    });

    it('should return null for non-versioned keys', () => {
      const parsed = RunnerCacheService.parseVersionedKey('simple-key');
      expect(parsed).toBeNull();
    });

    it('should restore cache using versioned key', async () => {
      const versionedKey = RunnerCacheService.versionedCacheKey('test', 'data', '1.0.0');
      const testDir = path.join(cacheDir, 'test-versioned');
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(path.join(testDir, 'file.txt'), 'versioned content');

      await service.saveCache('run-1', 'stage-1', versionedKey, [testDir]);

      const restored = await service.restoreCache(versionedKey);
      expect(restored.restored).toBe(true);
      expect(restored.key).toBe(versionedKey);
    });
  });

  // ==================== 前缀匹配测试 ====================

  describe('Prefix Match Restoration', () => {
    it('should restore cache using prefix match', async () => {
      // Save cache with a specific key
      const testDir = path.join(cacheDir, 'test-prefix');
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(path.join(testDir, 'file.txt'), 'prefix content');

      await service.saveCache('run-1', 'stage-1', 'npm-deps-v1.0.0', [testDir]);

      // Restore using prefix
      const restored = await service.restoreCache('unknown-key', ['npm-deps']);
      expect(restored.restored).toBe(true);
    });

    it('should prefer newest cache for prefix match', async () => {
      const testDir1 = path.join(cacheDir, 'test-prefix-1');
      const testDir2 = path.join(cacheDir, 'test-prefix-2');
      fs.mkdirSync(testDir1, { recursive: true });
      fs.mkdirSync(testDir2, { recursive: true });
      fs.writeFileSync(path.join(testDir1, 'file.txt'), 'old content');
      fs.writeFileSync(path.join(testDir2, 'file.txt'), 'new content');

      await service.saveCache('run-1', 'stage-1', 'deps-old-key', [testDir1]);
      // Small delay to ensure different timestamps
      await new Promise(r => setTimeout(r, 10));
      await service.saveCache('run-2', 'stage-1', 'deps-new-key', [testDir2]);

      const restored = await service.restoreCache('unknown', ['deps']);
      expect(restored.restored).toBe(true);
      expect(restored.key).toBe('deps-new-key');
    });
  });

  // ==================== 并发写入测试 ====================

  describe('Concurrent Write Protection', () => {
    it('should handle concurrent saveCache calls', async () => {
      // 为每个并发调用创建独立的源目录
      const createSourceDir = (index: number) => {
        const testDir = path.join('/tmp', `test-concurrent-src-${index}`);
        fs.mkdirSync(testDir, { recursive: true });
        fs.writeFileSync(path.join(testDir, 'file.txt'), `concurrent content ${index}`);
        return testDir;
      };

      const sources = [0, 1, 2].map(createSourceDir);

      try {
        // Simulate concurrent saves (without Redis lock, they will all succeed)
        const results = await Promise.all([
          service.saveCache('run-1', 'stage-1', 'concurrent-key-1', [sources[0]]),
          service.saveCache('run-2', 'stage-1', 'concurrent-key-2', [sources[1]]),
          service.saveCache('run-3', 'stage-1', 'concurrent-key-3', [sources[2]]),
        ]);

        // At least one should succeed
        const successCount = results.filter(r => r !== null).length;
        expect(successCount).toBeGreaterThan(0);
      } finally {
        // Cleanup source directories
        for (const src of sources) {
          if (fs.existsSync(src)) {
            fs.rmSync(src, { recursive: true, force: true });
          }
        }
      }
    });
  });
});
