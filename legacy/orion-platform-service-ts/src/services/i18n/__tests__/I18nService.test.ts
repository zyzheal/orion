/**
 * I18nService Tests
 */
import { I18nService } from '../I18nService';

jest.mock('../../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
  getCurrentTraceId: () => 'test-trace-id',
}));

const mockLocaleRepo = {
  create: jest.fn(),
  findByTenant: jest.fn(),
  findEnabled: jest.fn(),
};

const mockTranslationRepo = {
  upsertTranslation: jest.fn(),
  findByLocaleAndNamespace: jest.fn(),
  findByLocale: jest.fn(),
  delete: jest.fn(),
};

describe('I18nService', () => {
  let service: I18nService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Create service with mocked repos by intercepting constructor
    service = new I18nService({ query: jest.fn() } as any);
    (service as any).localeRepo = mockLocaleRepo;
    (service as any).translationRepo = mockTranslationRepo;
  });

  describe('createLocale', () => {
    it('should create a locale', async () => {
      mockLocaleRepo.create.mockResolvedValue({ id: 'l-1', locale_code: 'zh-CN' });
      const result = await service.createLocale({ localeCode: 'zh-CN', localeName: 'Chinese' });
      expect(mockLocaleRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        tenant_id: 'test-tenant', locale_code: 'zh-CN', enabled: true,
      }));
    });
  });

  describe('listLocales', () => {
    it('should return all locales for tenant', async () => {
      mockLocaleRepo.findByTenant.mockResolvedValue([{ id: 'l-1' }, { id: 'l-2' }]);
      const result = await service.listLocales();
      expect(result).toHaveLength(2);
    });
  });

  describe('listEnabledLocales', () => {
    it('should return only enabled locales', async () => {
      mockLocaleRepo.findEnabled.mockResolvedValue([{ id: 'l-1', enabled: true }]);
      const result = await service.listEnabledLocales();
      expect(result).toHaveLength(1);
    });
  });

  describe('setTranslation', () => {
    it('should upsert a translation', async () => {
      mockTranslationRepo.upsertTranslation.mockResolvedValue({ id: 't-1' });
      await service.setTranslation('zh-CN', 'common', 'hello', '你好');
      expect(mockTranslationRepo.upsertTranslation).toHaveBeenCalledWith(
        'test-tenant', 'zh-CN', 'common', 'hello', '你好',
      );
    });
  });

  describe('setBulkTranslations', () => {
    it('should set multiple translations', async () => {
      mockTranslationRepo.upsertTranslation.mockResolvedValue({});
      const count = await service.setBulkTranslations('zh-CN', 'common', { hello: '你好', bye: '再见' });
      expect(count).toBe(2);
      expect(mockTranslationRepo.upsertTranslation).toHaveBeenCalledTimes(2);
    });
  });

  describe('getTranslations', () => {
    it('should return key-value map', async () => {
      mockTranslationRepo.findByLocaleAndNamespace.mockResolvedValue([
        { key: 'hello', value: '你好' },
        { key: 'bye', value: '再见' },
      ]);
      const result = await service.getTranslations('zh-CN', 'common');
      expect(result).toEqual({ hello: '你好', bye: '再见' });
    });
  });

  describe('getAllTranslations', () => {
    it('should return namespace-grouped translations', async () => {
      mockTranslationRepo.findByLocale.mockResolvedValue([
        { namespace: 'common', key: 'hello', value: '你好' },
        { namespace: 'common', key: 'bye', value: '再见' },
        { namespace: 'admin', key: 'save', value: '保存' },
      ]);
      const result = await service.getAllTranslations('zh-CN');
      expect(result.common.hello).toBe('你好');
      expect(result.admin.save).toBe('保存');
    });
  });

  describe('deleteTranslation', () => {
    it('should delete when found', async () => {
      mockTranslationRepo.findByLocaleAndNamespace.mockResolvedValue([
        { id: 't-1', key: 'hello' },
      ]);
      const result = await service.deleteTranslation('zh-CN', 'common', 'hello');
      expect(result).toBe(true);
      expect(mockTranslationRepo.delete).toHaveBeenCalledWith('t-1');
    });

    it('should return false when not found', async () => {
      mockTranslationRepo.findByLocaleAndNamespace.mockResolvedValue([]);
      const result = await service.deleteTranslation('zh-CN', 'common', 'missing');
      expect(result).toBe(false);
    });
  });
});
