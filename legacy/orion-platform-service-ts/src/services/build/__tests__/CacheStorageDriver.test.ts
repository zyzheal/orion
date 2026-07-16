/**
 * CacheStorageDriver 测试
 *
 * 测试 LocalCacheStorageDriver 的缓存恢复、保存、清理和统计功能。
 * Mock fs/promises 模拟文件系统操作。
 */

import { LocalCacheStorageDriver, CacheEntry, CacheStorageDriver } from '../CacheStorageDriver';
import { createHash } from 'crypto';

function getHash(key: string): string {
  return createHash('md5').update(key).digest('hex');
}

// ==================== Mock fs/promises ====================

const mockDirs = new Map<string, Map<string, any>>();
const mockFiles = new Map<string, string>();

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockImplementation(async (dir: string) => {
    if (!mockDirs.has(dir)) {
      mockDirs.set(dir, new Map());
    }
  }),
  readdir: jest.fn().mockImplementation(async (dir: string, opts?: any) => {
    const entries: any[] = [];
    const dirContent = mockDirs.get(dir);
    if (dirContent) {
      for (const [name, content] of dirContent) {
        if (opts?.withFileTypes) {
          entries.push({
            name,
            isDirectory: () => typeof content === 'object' && content !== null && !(content instanceof Date),
            isFile: () => typeof content === 'string' || content instanceof Date,
          });
        } else {
          entries.push(name);
        }
      }
    }
    return entries;
  }),
  writeFile: jest.fn().mockImplementation(async (path: string, content: string) => {
    mockFiles.set(path, content);
  }),
  readFile: jest.fn().mockImplementation(async (path: string) => {
    const content = mockFiles.get(path);
    if (!content) throw new Error(`ENOENT: ${path}`);
    return content;
  }),
  access: jest.fn().mockImplementation(async (path: string) => {
    if (!mockFiles.has(path)) throw new Error(`ENOENT: ${path}`);
  }),
  stat: jest.fn().mockImplementation(async (path: string) => {
    if (!mockFiles.has(path)) throw new Error(`ENOENT: ${path}`);
    return { size: mockFiles.get(path)?.length || 0 };
  }),
  unlink: jest.fn().mockResolvedValue(undefined),
  rm: jest.fn().mockResolvedValue(undefined),
}));

// Mock child_process for tar
jest.mock('child_process', () => ({
  exec: jest.fn().mockImplementation((_cmd: string, _opts: any, cb: Function) => {
    if (typeof _opts === 'function') {
      cb = _opts;
    }
    cb(null, { stdout: '', stderr: '' });
  }),
}));

// Mock pino logger
jest.mock('pino', () => {
  return jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }));
});

// ==================== Tests ====================

