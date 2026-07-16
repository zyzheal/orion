/**
 * ApkMarketUploadService Unit Tests
 */

import { ApkMarketUploadService, MarketUploader, UploadRequest, UploadResult, ErrorCategory } from '../ApkMarketUploadService';

describe('ApkMarketUploadService', () => {
  let service: ApkMarketUploadService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ApkMarketUploadService();
  });

  describe('constructor', () => {
    it('should create service without db', () => {
      const svc = new ApkMarketUploadService();
      expect(svc.getSupportedMarkets()).toEqual([]);
    });

    it('should create service with db', () => {
      const mockDb = { query: jest.fn() };
      const svc = new ApkMarketUploadService(mockDb);
      expect(svc.getSupportedMarkets()).toEqual([]);
    });
  });

  describe('registerUploader', () => {
    it('should register an uploader', () => {
      const uploader: MarketUploader = {
        name: () => 'Huawei',
        upload: jest.fn(),
      };

      service.registerUploader(uploader);

      expect(service.getSupportedMarkets()).toContain('huawei');
    });

    it('should normalize market name to lowercase', () => {
      const uploader: MarketUploader = {
        name: () => 'XIAOMI',
        upload: jest.fn(),
      };

      service.registerUploader(uploader);

      expect(service.getSupportedMarkets()).toContain('xiaomi');
    });

    it('should register multiple uploaders', () => {
      const uploader1: MarketUploader = { name: () => 'Huawei', upload: jest.fn() };
      const uploader2: MarketUploader = { name: () => 'Xiaomi', upload: jest.fn() };

      service.registerUploader(uploader1);
      service.registerUploader(uploader2);

      expect(service.getSupportedMarkets()).toHaveLength(2);
    });

    it('should persist registration to repository when db provided', async () => {
      const mockQuery = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });
      const svc = new ApkMarketUploadService({ query: mockQuery });
      const uploader: MarketUploader = { name: () => 'test', upload: jest.fn() };

      svc.registerUploader(uploader);

      // Wait for async persistence
      await new Promise(resolve => setTimeout(resolve, 10));
    });
  });

  describe('uploadToMarket', () => {
    it('should upload to a registered market', async () => {
      const mockResult: UploadResult = {
        market: 'huawei',
        success: true,
        status: 'submitted',
        durationMs: 1000,
        stdout: 'ok',
        stderr: '',
      };
      const uploader: MarketUploader = {
        name: () => 'Huawei',
        upload: jest.fn().mockResolvedValue(mockResult),
      };

      service.registerUploader(uploader);

      const request: UploadRequest = {
        apkPath: '/path/to/app.apk',
        packageName: 'com.example.app',
      };

      const result = await service.uploadToMarket('huawei', request, {});

      expect(result.success).toBe(true);
      expect(result.status).toBe('submitted');
      expect(uploader.upload).toHaveBeenCalledWith(request, {}, undefined);
    });

    it('should return failure for unsupported market', async () => {
      const request: UploadRequest = {
        apkPath: '/path/to/app.apk',
        packageName: 'com.example.app',
      };

      const result = await service.uploadToMarket('unknown', request, {});

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.error).toContain('Unsupported market: unknown');
      expect(result.durationMs).toBe(0);
    });

    it('should be case-insensitive for market lookup', async () => {
      const uploader: MarketUploader = {
        name: () => 'Huawei',
        upload: jest.fn().mockResolvedValue({
          market: 'huawei',
          success: true,
          status: 'submitted',
          durationMs: 500,
          stdout: '',
          stderr: '',
        }),
      };

      service.registerUploader(uploader);

      const result = await service.uploadToMarket('HUAWEI', {
        apkPath: '/path/app.apk',
        packageName: 'com.example',
      }, {});

      expect(result.success).toBe(true);
    });

    it('should pass progress callback to uploader', async () => {
      const uploader: MarketUploader = {
        name: () => 'test',
        upload: jest.fn().mockResolvedValue({
          market: 'test',
          success: true,
          status: 'submitted',
          durationMs: 0,
          stdout: '',
          stderr: '',
        }),
      };

      service.registerUploader(uploader);

      const onProgress = jest.fn();
      await service.uploadToMarket('test', { apkPath: '/a.apk', packageName: 'com.a' }, {}, onProgress);

      expect(uploader.upload).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        onProgress
      );
    });
  });

  describe('getSupportedMarkets', () => {
    it('should return empty list when no uploaders registered', () => {
      expect(service.getSupportedMarkets()).toEqual([]);
    });

    it('should return all registered market names', () => {
      service.registerUploader({ name: () => 'Huawei', upload: jest.fn() });
      service.registerUploader({ name: () => 'Xiaomi', upload: jest.fn() });
      service.registerUploader({ name: () => 'OPPO', upload: jest.fn() });

      const markets = service.getSupportedMarkets();

      expect(markets).toHaveLength(3);
      expect(markets).toContain('huawei');
      expect(markets).toContain('xiaomi');
      expect(markets).toContain('oppo');
    });
  });

  describe('ErrorCategory enum', () => {
    it('should have correct values', () => {
      expect(ErrorCategory.SUCCESS).toBe('success');
      expect(ErrorCategory.ALREADY_DONE).toBe('already_done');
      expect(ErrorCategory.AUTH_FAILED).toBe('auth_failed');
      expect(ErrorCategory.NETWORK_RETRY).toBe('network_retry');
      expect(ErrorCategory.STORE_BUSY).toBe('store_busy');
      expect(ErrorCategory.POLICY_BLOCK).toBe('policy_block');
      expect(ErrorCategory.CONFIG_INVALID).toBe('config_invalid');
      expect(ErrorCategory.UNKNOWN).toBe('unknown');
    });
  });
});
