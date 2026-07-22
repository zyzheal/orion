/**
 * ArtifactSignatureService 测试
 *
 * 验证：
 * 1. 校验和计算 (SHA256/SHA512/MD5)
 * 2. 签名文件生成与验证
 * 3. 完整性校验
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ArtifactSignatureService } from '../ArtifactSignatureService';
import * as fs from 'fs';
import * as path from 'path';

describe('ArtifactSignatureService', () => {
  let service: ArtifactSignatureService;
  let testFile: string;

  beforeEach(() => {
    service = new ArtifactSignatureService();
    testFile = path.join('/tmp', `test-artifact-${Date.now()}.txt`);
    fs.writeFileSync(testFile, 'Hello, World! Test content for checksum.');
  });

  afterEach(() => {
    if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
    if (fs.existsSync(`${testFile}.sha256`)) fs.unlinkSync(`${testFile}.sha256`);
  });

  it('should compute SHA256 checksum', async () => {
    const checksum = await service.computeChecksum(testFile, 'sha256');
    expect(checksum.algorithm).toBe('sha256');
    expect(checksum.checksum.length).toBe(64); // SHA256 hex length
    expect(checksum.size).toBeGreaterThan(0);
  });

  it('should compute SHA512 checksum', async () => {
    const checksum = await service.computeChecksum(testFile, 'sha512');
    expect(checksum.algorithm).toBe('sha512');
    expect(checksum.checksum.length).toBe(128); // SHA512 hex length
  });

  it('should compute MD5 checksum', async () => {
    const checksum = await service.computeChecksum(testFile, 'md5');
    expect(checksum.algorithm).toBe('md5');
    expect(checksum.checksum.length).toBe(32); // MD5 hex length
  });

  it('should generate signature file', async () => {
    const result = await service.generateSignature(testFile, 'sha256');
    expect(result.success).toBe(true);
    expect(result.signatureFile).toBe(`${testFile}.sha256`);
    expect(fs.existsSync(`${testFile}.sha256`)).toBe(true);
  });

  it('should verify checksum with expected value', async () => {
    const checksum = await service.computeChecksum(testFile);
    const verification = await service.verifyChecksum(testFile, checksum.checksum);
    expect(verification.valid).toBe(true);
    expect(verification.checksumMatch).toBe(true);
  });

  it('should detect tampered file', async () => {
    const checksum = await service.computeChecksum(testFile);
    // Tamper with file
    fs.writeFileSync(testFile, 'Tampered content!');
    const verification = await service.verifyChecksum(testFile, checksum.checksum);
    expect(verification.valid).toBe(false);
    expect(verification.checksumMatch).toBe(false);
  });

  it('should verify from signature file', async () => {
    await service.generateSignature(testFile, 'sha256');
    const verification = await service.verifyFromSignatureFile(testFile);
    expect(verification.valid).toBe(true);
  });

  it('should throw on missing file', async () => {
    await expect(service.computeChecksum('/nonexistent/file.txt'))
      .rejects.toThrow('File not found');
  });
});
