/**
 * APK Market Uploaders - Unit Tests
 *
 * Coverage: name() methods for all uploaders, missing credentials error paths,
 *           error result formatting
 */

import {
  HuaweiUploader,
  XiaomiUploader,
  OppoUploader,
  VivoUploader,
  HonorUploader,
  TencentUploader,
  GooglePlayUploader,
  SamsungUploader,
  PgyerUploader,
  FirUploader,
} from '../apk-uploaders';

// Mock readFile for all uploaders
jest.mock('fs/promises', () => ({
  readFile: jest.fn().mockResolvedValue(Buffer.from('fake-apk-data')),
}));

// Mock global fetch
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

describe('APK Market Uploaders', () => {
  const sampleRequest = {
    apkPath: '/tmp/app.apk',
    packageName: 'com.example.app',
    changelog: 'Bug fixes',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({}),
    });
  });

  // ==================== name() methods ====================

  describe('name()', () => {
    it('HuaweiUploader returns huawei', () => {
      expect(new HuaweiUploader().name()).toBe('huawei');
    });

    it('XiaomiUploader returns xiaomi', () => {
      expect(new XiaomiUploader().name()).toBe('xiaomi');
    });

    it('OppoUploader returns oppo', () => {
      expect(new OppoUploader().name()).toBe('oppo');
    });

    it('VivoUploader returns vivo', () => {
      expect(new VivoUploader().name()).toBe('vivo');
    });

    it('HonorUploader returns honor', () => {
      expect(new HonorUploader().name()).toBe('honor');
    });

    it('TencentUploader returns tencent', () => {
      expect(new TencentUploader().name()).toBe('tencent');
    });

    it('GooglePlayUploader returns googleplay', () => {
      expect(new GooglePlayUploader().name()).toBe('googleplay');
    });

    it('SamsungUploader returns samsung', () => {
      expect(new SamsungUploader().name()).toBe('samsung');
    });

    it('PgyerUploader returns pgyer', () => {
      expect(new PgyerUploader().name()).toBe('pgyer');
    });

    it('FirUploader returns fir', () => {
      expect(new FirUploader().name()).toBe('fir');
    });
  });

  // ==================== Missing credentials ====================

  describe('missing credentials', () => {
    it('HuaweiUploader returns error when credentials missing', async () => {
      const result = await new HuaweiUploader().upload(sampleRequest, {});
      expect(result.success).toBe(false);
      expect(result.market).toBe('huawei');
      expect(result.error).toContain('Missing Huawei credentials');
      expect(result.status).toBe('failed');
    });

    it('XiaomiUploader returns error when credentials missing', async () => {
      const result = await new XiaomiUploader().upload(sampleRequest, {});
      expect(result.success).toBe(false);
      expect(result.market).toBe('xiaomi');
      expect(result.error).toContain('Missing Xiaomi credentials');
    });

    it('OppoUploader returns error when credentials missing', async () => {
      const result = await new OppoUploader().upload(sampleRequest, {});
      expect(result.success).toBe(false);
      expect(result.market).toBe('oppo');
      expect(result.error).toContain('Missing OPPO credentials');
    });

    it('VivoUploader returns error when credentials missing', async () => {
      const result = await new VivoUploader().upload(sampleRequest, {});
      expect(result.success).toBe(false);
      expect(result.market).toBe('vivo');
      expect(result.error).toContain('Missing VIVO credentials');
    });

    it('HonorUploader returns error when credentials missing', async () => {
      const result = await new HonorUploader().upload(sampleRequest, {});
      expect(result.success).toBe(false);
      expect(result.market).toBe('honor');
      expect(result.error).toContain('Missing Honor credentials');
    });

    it('TencentUploader returns error when credentials missing', async () => {
      const result = await new TencentUploader().upload(sampleRequest, {});
      expect(result.success).toBe(false);
      expect(result.market).toBe('tencent');
      expect(result.error).toContain('Missing Tencent credentials');
    });

    it('GooglePlayUploader returns error when credentials missing', async () => {
      const result = await new GooglePlayUploader().upload(sampleRequest, {});
      expect(result.success).toBe(false);
      expect(result.market).toBe('googleplay');
      expect(result.error).toContain('Missing Google Play credentials');
    });

    it('SamsungUploader returns error when credentials missing', async () => {
      const result = await new SamsungUploader().upload(sampleRequest, {});
      expect(result.success).toBe(false);
      expect(result.market).toBe('samsung');
      expect(result.error).toContain('Missing Samsung credentials');
    });

    it('PgyerUploader returns error when credentials missing', async () => {
      const result = await new PgyerUploader().upload(sampleRequest, {});
      expect(result.success).toBe(false);
      expect(result.market).toBe('pgyer');
      expect(result.error).toContain('Missing Pgyer credentials');
    });

    it('FirUploader returns error when credentials missing', async () => {
      const result = await new FirUploader().upload(sampleRequest, {});
      expect(result.success).toBe(false);
      expect(result.market).toBe('fir');
      expect(result.error).toContain('Missing fir.im credentials');
    });
  });

  // ==================== Error result format ====================

  describe('error result format', () => {
    it('should have consistent error result structure', async () => {
      const result = await new HuaweiUploader().upload(sampleRequest, {});

      expect(result).toMatchObject({
        market: 'huawei',
        success: false,
        status: 'failed',
        error: expect.any(String),
        durationMs: expect.any(Number),
        stdout: '',
        stderr: expect.any(String),
      });
    });

    it('should track duration', async () => {
      const result = await new HuaweiUploader().upload(sampleRequest, {});
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ==================== Huawei auth flow ====================

  describe('HuaweiUploader auth', () => {
    it('should fail with invalid credentials (no clientId or serviceAccount)', async () => {
      const result = await new HuaweiUploader().upload(sampleRequest, {
        huawei: { clientSecret: 'secret' } as any,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid Huawei credentials');
    });

    it('should fail when auth token request fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized',
      });

      const result = await new HuaweiUploader().upload(sampleRequest, {
        huawei: { clientId: 'id', clientSecret: 'secret' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should fail when service account assertion is missing', async () => {
      const result = await new HuaweiUploader().upload(sampleRequest, {
        huawei: { serviceAccount: {} } as any,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Service Account assertion is required');
    });
  });

  // ==================== Google Play auth flow ====================

  describe('GooglePlayUploader auth', () => {
    it('should fail when jsonKeyFile is missing', async () => {
      const result = await new GooglePlayUploader().upload(sampleRequest, {
        googleplay: { packageName: 'com.example' } as any,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ==================== Pgyer flow ====================

  describe('PgyerUploader', () => {
    it('should fail when COS token is invalid', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ data: {} }), // missing endpoint/key
      });

      const result = await new PgyerUploader().upload(sampleRequest, {
        pgyer: { apiKey: 'test-key' },
      });

      expect(result.success).toBe(false);
    });

    it('should succeed when COS token is valid', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            data: { endpoint: 'https://cos.example.com/upload', key: 'file-key' },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            code: 0,
            data: { buildReady: true, buildKey: 'abc123' },
          }),
        });

      const result = await new PgyerUploader().upload(sampleRequest, {
        pgyer: { apiKey: 'test-key' },
      });

      expect(result.success).toBe(true);
      expect(result.market).toBe('pgyer');
    });
  });
});
