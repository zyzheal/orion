/**
 * CapabilityMappingService 单元测试
 *
 * 测试命令-Capability 映射管理：CRUD、审批配置、审批人管理。
 */

// Mock uuid to return predictable values
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-1234'),
}));

// Mock pino logger
jest.mock('pino', () => {
  return jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  });
});

import { CapabilityMappingService } from '../CapabilityMappingService';

describe('CapabilityMappingService', () => {
  let service: CapabilityMappingService;
  let mockPool: any;

  const sampleMapping = {
    id: 'map-1',
    command_id: 'cmd-1',
    capability_id: 'cap-deploy',
    environment: 'production',
    risk_level: 3,
    requires_approval: true,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
  };

  const sampleApprovalConfig = {
    id: 'ac-1',
    capability: 'deploy',
    enabled: true,
    approvers: '["user-1", "user-2"]',
    threshold: 2,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool = {
      query: jest.fn(),
    };
    service = new CapabilityMappingService(mockPool);
  });

  describe('constructor', () => {
    it('should create service with pool', () => {
      expect(service).toBeDefined();
    });
  });

  // ==================== Mapping CRUD ====================

  describe('getAllMappings', () => {
    it('should return all mappings', async () => {
      mockPool.query.mockResolvedValue({ rows: [sampleMapping] });

      const result = await service.getAllMappings();

      expect(result).toHaveLength(1);
      expect(result[0].command_id).toBe('cmd-1');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM chatops_capability_mappings'),
        [],
      );
    });

    it('should filter by environment', async () => {
      mockPool.query.mockResolvedValue({ rows: [sampleMapping] });

      await service.getAllMappings('production');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE environment = $1 OR environment IS NULL'),
        ['production'],
      );
    });
  });

  describe('getMappingById', () => {
    it('should return mapping by id', async () => {
      mockPool.query.mockResolvedValue({ rows: [sampleMapping] });

      const result = await service.getMappingById('map-1');

      expect(result).toBeDefined();
      expect(result!.id).toBe('map-1');
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.getMappingById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('createMapping', () => {
    it('should create mapping and return result', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.createMapping({
        command_id: 'cmd-1',
        capability_id: 'cap-deploy',
        risk_level: 3,
        requires_approval: true,
      });

      expect(result.id).toBe('mock-uuid-1234');
      expect(result.command_id).toBe('cmd-1');
      expect(result.capability_id).toBe('cap-deploy');
      expect(result.risk_level).toBe(3);
      expect(result.requires_approval).toBe(true);
    });

    it('should use null environment when not provided', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await service.createMapping({
        command_id: 'cmd-1',
        capability_id: 'cap-deploy',
        risk_level: 1,
        requires_approval: false,
      });

      const params = mockPool.query.mock.calls[0][1];
      expect(params[3]).toBeNull(); // environment
    });

    it('should pass environment when provided', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await service.createMapping({
        command_id: 'cmd-1',
        capability_id: 'cap-deploy',
        environment: 'staging',
        risk_level: 1,
        requires_approval: false,
      });

      const params = mockPool.query.mock.calls[0][1];
      expect(params[3]).toBe('staging');
    });
  });

  describe('updateMapping', () => {
    it('should return null when mapping not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.updateMapping('nonexistent', { risk_level: 5 });

      expect(result).toBeNull();
    });

    it('should return existing when no changes provided', async () => {
      mockPool.query.mockResolvedValue({ rows: [sampleMapping] });

      const result = await service.updateMapping('map-1', {});

      expect(result).toBeDefined();
      expect(result!.id).toBe('map-1');
    });

    it('should update risk_level', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [sampleMapping] }) // getMappingById
        .mockResolvedValueOnce({ rows: [] }) // update query
        .mockResolvedValueOnce({ rows: [{ ...sampleMapping, risk_level: 5 }] }); // re-fetch

      const result = await service.updateMapping('map-1', { risk_level: 5 });

      expect(result!.risk_level).toBe(5);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE chatops_capability_mappings SET'),
        expect.arrayContaining([5]),
      );
    });

    it('should update multiple fields', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [sampleMapping] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ ...sampleMapping, risk_level: 1, requires_approval: false }] });

      const result = await service.updateMapping('map-1', {
        risk_level: 1,
        requires_approval: false,
      });

      expect(result!.risk_level).toBe(1);
      expect(result!.requires_approval).toBe(false);
    });
  });

  describe('deleteMapping', () => {
    it('should return true when deleted', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 1 });

      const result = await service.deleteMapping('map-1');

      expect(result).toBe(true);
    });

    it('should return false when not found', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0 });

      const result = await service.deleteMapping('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('getMappingForCommand', () => {
    it('should prefer environment-specific mapping', async () => {
      mockPool.query.mockResolvedValue({ rows: [sampleMapping] });

      const result = await service.getMappingForCommand('cmd-1', 'production');

      expect(result).toBeDefined();
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE command_id = $1 AND environment = $2'),
        ['cmd-1', 'production'],
      );
    });

    it('should fall back to null environment mapping', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // environment-specific
        .mockResolvedValueOnce({ rows: [sampleMapping] }); // null environment

      const result = await service.getMappingForCommand('cmd-1', 'staging');

      expect(result).toBeDefined();
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('environment IS NULL'),
        ['cmd-1'],
      );
    });

    it('should return null when no mapping found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.getMappingForCommand('cmd-1', 'staging');

      expect(result).toBeNull();
    });

    it('should query null environment directly when no environment specified', async () => {
      mockPool.query.mockResolvedValue({ rows: [sampleMapping] });

      await service.getMappingForCommand('cmd-1');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('environment IS NULL'),
        ['cmd-1'],
      );
    });
  });

  // ==================== Approval Config ====================

  describe('getAllApprovalConfigs', () => {
    it('should return all approval configs', async () => {
      mockPool.query.mockResolvedValue({ rows: [sampleApprovalConfig] });

      const result = await service.getAllApprovalConfigs();

      expect(result).toHaveLength(1);
      expect(result[0].capability).toBe('deploy');
    });
  });

  describe('getApprovalConfigByCapability', () => {
    it('should return config by capability', async () => {
      mockPool.query.mockResolvedValue({ rows: [sampleApprovalConfig] });

      const result = await service.getApprovalConfigByCapability('deploy');

      expect(result).toBeDefined();
      expect(result!.capability).toBe('deploy');
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.getApprovalConfigByCapability('unknown');

      expect(result).toBeNull();
    });
  });

  describe('updateApprovalConfigs', () => {
    it('should update existing config', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [sampleApprovalConfig] }) // findByCapability
        .mockResolvedValueOnce({ rows: [] }) // update
        .mockResolvedValueOnce({ rows: [{ ...sampleApprovalConfig, enabled: false }] }); // re-fetch

      const result = await service.updateApprovalConfigs([
        { capability: 'deploy', enabled: false, approvers: ['user-1'], threshold: 1 },
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].enabled).toBe(false);
    });

    it('should create new config when not exists', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // findByCapability - not found
        .mockResolvedValueOnce({ rows: [] }) // insert
        .mockResolvedValueOnce({ rows: [{ ...sampleApprovalConfig, capability: 'restart' }] }); // re-fetch

      const result = await service.updateApprovalConfigs([
        { capability: 'restart', enabled: true, approvers: ['user-1'], threshold: 1 },
      ]);

      expect(result).toHaveLength(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO chatops_approval_configs'),
        expect.any(Array),
      );
    });
  });

  describe('updateApprovalConfig', () => {
    it('should return null when capability not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.updateApprovalConfig('unknown', { enabled: false });

      expect(result).toBeNull();
    });

    it('should return existing when no changes provided', async () => {
      mockPool.query.mockResolvedValue({ rows: [sampleApprovalConfig] });

      const result = await service.updateApprovalConfig('deploy', {});

      expect(result).toBeDefined();
      expect(result!.capability).toBe('deploy');
    });

    it('should update enabled field', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [sampleApprovalConfig] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ ...sampleApprovalConfig, enabled: false }] });

      const result = await service.updateApprovalConfig('deploy', { enabled: false });

      expect(result!.enabled).toBe(false);
    });

    it('should update approvers field', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [sampleApprovalConfig] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [sampleApprovalConfig] });

      await service.updateApprovalConfig('deploy', { approvers: ['user-3'] });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('approvers'),
        expect.arrayContaining([JSON.stringify(['user-3'])]),
      );
    });

    it('should update threshold field', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [sampleApprovalConfig] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [sampleApprovalConfig] });

      await service.updateApprovalConfig('deploy', { threshold: 5 });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE chatops_approval_configs'),
        expect.arrayContaining([5]),
      );
    });
  });

  describe('getApprovers', () => {
    it('should return list of approvers', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { user_id: 'user-1', username: 'admin', role: 'admin' },
          { user_id: 'user-2', username: 'approver1', role: 'approver' },
        ],
      });

      const result = await service.getApprovers();

      expect(result).toHaveLength(2);
      expect(result[0].username).toBe('admin');
    });
  });

  describe('getApproverSchedule', () => {
    it('should return schedule', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'sched-1', user_id: 'user-1' }] });

      const result = await service.getApproverSchedule();

      expect(result).toHaveLength(1);
    });
  });

  describe('updateApproverSchedule', () => {
    it('should clear and re-insert schedule', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await service.updateApproverSchedule([
        { user_id: 'user-1', start_time: '2024-01-01', end_time: '2024-01-02' },
      ]);

      expect(mockPool.query).toHaveBeenCalledWith('DELETE FROM chatops_approver_schedule');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO chatops_approver_schedule'),
        expect.any(Array),
      );
    });
  });

  describe('getGlobalApprovalConfig', () => {
    it('should return config from DB', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ value: '{"enabled":true,"mode":"all"}' }],
      });

      const result = await service.getGlobalApprovalConfig();

      expect(result.enabled).toBe(true);
      expect(result.mode).toBe('all');
    });

    it('should return default when no config exists', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.getGlobalApprovalConfig();

      expect(result.enabled).toBe(false);
      expect(result.mode).toBe('any');
    });
  });

  describe('updateGlobalApprovalConfig', () => {
    it('should upsert global config', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await service.updateGlobalApprovalConfig({ enabled: true, mode: 'all' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        [JSON.stringify({ enabled: true, mode: 'all' })],
      );
    });
  });
});
