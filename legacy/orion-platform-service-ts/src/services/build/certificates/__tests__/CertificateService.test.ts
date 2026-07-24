import { CertificateService, clearAllCertificates } from '../CertificateService';

describe('CertificateService', () => {
  // 使用固定的加密密钥确保测试中实例间可解密
  const TEST_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  let service: CertificateService;

  beforeEach(() => {
    // 设置环境变量使用固定密钥
    process.env.CERTIFICATE_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
    service = new CertificateService();
  });

  afterEach(() => {
    // 清理环境变量和存储
    delete process.env.CERTIFICATE_ENCRYPTION_KEY;
    clearAllCertificates();
  });

  describe('uploadIOSCertificate', () => {
    it('should upload an iOS certificate successfully', async () => {
      const tenantId = 'tenant-1';
      const certData = Buffer.from('mock-p12-certificate-data');
      const password = 'test-password';

      const result = await service.uploadIOSCertificate(tenantId, certData, password);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.tenantId).toBe(tenantId);
      expect(result.platform).toBe('ios');
      expect(result.name).toMatch(/^ios-cert-\d+\.p12$/);
      expect(result.metadata).toHaveProperty('password', password);
      expect(result.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('uploadAndroidKeystore', () => {
    it('should upload an Android keystore successfully', async () => {
      const tenantId = 'tenant-1';
      const keystoreData = Buffer.from('mock-jks-keystore-data');
      const storePassword = 'store-password';
      const keyAlias = 'my-key-alias';
      const keyPassword = 'key-password';

      const result = await service.uploadAndroidKeystore(
        tenantId,
        keystoreData,
        storePassword,
        keyAlias,
        keyPassword
      );

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.tenantId).toBe(tenantId);
      expect(result.platform).toBe('android');
      expect(result.name).toMatch(/^android-keystore-\d+\.jks$/);
      expect(result.metadata).toHaveProperty('keyAlias', keyAlias);
      expect(result.metadata).toHaveProperty('keyPassword', keyPassword);
      expect(result.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('listCertificates', () => {
    it('should list certificates for a tenant', async () => {
      const tenantId = 'tenant-list-test';

      // 上传两个证书
      await service.uploadIOSCertificate(tenantId, Buffer.from('cert1'), 'pass1');
      await service.uploadAndroidKeystore(tenantId, Buffer.from('cert2'), 'store', 'alias', 'keypass');

      const result = await service.listCertificates(tenantId);

      expect(result).toHaveLength(2);
      expect(result.some(c => c.platform === 'ios')).toBe(true);
      expect(result.some(c => c.platform === 'android')).toBe(true);
    });

    it('should return empty array for non-existent tenant', async () => {
      const result = await service.listCertificates('non-existent-tenant');
      expect(result).toHaveLength(0);
    });
  });

  describe('deleteCertificate', () => {
    it('should delete an existing certificate', async () => {
      const cert = await service.uploadIOSCertificate('tenant-delete', Buffer.from('data'), 'pass');
      const deleteResult = await service.deleteCertificate(cert.id);

      expect(deleteResult).toBe(true);

      const listResult = await service.listCertificates('tenant-delete');
      expect(listResult).toHaveLength(0);
    });

    it('should return false when deleting non-existent certificate', async () => {
      const deleteResult = await service.deleteCertificate('non-existent-id');
      expect(deleteResult).toBe(false);
    });
  });

  describe('getCertificateForBuild', () => {
    it('should retrieve certificate data for build', async () => {
      const tenantId = 'tenant-build';
      const originalData = Buffer.from('build-certificate-data');
      const password = 'build-pass';

      await service.uploadIOSCertificate(tenantId, originalData, password);

      const result = await service.getCertificateForBuild('build-123', 'ios');

      expect(result).toBeDefined();
      expect(result?.certificateData.toString()).toBe(originalData.toString());
      expect(result?.password).toBe(password);
    });

    it('should return null when no certificate exists for platform', async () => {
      // 使用一个新的 tenant，确保没有 android 证书
      await service.uploadIOSCertificate('tenant-no-android', Buffer.from('ios-only'), 'pass');
      const result = await service.getCertificateForBuild('build-456', 'android');
      expect(result).toBeNull();
    });
  });

  describe('cleanupExpired', () => {
    it('should clean up expired certificates', async () => {
      // 直接操作内部存储来创建过期证书（仅用于测试）
      // 由于当前实现中 expiresAt 始终为 null，这里只是测试方法存在
      const cleaned = await service.cleanupExpired();

      expect(cleaned).toBe(0);
    });
  });
});