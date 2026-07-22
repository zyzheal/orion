/**
 * ArtifactSigner - Unit Tests
 *
 * Tests for artifact signing, verification, and certificate generation.
 */

import { ArtifactSigner } from '../ArtifactSigner';
import { generateKeyPairSync } from 'crypto';

describe('ArtifactSigner', () => {
  let signer: ArtifactSigner;
  let publicKey: string;
  let privateKey: string;

  beforeAll(() => {
    const keys = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    publicKey = keys.publicKey;
    privateKey = keys.privateKey;
  });

  beforeEach(() => {
    signer = new ArtifactSigner();
  });

  // ==================== signArtifact ====================

  describe('signArtifact', () => {
    it('should sign an artifact and return signature', async () => {
      const result = await signer.signArtifact('artifact-123', privateKey, 'user-1');

      expect(result.signature).toBeDefined();
      expect(typeof result.signature).toBe('string');
      expect(result.signatureType).toBe('sha256');
      expect(result.signedAt).toBeDefined();
    });

    it('should produce different signatures for different artifacts', async () => {
      const sig1 = await signer.signArtifact('artifact-1', privateKey, 'user-1');
      const sig2 = await signer.signArtifact('artifact-2', privateKey, 'user-1');

      expect(sig1.signature).not.toBe(sig2.signature);
    });

    it('should produce consistent signatures for the same artifact', async () => {
      const sig1 = await signer.signArtifact('artifact-123', privateKey, 'user-1');
      const sig2 = await signer.signArtifact('artifact-123', privateKey, 'user-1');

      expect(sig1.signature).toBe(sig2.signature);
    });

    it('should include valid ISO timestamp in signedAt', async () => {
      const result = await signer.signArtifact('artifact-123', privateKey, 'user-1');

      const parsed = new Date(result.signedAt);
      expect(parsed.getTime()).not.toBeNaN();
    });
  });

  // ==================== verifySignature ====================

  describe('verifySignature', () => {
    it('should verify a valid signature', async () => {
      const signed = await signer.signArtifact('artifact-123', privateKey, 'user-1');
      const valid = await signer.verifySignature('artifact-123', signed.signature, publicKey);

      expect(valid).toBe(true);
    });

    it('should reject signature for different artifact', async () => {
      const signed = await signer.signArtifact('artifact-123', privateKey, 'user-1');
      const valid = await signer.verifySignature('artifact-456', signed.signature, publicKey);

      expect(valid).toBe(false);
    });

    it('should reject tampered signature', async () => {
      const signed = await signer.signArtifact('artifact-123', privateKey, 'user-1');
      const tampered = signed.signature.slice(0, -4) + 'XXXX';
      const valid = await signer.verifySignature('artifact-123', tampered, publicKey);

      expect(valid).toBe(false);
    });

    it('should reject signature with wrong public key', async () => {
      const otherKeys = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });

      const signed = await signer.signArtifact('artifact-123', privateKey, 'user-1');
      const valid = await signer.verifySignature('artifact-123', signed.signature, otherKeys.publicKey);

      expect(valid).toBe(false);
    });

    it('should return false for completely invalid signature', async () => {
      const valid = await signer.verifySignature('artifact-123', 'not-a-valid-signature', publicKey);

      expect(valid).toBe(false);
    });
  });

  // ==================== generateCertificate ====================

  describe('generateCertificate', () => {
    it('should generate a valid JSON certificate', () => {
      const cert = signer.generateCertificate('artifact-123');
      const parsed = JSON.parse(cert);

      expect(parsed.artifactId).toBe('artifact-123');
      expect(parsed.hash).toBeDefined();
      expect(parsed.algorithm).toBe('SHA-256');
      expect(parsed.generatedAt).toBeDefined();
    });

    it('should produce consistent hash for same artifact', () => {
      const cert1 = JSON.parse(signer.generateCertificate('artifact-123'));
      const cert2 = JSON.parse(signer.generateCertificate('artifact-123'));

      expect(cert1.hash).toBe(cert2.hash);
    });

    it('should produce different hashes for different artifacts', () => {
      const cert1 = JSON.parse(signer.generateCertificate('artifact-1'));
      const cert2 = JSON.parse(signer.generateCertificate('artifact-2'));

      expect(cert1.hash).not.toBe(cert2.hash);
    });
  });
});
