import * as crypto from 'crypto';

export interface Certificate {
  id: string;
  tenantId: string;
  platform: 'ios' | 'android';
  name: string;
  expiresAt: Date | null;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface CertificateResult {
  certificateData: Buffer;
  password?: string;
  keyAlias?: string;
}

// 内存存储（生产环境应使用数据库）
const certificates = new Map<string, Certificate & { encryptedData: Buffer }>();

// 清空所有证书（仅用于测试）
export function clearAllCertificates(): void {
  certificates.clear();
}

export class CertificateService {
  private readonly ENCRYPTION_KEY: Buffer;

  constructor() {
    const keyEnv = process.env.CERTIFICATE_ENCRYPTION_KEY;
    this.ENCRYPTION_KEY = keyEnv
      ? Buffer.from(keyEnv, 'hex')
      : crypto.randomBytes(32);
  }

  async uploadIOSCertificate(
    tenantId: string,
    data: Buffer,
    password: string
  ): Promise<Certificate> {
    const id = this.generateId();
    const encryptedData = this.encrypt(data);

    const cert: Certificate & { encryptedData: Buffer } = {
      id,
      tenantId,
      platform: 'ios',
      name: `ios-cert-${Date.now()}.p12`,
      expiresAt: null,
      metadata: { password },
      createdAt: new Date(),
      encryptedData,
    };

    certificates.set(id, cert);
    return this.toPublicCert(cert);
  }

  async uploadAndroidKeystore(
    tenantId: string,
    data: Buffer,
    storePassword: string,
    keyAlias: string,
    keyPassword: string
  ): Promise<Certificate> {
    const id = this.generateId();
    const encryptedData = this.encrypt(data);

    const cert: Certificate & { encryptedData: Buffer } = {
      id,
      tenantId,
      platform: 'android',
      name: `android-keystore-${Date.now()}.jks`,
      expiresAt: null,
      metadata: { keyAlias, keyPassword },
      createdAt: new Date(),
      encryptedData,
    };

    certificates.set(id, cert);
    return this.toPublicCert(cert);
  }

  async getCertificateForBuild(
    buildId: string,
    platform: 'ios' | 'android'
  ): Promise<CertificateResult | null> {
    for (const cert of certificates.values()) {
      if (cert.platform === platform) {
        const decrypted = this.decrypt(cert.encryptedData);
        return {
          certificateData: decrypted,
          password: cert.metadata.password,
          keyAlias: cert.metadata.keyAlias,
        };
      }
    }
    return null;
  }

  async listCertificates(tenantId: string): Promise<Certificate[]> {
    const result: Certificate[] = [];
    for (const cert of certificates.values()) {
      if (cert.tenantId === tenantId) {
        result.push(this.toPublicCert(cert));
      }
    }
    return result;
  }

  async deleteCertificate(id: string): Promise<boolean> {
    return certificates.delete(id);
  }

  async cleanupExpired(): Promise<number> {
    let cleaned = 0;
    const now = new Date();
    for (const [id, cert] of certificates.entries()) {
      if (cert.expiresAt && cert.expiresAt < now) {
        certificates.delete(id);
        cleaned++;
      }
    }
    return cleaned;
  }

  private generateId(): string {
    return crypto.randomUUID();
  }

  private encrypt(data: Buffer): Buffer {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.ENCRYPTION_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    return Buffer.concat([iv, encrypted]);
  }

  private decrypt(encryptedData: Buffer): Buffer {
    const iv = encryptedData.subarray(0, 16);
    const data = encryptedData.subarray(16);
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.ENCRYPTION_KEY, iv);
    return Buffer.concat([decipher.update(data), decipher.final()]);
  }

  private toPublicCert(cert: Certificate & { encryptedData: Buffer }): Certificate {
    const { encryptedData, ...publicCert } = cert;
    return publicCert;
  }
}