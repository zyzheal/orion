/**
 * ArtifactSignatureService - 制品签名与校验 (Task 3.3)
 *
 * 职责：
 * - 计算制品 SHA256 校验和
 * - 生成/验证签名文件
 * - 支持多种哈希算法 (SHA256, SHA512, MD5)
 * - 制品完整性校验
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import pino from 'pino';

const logger = pino({ name: 'artifact-signature-service' });

export type HashAlgorithm = 'sha256' | 'sha512' | 'md5';

/** @deprecated MD5 is not cryptographically secure, use sha256 or sha512 */
export const DEPRECATED_ALGORITHMS: HashAlgorithm[] = ['md5'];

export interface ArtifactChecksum {
  /** 制品文件路径 */
  filePath: string;
  /** 哈希算法 */
  algorithm: HashAlgorithm;
  /** 校验和值 */
  checksum: string;
  /** 文件大小 (字节) */
  size: number;
  /** 计算时间 */
  computedAt: string;
}

export interface SignatureResult {
  success: boolean;
  checksum: ArtifactChecksum;
  signatureFile?: string;
}

export interface VerificationResult {
  /** 校验是否通过 */
  valid: boolean;
  /** 校验和是否匹配 */
  checksumMatch: boolean;
  /** 期望的校验和 */
  expected: string;
  /** 实际的校验和 */
  actual: string;
  /** 错误信息 */
  error?: string;
}

export class ArtifactSignatureService {
  private defaultAlgorithm: HashAlgorithm;

  constructor(options?: { defaultAlgorithm?: HashAlgorithm }) {
    this.defaultAlgorithm = options?.defaultAlgorithm || 'sha256';
  }

  /**
   * 计算制品文件的校验和
   */
  async computeChecksum(
    filePath: string,
    algorithm?: HashAlgorithm
  ): Promise<ArtifactChecksum> {
    const algo = algorithm || this.defaultAlgorithm;

    // Warn on deprecated algorithms
    if (DEPRECATED_ALGORITHMS.includes(algo)) {
      logger.warn({ algorithm: algo }, 'Deprecated hash algorithm used');
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      throw new Error(`Not a file: ${filePath}`);
    }

    const hash = crypto.createHash(algo);
    const stream = fs.createReadStream(filePath);

    return new Promise((resolve, reject) => {
      stream.on('data', (data: string | Buffer) => {
        hash.update(typeof data === 'string' ? Buffer.from(data) : data);
      });

      stream.on('end', () => {
        resolve({
          filePath,
          algorithm: algo,
          checksum: hash.digest('hex'),
          size: stat.size,
          computedAt: new Date().toISOString(),
        });
      });

      stream.on('error', reject);
    });
  }

  /**
   * 为制品生成签名文件 (.sha256 / .sha512 / .md5)
   */
  async generateSignature(
    filePath: string,
    algorithm?: HashAlgorithm
  ): Promise<SignatureResult> {
    const checksum = await this.computeChecksum(filePath, algorithm);
    const signatureFile = `${filePath}.${checksum.algorithm}`;

    // 写入签名文件 (格式: checksum  filename)
    const fileName = path.basename(filePath);
    const signatureContent = `${checksum.checksum}  ${fileName}\n`;
    fs.writeFileSync(signatureFile, signatureContent);

    logger.info(
      { filePath, algorithm: checksum.algorithm, signatureFile },
      'Signature generated'
    );

    return {
      success: true,
      checksum,
      signatureFile,
    };
  }

  /**
   * 验证制品文件的完整性
   */
  async verifyChecksum(
    filePath: string,
    expectedChecksum: string,
    algorithm?: HashAlgorithm
  ): Promise<VerificationResult> {
    if (!fs.existsSync(filePath)) {
      return {
        valid: false,
        checksumMatch: false,
        expected: expectedChecksum,
        actual: '',
        error: `File not found: ${filePath}`,
      };
    }

    try {
      const actual = await this.computeChecksum(filePath, algorithm);
      const match = actual.checksum.toLowerCase() === expectedChecksum.toLowerCase();

      return {
        valid: match,
        checksumMatch: match,
        expected: expectedChecksum,
        actual: actual.checksum,
      };
    } catch (error: any) {
      return {
        valid: false,
        checksumMatch: false,
        expected: expectedChecksum,
        actual: '',
        error: error.message,
      };
    }
  }

  /**
   * 从签名文件验证制品
   */
  async verifyFromSignatureFile(filePath: string): Promise<VerificationResult> {
    // 查找对应的签名文件
    const algorithms: HashAlgorithm[] = ['sha256', 'sha512', 'md5'];
    let signatureFile: string | null = null;
    let algorithm: HashAlgorithm = this.defaultAlgorithm;

    for (const algo of algorithms) {
      const sigFile = `${filePath}.${algo}`;
      if (fs.existsSync(sigFile)) {
        signatureFile = sigFile;
        algorithm = algo;
        break;
      }
    }

    if (!signatureFile) {
      return {
        valid: false,
        checksumMatch: false,
        expected: '',
        actual: '',
        error: 'No signature file found',
      };
    }

    // 读取签名文件
    const content = fs.readFileSync(signatureFile, 'utf-8');
    const match = content.match(/^([a-f0-9]+)\s+/);
    if (!match) {
      return {
        valid: false,
        checksumMatch: false,
        expected: '',
        actual: '',
        error: 'Invalid signature file format',
      };
    }

    const expectedChecksum = match[1];
    return this.verifyChecksum(filePath, expectedChecksum, algorithm);
  }

  /**
   * 批量计算目录下所有文件的校验和
   */
  async computeDirectoryChecksums(
    dirPath: string,
    algorithm?: HashAlgorithm
  ): Promise<ArtifactChecksum[]> {
    if (!fs.existsSync(dirPath)) {
      throw new Error(`Directory not found: ${dirPath}`);
    }

    const checksums: ArtifactChecksum[] = [];
    const entries = fs.readdirSync(dirPath);

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isFile() && !entry.startsWith('.')) {
        const checksum = await this.computeChecksum(fullPath, algorithm);
        checksums.push(checksum);
      }
    }

    return checksums;
  }

  /**
   * 生成制品完整性清单 (SBOM 风格)
   */
  async generateIntegrityManifest(
    artifactDir: string,
    output?: string
  ): Promise<string> {
    const checksums = await this.computeDirectoryChecksums(artifactDir);

    const manifest = {
      version: '1.0',
      generatedAt: new Date().toISOString(),
      artifactDir,
      files: checksums.map(c => ({
        path: path.relative(artifactDir, c.filePath),
        size: c.size,
        sha256: c.algorithm === 'sha256' ? c.checksum : undefined,
        sha512: c.algorithm === 'sha512' ? c.checksum : undefined,
        md5: c.algorithm === 'md5' ? c.checksum : undefined,
      })),
    };

    const manifestContent = JSON.stringify(manifest, null, 2);

    if (output) {
      fs.writeFileSync(output, manifestContent);
    }

    return manifestContent;
  }
}
