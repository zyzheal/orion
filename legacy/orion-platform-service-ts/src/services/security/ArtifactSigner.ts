/**
 * ArtifactSigner - 制品签名服务
 */

import { createHash, createSign, createVerify } from 'crypto';
import { createLogger } from '../../utils/logger';

const logger = createLogger('artifact-signer');

export class ArtifactSigner {
  /**
   * 签名制品
   */
  async signArtifact(
    artifactId: string,
    privateKey: string,
    signedBy: string,
  ): Promise<{ signature: string; signatureType: string; signedAt: string }> {
    logger.info({ artifactId, signedBy }, '[ArtifactSigner] Signing artifact');
    const hash = this.generateHash(artifactId);
    const signer = createSign('sha256');
    signer.update(hash);
    signer.end();
    const signature = signer.sign(privateKey, 'base64');

    logger.info({ artifactId, signatureType: 'sha256' }, '[ArtifactSigner] Artifact signed successfully');

    return {
      signature,
      signatureType: 'sha256',
      signedAt: new Date().toISOString(),
    };
  }

  /**
   * 验证签名
   */
  async verifySignature(
    artifactId: string,
    signature: string,
    publicKey: string,
  ): Promise<boolean> {
    try {
      const hash = this.generateHash(artifactId);
      const verifier = createVerify('sha256');
      verifier.update(hash);
      verifier.end();
      const result = verifier.verify(publicKey, signature, 'base64');
      logger.info({ artifactId, verified: result }, '[ArtifactSigner] Signature verification completed');
      return result;
    } catch {
      logger.warn({ artifactId }, '[ArtifactSigner] Signature verification failed');
      return false;
    }
  }

  /**
   * 生成证书
   */
  generateCertificate(artifactId: string): string {
    const hash = this.generateHash(artifactId);
    return JSON.stringify({
      artifactId,
      hash,
      algorithm: 'SHA-256',
      generatedAt: new Date().toISOString(),
    });
  }

  private generateHash(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }
}
