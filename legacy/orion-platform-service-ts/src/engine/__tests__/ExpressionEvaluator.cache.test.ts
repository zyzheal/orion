/**
 * ExpressionEvaluator hashFiles() Tests
 *
 * Tests for the hashFiles expression function and hashFilesGlob utility.
 */

import { ExpressionEvaluator, hashFilesGlob } from '../ExpressionEvaluator';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('ExpressionEvaluator hashFiles', () => {
  let evaluator: ExpressionEvaluator;

  beforeEach(() => {
    evaluator = new ExpressionEvaluator();
  });

  test('hashFiles() function should be available in expressions', () => {
    const context = {};
    // hashFiles() returns empty string in expression context (no real fs access)
    const result = evaluator.evaluate('hashFiles("x") == ""', context);
    expect(result).toBe(true);
  });

  test('hashFiles should be in allowed functions list', () => {
    // Should not throw a blocked pattern error
    expect(() => {
      evaluator.evaluate('hashFiles("x") == ""', {});
    }).not.toThrow();
  });
});

describe('hashFilesGlob utility', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hashfiles-test-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  test('should hash file contents', async () => {
    await fs.writeFile(path.join(testDir, 'file1.txt'), 'hello');
    await fs.writeFile(path.join(testDir, 'file2.txt'), 'world');

    const hash = await hashFilesGlob(['*.txt'], testDir);

    expect(hash).toBeDefined();
    expect(typeof hash).toBe('string');
    expect(hash.length).toBe(64); // SHA-256 hex length
  });

  test('should return different hashes for different contents', async () => {
    await fs.writeFile(path.join(testDir, 'a.txt'), 'content-a');
    const hashA = await hashFilesGlob(['*.txt'], testDir);

    await fs.writeFile(path.join(testDir, 'a.txt'), 'content-b');
    const hashB = await hashFilesGlob(['*.txt'], testDir);

    expect(hashA).not.toBe(hashB);
  });

  test('should return same hash for same contents', async () => {
    await fs.writeFile(path.join(testDir, 'a.txt'), 'same-content');
    const hash1 = await hashFilesGlob(['*.txt'], testDir);
    const hash2 = await hashFilesGlob(['*.txt'], testDir);

    expect(hash1).toBe(hash2);
  });

  test('should handle non-existent files gracefully', async () => {
    const hash = await hashFilesGlob(['nonexistent/*.txt'], testDir);
    expect(typeof hash).toBe('string');
    expect(hash.length).toBe(64);
  });

  test('should handle empty directory', async () => {
    const hash = await hashFilesGlob(['*'], testDir);
    expect(typeof hash).toBe('string');
    expect(hash.length).toBe(64);
  });
});