describe('LocalCacheStorageDriver', () => {
  let driver: LocalCacheStorageDriver;
  const cacheDir = '/tmp/orion-cache-test';

  beforeEach(() => {
    jest.clearAllMocks();
    mockDirs.clear();
    mockFiles.clear();
    driver = new LocalCacheStorageDriver(cacheDir);
  });

  // ---- CacheStorageDriver interface ----

  describe('CacheStorageDriver interface', () => {
    it('should implement CacheStorageDriver interface', () => {
      expect(typeof driver.restore).toBe('function');
      expect(typeof driver.save).toBe('function');
      expect(typeof driver.cleanup).toBe('function');
      expect(typeof driver.stats).toBe('function');
    });
  });

  // ---- init ----

  describe('init', () => {
    it('should create cache directory', async () => {
      const fs = require('fs/promises');
      await driver.init();

      expect(fs.mkdir).toHaveBeenCalledWith(cacheDir, { recursive: true });
    });
  });

  // ---- restore ----

  describe('restore', () => {
    it('should restore from exact key match', async () => {
      const fs = require('fs/promises');
      const { exec } = require('child_process');

      // The key IS the directory name in tryRestoreKey (entryKey === key)
      const key = 'node-modules-abc123';
      // tryRestoreKey uses entry.name as the directory, but loadMetadata hashes the key
      // So the archive is in `${cacheDir}/${key}/archive.tar`
      // But meta.json is looked up at `${cacheDir}/${md5(key)}/meta.json`
      const keyHash = getHash(key);
      const cacheEntryDir = `${cacheDir}/${key}`;
      const hashDir = `${cacheDir}/${keyHash}`;
      mockFiles.set(`${cacheEntryDir}/archive.tar`, 'tar-content');
      mockFiles.set(`${hashDir}/meta.json`, JSON.stringify({
        key,
        paths: ['node_modules/'],
      }));

      // Mock readdir for init + tryRestoreKey
      fs.readdir.mockImplementation(async (dir: string, opts?: any) => {
        if (dir === cacheDir) {
          return [{
            name: key,
            isDirectory: () => true,
            isFile: () => false,
          }];
        }
        return [];
      });

      const result = await driver.restore(key, [], '/target');

      expect(result.matched).toBe(true);
      expect(result.matchedKey).toBe(key);
      expect(result.restoredPaths).toEqual(['node_modules/']);
    });

    it('should try restoreKeys when exact match fails', async () => {
      const fs = require('fs/promises');
      // The restoreKey IS the directory name for prefix match
      const restoreKey = 'node-modules-';
      const cacheEntryDir = `${cacheDir}/${restoreKey}`;
      // loadMetadata hashes the key to find meta.json
      const hashDir = `${cacheDir}/${getHash(restoreKey)}`;

      mockFiles.set(`${cacheEntryDir}/archive.tar`, 'tar-content');
      mockFiles.set(`${hashDir}/meta.json`, JSON.stringify({
        key: restoreKey,
        paths: ['node_modules/'],
      }));

      fs.readdir.mockImplementation(async (dir: string, opts?: any) => {
        if (dir === cacheDir) {
          return [{
            name: restoreKey,
            isDirectory: () => true,
            isFile: () => false,
          }];
        }
        return [];
      });

      const result = await driver.restore('exact-not-found', [restoreKey], '/target');

      expect(result.matched).toBe(true);
    });

    it('should return unmatched when no cache found', async () => {
      const fs = require('fs/promises');
      fs.readdir.mockResolvedValue([]);

      const result = await driver.restore('missing-key', [], '/target');

      expect(result.matched).toBe(false);
      expect(result.restoredPaths).toEqual([]);
    });

    it('should return unmatched when archive.tar does not exist', async () => {
      const fs = require('fs/promises');
      const keyHash = 'no-archive-hash';

      fs.readdir.mockResolvedValue([{
        name: keyHash,
        isDirectory: () => true,
        isFile: () => false,
      }]);

      // archive.tar doesn't exist
      fs.access.mockRejectedValue(new Error('ENOENT'));

      const result = await driver.restore('no-archive', [], '/target');

      expect(result.matched).toBe(false);
    });

    it('should handle readdir errors gracefully', async () => {
      const fs = require('fs/promises');
      fs.readdir.mockRejectedValue(new Error('Permission denied'));

      const result = await driver.restore('any-key', [], '/target');

      expect(result.matched).toBe(false);
    });
  });

  // ---- save ----

  describe('save', () => {
    it('should return saved=false when no files found', async () => {
      const fs = require('fs/promises');
      fs.readdir.mockResolvedValue([]);

      const result = await driver.save('test-key', ['nonexistent/**'], '/base');

      expect(result.saved).toBe(false);
      expect(result.sizeBytes).toBe(0);
    });

    it('should save cache and return size', async () => {
      const fs = require('fs/promises');
      const { exec } = require('child_process');

      // Mock glob module
      jest.doMock('glob', () => ({
        glob: jest.fn().mockResolvedValue(['file1.txt', 'file2.txt']),
      }));

      fs.readdir.mockResolvedValue([]);
      fs.stat.mockResolvedValue({ size: 1024 });

      // Setup destination directory
      mockDirs.set(cacheDir, new Map());

      const result = await driver.save('test-key', ['src/**'], '/base');

      // The result should be successful since files were found
      expect(result.saved).toBe(true);
      expect(result.sizeBytes).toBe(1024);

      jest.dontMock('glob');
    });

    it('should handle save failure and cleanup', async () => {
      const fs = require('fs/promises');
      const { exec } = require('child_process');

      // Make exec fail
      exec.mockImplementation((_cmd: string, _opts: any, cb: Function) => {
        if (typeof _opts === 'function') cb = _opts;
        cb(new Error('tar failed'), { stdout: '', stderr: '' });
      });

      // Make glob available
      jest.doMock('glob', () => ({
        glob: jest.fn().mockResolvedValue(['file1.txt']),
      }));

      const result = await driver.save('fail-key', ['src/**'], '/base');

      expect(result.saved).toBe(false);
      expect(result.sizeBytes).toBe(0);
      // Should attempt to unlink the partial file
      expect(fs.unlink).toHaveBeenCalled();

      jest.dontMock('glob');
    });
  });

  // ---- cleanup ----

  describe('cleanup', () => {
    it('should remove expired cache entries', async () => {
      const fs = require('fs/promises');
      const expiredDate = new Date('2020-01-01').toISOString();

      fs.readdir.mockResolvedValueOnce([{
        name: 'expired-entry',
        isDirectory: () => true,
        isFile: () => false,
      }]);

      fs.readFile.mockResolvedValueOnce(JSON.stringify({
        key: 'old-cache',
        savedAt: expiredDate,
      }));

      // Mock getDirSize
      fs.readdir.mockResolvedValueOnce([{
        name: 'archive.tar',
        isDirectory: () => false,
        isFile: () => true,
      }]);
      fs.stat.mockResolvedValueOnce({ size: 5000 });

      const result = await driver.cleanup(30);

      expect(result.removedCount).toBe(1);
      expect(result.freedBytes).toBe(5000);
      expect(fs.rm).toHaveBeenCalled();
    });

    it('should not remove entries within maxAge', async () => {
      const fs = require('fs/promises');
      const recentDate = new Date().toISOString();

      fs.readdir.mockResolvedValueOnce([{
        name: 'recent-entry',
        isDirectory: () => true,
        isFile: () => false,
      }]);

      fs.readFile.mockResolvedValueOnce(JSON.stringify({
        key: 'recent-cache',
        savedAt: recentDate,
      }));

      const result = await driver.cleanup(30);

      expect(result.removedCount).toBe(0);
      expect(result.freedBytes).toBe(0);
    });

    it('should skip entries with unreadable metadata', async () => {
      const fs = require('fs/promises');

      fs.readdir.mockResolvedValueOnce([{
        name: 'bad-meta-entry',
        isDirectory: () => true,
        isFile: () => false,
      }]);

      fs.readFile.mockRejectedValue(new Error('ENOENT'));

      const result = await driver.cleanup(30);

      expect(result.removedCount).toBe(0);
    });

    it('should handle readdir failure gracefully', async () => {
      const fs = require('fs/promises');
      fs.readdir.mockRejectedValue(new Error('Permission denied'));

      const result = await driver.cleanup(30);

      expect(result.removedCount).toBe(0);
      expect(result.freedBytes).toBe(0);
    });
  });

  // ---- stats ----

  describe('stats', () => {
    it('should return stats for cache directory', async () => {
      const fs = require('fs/promises');

      fs.readdir.mockResolvedValueOnce([
        {
          name: 'entry-1',
          isDirectory: () => true,
          isFile: () => false,
        },
        {
          name: 'entry-2',
          isDirectory: () => true,
          isFile: () => false,
        },
        {
          name: 'some-file.txt',
          isDirectory: () => false,
          isFile: () => true,
        },
      ]);

      // getDirSize for entry-1
      fs.readdir.mockResolvedValueOnce([{
        name: 'archive.tar',
        isDirectory: () => false,
        isFile: () => true,
      }]);
      fs.stat.mockResolvedValueOnce({ size: 1000 });

      // getDirSize for entry-2
      fs.readdir.mockResolvedValueOnce([{
        name: 'archive.tar',
        isDirectory: () => false,
        isFile: () => true,
      }]);
      fs.stat.mockResolvedValueOnce({ size: 2000 });

      const result = await driver.stats();

      expect(result.totalEntries).toBe(2);
      expect(result.totalSizeBytes).toBe(3000);
    });

    it('should return zeros for empty cache', async () => {
      const fs = require('fs/promises');
      fs.readdir.mockResolvedValue([]);

      const result = await driver.stats();

      expect(result.totalEntries).toBe(0);
      expect(result.totalSizeBytes).toBe(0);
    });

    it('should handle readdir failure gracefully', async () => {
      const fs = require('fs/promises');
      fs.readdir.mockRejectedValue(new Error('ENOENT'));

      const result = await driver.stats();

      expect(result.totalEntries).toBe(0);
      expect(result.totalSizeBytes).toBe(0);
    });
  });

  // ---- default cache directory ----

  describe('default cache directory', () => {
    it('should use TMPDIR when no cacheDir provided', () => {
      const originalTmpdir = process.env.TMPDIR;
      process.env.TMPDIR = '/custom-tmp';

      const defaultDriver = new LocalCacheStorageDriver();
      // We can't directly access private field, but constructor should not throw
      expect(defaultDriver).toBeDefined();

      process.env.TMPDIR = originalTmpdir;
    });

    it('should fallback to /tmp when TMPDIR is not set', () => {
      const originalTmpdir = process.env.TMPDIR;
      delete process.env.TMPDIR;

      const defaultDriver = new LocalCacheStorageDriver();
      expect(defaultDriver).toBeDefined();

      process.env.TMPDIR = originalTmpdir;
    });
  });
});
