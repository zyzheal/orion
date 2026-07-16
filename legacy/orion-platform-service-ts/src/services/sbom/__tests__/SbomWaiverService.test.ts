/**
 * SbomWaiverService 单元测试
 */

import { SbomWaiverService, CreateWaiverInput } from '../SbomWaiverService';

// Mock repository
const mockWaiverRepo = {
  create: jest.fn(),
  findById: jest.fn(),
  findAll: jest.fn(),
  findByCveId: jest.fn(),
  findActive: jest.fn(),
  findExpired: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

describe('SbomWaiverService', () => {
  let service: SbomWaiverService;

  const futureDate = new Date(Date.now() + 86400000); // tomorrow
  const pastDate = new Date(Date.now() - 86400000); // yesterday

  const sampleWaiverInput: CreateWaiverInput = {
    cveId: 'CVE-2021-44228',
    packageName: 'log4j-core',
    packageVersion: '2.14.0',
    reason: 'Not exploitable in our context',
    approvedBy: 'security-team',
    expiresAt: futureDate,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SbomWaiverService();
    service.setRepository(mockWaiverRepo as any);
  });

  describe('constructor', () => {
    it('should create service without db', () => {
      const svc = new SbomWaiverService();
      expect(svc).toBeDefined();
    });

    it('should create service with db', () => {
      const mockDb = { query: jest.fn() };
      const svc = new SbomWaiverService(mockDb as any);
      expect(svc).toBeDefined();
    });
  });

  describe('setRepository', () => {
    it('should set repository', () => {
      const svc = new SbomWaiverService();
      svc.setRepository(mockWaiverRepo as any);
      expect(svc).toBeDefined();
    });
  });

  describe('create', () => {
    it('should create a waiver', async () => {
      const mockEntity = {
        id: 'waiver-1',
        cveId: 'CVE-2021-44228',
        packageName: 'log4j-core',
        packageVersion: '2.14.0',
        reason: 'Not exploitable in our context',
        approvedBy: 'security-team',
        approvedAt: new Date(),
        expiresAt: futureDate,
        scope: null,
        scopeTarget: null,
      };
      mockWaiverRepo.create.mockResolvedValue(mockEntity);

      const result = await service.create(sampleWaiverInput);

      expect(result.id).toBe('waiver-1');
      expect(result.cveId).toBe('CVE-2021-44228');
      expect(result.packageName).toBe('log4j-core');
      expect(mockWaiverRepo.create).toHaveBeenCalled();
    });

    it('should create waiver with scope', async () => {
      const mockEntity = {
        id: 'waiver-1',
        cveId: 'CVE-2021-44228',
        packageName: 'log4j-core',
        packageVersion: '2.14.0',
        reason: 'Not exploitable',
        approvedBy: 'security-team',
        approvedAt: new Date(),
        expiresAt: futureDate,
        scope: 'project',
        scopeTarget: 'orion-platform',
      };
      mockWaiverRepo.create.mockResolvedValue(mockEntity);

      const result = await service.create({
        ...sampleWaiverInput,
        scope: 'project',
        scopeTarget: 'orion-platform',
      });

      expect(result.scope).toBe('project');
      expect(result.scopeTarget).toBe('orion-platform');
    });

    it('should create mock waiver without repo', async () => {
      const svc = new SbomWaiverService();
      const result = await svc.create(sampleWaiverInput);

      expect(result.id).toBeDefined();
      expect(result.cveId).toBe('CVE-2021-44228');
      expect(result.approvedBy).toBe('security-team');
    });
  });

  describe('getById', () => {
    it('should get waiver by id', async () => {
      const mockWaiver = { id: 'waiver-1', cveId: 'CVE-2021-44228' };
      mockWaiverRepo.findById.mockResolvedValue(mockWaiver);

      const result = await service.getById('waiver-1');

      expect(result).toEqual(mockWaiver);
      expect(mockWaiverRepo.findById).toHaveBeenCalledWith('waiver-1');
    });

    it('should return null if not found', async () => {
      mockWaiverRepo.findById.mockResolvedValue(undefined);

      const result = await service.getById('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null without repo', async () => {
      const svc = new SbomWaiverService();
      const result = await svc.getById('waiver-1');
      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('should list all waivers', async () => {
      mockWaiverRepo.findAll.mockResolvedValue({
        entities: [
          { id: 'waiver-1', cveId: 'CVE-2021-44228' },
          { id: 'waiver-2', cveId: 'CVE-2021-45046' },
        ],
        total: 2,
      });

      const result = await service.list();

      expect(result.length).toBe(2);
    });

    it('should list active waivers', async () => {
      mockWaiverRepo.findActive.mockResolvedValue([
        { id: 'waiver-1', cveId: 'CVE-2021-44228', expiresAt: futureDate },
      ]);

      const result = await service.list({ active: true });

      expect(result.length).toBe(1);
      expect(mockWaiverRepo.findActive).toHaveBeenCalled();
    });

    it('should list waivers by cve id', async () => {
      mockWaiverRepo.findByCveId.mockResolvedValue([
        { id: 'waiver-1', cveId: 'CVE-2021-44228' },
      ]);

      const result = await service.list({ cveId: 'CVE-2021-44228' });

      expect(result.length).toBe(1);
      expect(mockWaiverRepo.findByCveId).toHaveBeenCalledWith('CVE-2021-44228');
    });

    it('should filter by scope', async () => {
      mockWaiverRepo.findAll.mockResolvedValue({
        entities: [
          { id: 'waiver-1', scope: 'project', scopeTarget: 'orion', expiresAt: futureDate },
          { id: 'waiver-2', scope: 'global', scopeTarget: null, expiresAt: futureDate },
        ],
        total: 2,
      });

      const result = await service.list({ scope: 'project' });

      expect(result.length).toBe(1);
      expect(result[0].scope).toBe('project');
    });

    it('should filter by scopeTarget', async () => {
      mockWaiverRepo.findAll.mockResolvedValue({
        entities: [
          { id: 'waiver-1', scope: 'project', scopeTarget: 'orion', expiresAt: futureDate },
          { id: 'waiver-2', scope: 'project', scopeTarget: 'other', expiresAt: futureDate },
        ],
        total: 2,
      });

      const result = await service.list({ scopeTarget: 'orion' });

      expect(result.length).toBe(1);
      expect(result[0].scopeTarget).toBe('orion');
    });

    it('should filter expired waivers when active is true', async () => {
      mockWaiverRepo.findActive.mockResolvedValue([
        { id: 'waiver-1', expiresAt: futureDate },
        { id: 'waiver-2', expiresAt: pastDate },
      ]);

      const result = await service.list({ active: true });

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('waiver-1');
    });

    it('should return empty array without repo', async () => {
      const svc = new SbomWaiverService();
      const result = await svc.list();
      expect(result).toEqual([]);
    });
  });

  describe('getActiveWaivers', () => {
    it('should get active waivers', async () => {
      mockWaiverRepo.findActive.mockResolvedValue([
        { id: 'waiver-1', scope: 'project', scopeTarget: 'orion', expiresAt: futureDate },
      ]);

      const result = await service.getActiveWaivers();

      expect(result.length).toBe(1);
      expect(mockWaiverRepo.findActive).toHaveBeenCalled();
    });

    it('should filter by scope', async () => {
      mockWaiverRepo.findActive.mockResolvedValue([
        { id: 'waiver-1', scope: 'project', scopeTarget: 'orion' },
        { id: 'waiver-2', scope: 'global', scopeTarget: null },
      ]);

      const result = await service.getActiveWaivers('project');

      expect(result.length).toBe(1);
      expect(result[0].scope).toBe('project');
    });

    it('should filter by target', async () => {
      mockWaiverRepo.findActive.mockResolvedValue([
        { id: 'waiver-1', scope: 'project', scopeTarget: 'orion' },
        { id: 'waiver-2', scope: 'project', scopeTarget: 'other' },
      ]);

      const result = await service.getActiveWaivers(undefined, 'orion');

      expect(result.length).toBe(1);
      expect(result[0].scopeTarget).toBe('orion');
    });

    it('should filter by both scope and target', async () => {
      mockWaiverRepo.findActive.mockResolvedValue([
        { id: 'waiver-1', scope: 'project', scopeTarget: 'orion' },
        { id: 'waiver-2', scope: 'project', scopeTarget: 'other' },
        { id: 'waiver-3', scope: 'global', scopeTarget: 'orion' },
      ]);

      const result = await service.getActiveWaivers('project', 'orion');

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('waiver-1');
    });

    it('should return empty array without repo', async () => {
      const svc = new SbomWaiverService();
      const result = await svc.getActiveWaivers();
      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update waiver', async () => {
      mockWaiverRepo.findById.mockResolvedValue({ id: 'waiver-1', reason: 'old reason' });
      mockWaiverRepo.update.mockResolvedValue(undefined);
      mockWaiverRepo.findById.mockResolvedValueOnce({ id: 'waiver-1', reason: 'old reason' });
      mockWaiverRepo.findById.mockResolvedValueOnce({ id: 'waiver-1', reason: 'new reason' });

      const result = await service.update('waiver-1', { reason: 'new reason' });

      expect(result).toBeDefined();
      expect(mockWaiverRepo.update).toHaveBeenCalledWith('waiver-1', { reason: 'new reason' });
    });

    it('should update expiresAt', async () => {
      const newExpiry = new Date(Date.now() + 172800000);
      mockWaiverRepo.findById.mockResolvedValue({ id: 'waiver-1', expiresAt: futureDate });
      mockWaiverRepo.update.mockResolvedValue(undefined);
      mockWaiverRepo.findById.mockResolvedValueOnce({ id: 'waiver-1', expiresAt: futureDate });
      mockWaiverRepo.findById.mockResolvedValueOnce({ id: 'waiver-1', expiresAt: newExpiry });

      const result = await service.update('waiver-1', { expiresAt: newExpiry });

      expect(result).toBeDefined();
      expect(mockWaiverRepo.update).toHaveBeenCalledWith('waiver-1', { expires_at: newExpiry });
    });

    it('should return null if waiver not found', async () => {
      mockWaiverRepo.findById.mockResolvedValue(undefined);

      const result = await service.update('nonexistent', { reason: 'new' });

      expect(result).toBeNull();
      expect(mockWaiverRepo.update).not.toHaveBeenCalled();
    });

    it('should not call update if no fields changed', async () => {
      mockWaiverRepo.findById.mockResolvedValue({ id: 'waiver-1' });
      mockWaiverRepo.findById.mockResolvedValueOnce({ id: 'waiver-1' });
      mockWaiverRepo.findById.mockResolvedValueOnce({ id: 'waiver-1' });

      const result = await service.update('waiver-1', {});

      expect(result).toBeDefined();
      expect(mockWaiverRepo.update).not.toHaveBeenCalled();
    });

    it('should return null without repo', async () => {
      const svc = new SbomWaiverService();
      const result = await svc.update('waiver-1', { reason: 'new' });
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete waiver', async () => {
      mockWaiverRepo.delete.mockResolvedValue(true);

      const result = await service.delete('waiver-1');

      expect(result).toBe(true);
      expect(mockWaiverRepo.delete).toHaveBeenCalledWith('waiver-1');
    });

    it('should return false if delete fails', async () => {
      mockWaiverRepo.delete.mockResolvedValue(false);

      const result = await service.delete('nonexistent');

      expect(result).toBe(false);
    });

    it('should return false without repo', async () => {
      const svc = new SbomWaiverService();
      const result = await svc.delete('waiver-1');
      expect(result).toBe(false);
    });
  });

  describe('checkWaiver', () => {
    it('should find matching waiver', async () => {
      mockWaiverRepo.findActive.mockResolvedValue([
        {
          id: 'waiver-1',
          cveId: 'CVE-2021-44228',
          packageName: 'log4j-core',
          packageVersion: '2.14.0',
          expiresAt: futureDate,
        },
      ]);

      const result = await service.checkWaiver('CVE-2021-44228', 'log4j-core', '2.14.0');

      expect(result.waived).toBe(true);
      expect(result.waiver).toBeDefined();
      expect(result.waiver!.id).toBe('waiver-1');
    });

    it('should find waiver with wildcard version', async () => {
      mockWaiverRepo.findActive.mockResolvedValue([
        {
          id: 'waiver-1',
          cveId: 'CVE-2021-44228',
          packageName: 'log4j-core',
          packageVersion: '*',
          expiresAt: futureDate,
        },
      ]);

      const result = await service.checkWaiver('CVE-2021-44228', 'log4j-core', '2.14.0');

      expect(result.waived).toBe(true);
    });

    it('should not find waiver for different cve', async () => {
      mockWaiverRepo.findActive.mockResolvedValue([
        {
          id: 'waiver-1',
          cveId: 'CVE-2021-44228',
          packageName: 'log4j-core',
          packageVersion: '2.14.0',
          expiresAt: futureDate,
        },
      ]);

      const result = await service.checkWaiver('CVE-2022-22965', 'log4j-core', '2.14.0');

      expect(result.waived).toBe(false);
      expect(result.waiver).toBeNull();
    });

    it('should not find waiver for different package', async () => {
      mockWaiverRepo.findActive.mockResolvedValue([
        {
          id: 'waiver-1',
          cveId: 'CVE-2021-44228',
          packageName: 'log4j-core',
          packageVersion: '2.14.0',
          expiresAt: futureDate,
        },
      ]);

      const result = await service.checkWaiver('CVE-2021-44228', 'spring-boot', '2.14.0');

      expect(result.waived).toBe(false);
    });

    it('should not find waiver for different version', async () => {
      mockWaiverRepo.findActive.mockResolvedValue([
        {
          id: 'waiver-1',
          cveId: 'CVE-2021-44228',
          packageName: 'log4j-core',
          packageVersion: '2.14.0',
          expiresAt: futureDate,
        },
      ]);

      const result = await service.checkWaiver('CVE-2021-44228', 'log4j-core', '2.15.0');

      expect(result.waived).toBe(false);
    });

    it('should return waived false when no active waivers', async () => {
      mockWaiverRepo.findActive.mockResolvedValue([]);

      const result = await service.checkWaiver('CVE-2021-44228', 'log4j-core', '2.14.0');

      expect(result.waived).toBe(false);
      expect(result.waiver).toBeNull();
    });
  });
});
