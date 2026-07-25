/**
 * ObjectStorageService 测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectStorageService } from '../ObjectStorageService';

// Mock fetch
global.fetch = vi.fn();

describe('ObjectStorageService', () => {
  let service: ObjectStorageService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ObjectStorageService({
      provider: 's3',
      region: 'us-east-1',
      accessKeyId: 'test-key',
      accessKeySecret: 'test-secret',
      bucket: 'test-bucket',
    });
  });

  it('should create service with correct config', () => {
    expect(service).toBeDefined();
  });

  it('should generate presigned URL without exposing credentials', () => {
    const url = service.generatePresignedUrl('my-object.txt', 3600);
    // Should not contain accessKeyId as query param (only in path as object key)
    expect(url).not.toContain('X-AccessKeyId');
    // Should contain signature and expiration
    expect(url).toContain('X-Expires');
    expect(url).toContain('X-Signature');
  });

  it('should check if object exists', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
    });

    const exists = await service.exists('test-file.txt');
    expect(exists).toBe(true);
  });

  it('should return false for non-existent object', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const exists = await service.exists('non-existent.txt');
    expect(exists).toBe(false);
  });

  it('should list objects with prefix', async () => {
    const objects = await service.listObjects('prefix/');
    expect(Array.isArray(objects)).toBe(true);
  });
});