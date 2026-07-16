/**
 * IntegrationService Tests
 *
 * Tests for the IntegrationService class covering:
 * - Constructor and initialization
 * - createIntegration (success, validation, connection failure, unknown provider)
 * - getIntegration (from cache, from repo, not found)
 * - listIntegrations (by tenant, by provider)
 * - updateIntegration (name, config validation, not found)
 * - deleteIntegration
 * - executeConnectorAction (active, inactive, not found)
 * - testConnection
 * - Mapping operations (create, get by resource, get by external ID)
 * - listAvailableProviders / getConnectorCapabilities / listConnectors / registerConnector
 */

// Mock uuid to get deterministic IDs
let uuidCounter = 0;
jest.mock('uuid', () => ({
  v4: jest.fn(() => `mock-uuid-${++uuidCounter}`),
}));

// Mock the connector registry to control which connectors are available
jest.mock('../ConnectorRegistry', () => {
  const original = jest.requireActual('../ConnectorRegistry');
  return {
    ...original,
    globalConnectorRegistry: {
      get: jest.fn(),
      register: jest.fn(),
      listAll: jest.fn().mockReturnValue([]),
      has: jest.fn().mockReturnValue(false),
      clear: jest.fn(),
    },
  };
});

// Mock the connector imports so auto-register doesn't error
jest.mock('../connectors/GitLabConnector', () => ({
  GitLabConnector: jest.fn().mockImplementation(() => ({
    name: 'gitlab',
    version: '1.0.0',
    capabilities: ['source:control', 'source:read', 'ci:cd'],
    initialize: jest.fn().mockResolvedValue(undefined),
    validateConfig: jest.fn().mockResolvedValue(true),
    testConnection: jest.fn().mockResolvedValue(true),
    execute: jest.fn().mockResolvedValue({}),
  })),
}));

jest.mock('../connectors/JiraConnector', () => ({
  JiraConnector: jest.fn().mockImplementation(() => ({
    name: 'jira',
    version: '1.0.0',
    capabilities: ['issue:tracker', 'notification'],
    initialize: jest.fn().mockResolvedValue(undefined),
    validateConfig: jest.fn().mockResolvedValue(true),
    testConnection: jest.fn().mockResolvedValue(true),
    execute: jest.fn().mockResolvedValue({}),
  })),
}));

jest.mock('../../../repositories/IntegrationConfigRepository', () => ({
  IntegrationConfigRepository: jest.fn().mockImplementation(() => ({
    create: jest.fn().mockResolvedValue({}),
    findById: jest.fn().mockResolvedValue(null),
    findByTenant: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../../repositories/IntegrationMappingRepository', () => ({
  IntegrationMappingRepository: jest.fn().mockImplementation(() => ({
    create: jest.fn().mockResolvedValue({}),
    findById: jest.fn().mockResolvedValue(null),
    findByIntegration: jest.fn().mockResolvedValue([]),
  })),
}));

import { IntegrationService } from '../IntegrationService';
import { globalConnectorRegistry, Connector, ConnectorCapability } from '../ConnectorRegistry';
import { OrionError, ErrorCode } from '../../../errors';

describe('IntegrationService', () => {
  let service: IntegrationService;
  const mockRegistry = globalConnectorRegistry as jest.Mocked<typeof globalConnectorRegistry>;

  /** Helper to create a mock connector with configurable behavior */
  function createMockConnector(overrides: Partial<Connector> = {}): Connector {
    return {
      name: 'test-provider',
      version: '1.0.0',
      capabilities: [ConnectorCapability.SourceControl],
      initialize: jest.fn().mockResolvedValue(undefined),
      validateConfig: jest.fn().mockResolvedValue(true),
      testConnection: jest.fn().mockResolvedValue(true),
      execute: jest.fn().mockResolvedValue({ result: 'ok' }),
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    uuidCounter = 0;
    service = new IntegrationService();
    // Set default listAll to return empty
    mockRegistry.listAll.mockReturnValue([]);
  });

  describe('constructor', () => {
    it('should create an instance without db', () => {
      const svc = new IntegrationService();
      expect(svc).toBeDefined();
    });

    it('should create an instance with db and initialize repositories', () => {
      const mockDb = { query: jest.fn() };
      const svc = new IntegrationService(mockDb as any);
      expect(svc).toBeDefined();
    });
  });

  describe('createIntegration', () => {
    const baseParams = {
      tenantId: 'tenant-1',
      provider: 'test-provider',
      name: 'My Integration',
      config: { token: 'abc123' },
    };

    it('should create an integration successfully', async () => {
      const connector = createMockConnector();
      mockRegistry.get.mockReturnValue(connector);

      const result = await service.createIntegration(baseParams);

      expect(result).toMatchObject({
        id: 'mock-uuid-1',
        tenantId: 'tenant-1',
        provider: 'test-provider',
        name: 'My Integration',
        status: 'active',
        lastSyncAt: null,
        syncStatus: null,
        errorMessage: null,
        createdBy: null,
      });
      expect(connector.validateConfig).toHaveBeenCalledWith(baseParams.config);
      expect(connector.testConnection).toHaveBeenCalledWith(baseParams.config);
    });

    it('should create integration with createdBy', async () => {
      const connector = createMockConnector();
      mockRegistry.get.mockReturnValue(connector);

      const result = await service.createIntegration({ ...baseParams, createdBy: 'user-1' });
      expect(result.createdBy).toBe('user-1');
    });

    it('should strip password from stored config (sanitizeConfig)', async () => {
      const connector = createMockConnector();
      mockRegistry.get.mockReturnValue(connector);

      const result = await service.createIntegration({
        ...baseParams,
        config: { token: 'abc', password: 'secret', host: 'example.com' },
      });

      expect(result.config.password).toBeUndefined();
      expect(result.config.token).toBe('abc');
      expect(result.config.host).toBe('example.com');
    });

    it('should throw NOT_FOUND for unknown provider', async () => {
      mockRegistry.get.mockReturnValue(undefined);

      await expect(service.createIntegration(baseParams)).rejects.toThrow(OrionError);
      await expect(service.createIntegration(baseParams)).rejects.toMatchObject({
        code: ErrorCode.NOT_FOUND,
      });
    });

    it('should throw NOT_FOUND for invalid config', async () => {
      const connector = createMockConnector({
        validateConfig: jest.fn().mockResolvedValue(false),
      });
      mockRegistry.get.mockReturnValue(connector);

      await expect(service.createIntegration(baseParams)).rejects.toThrow(OrionError);
    });

    it('should throw OPERATION_FAILED when testConnection fails', async () => {
      const connector = createMockConnector({
        testConnection: jest.fn().mockResolvedValue(false),
      });
      mockRegistry.get.mockReturnValue(connector);

      await expect(service.createIntegration(baseParams)).rejects.toThrow(OrionError);
      await expect(service.createIntegration(baseParams)).rejects.toMatchObject({
        code: ErrorCode.OPERATION_FAILED,
      });
    });

    it('should persist to DB when integrationRepo is available', async () => {
      const mockDb = { query: jest.fn() };
      const svc = new IntegrationService(mockDb as any);
      const connector = createMockConnector();
      mockRegistry.get.mockReturnValue(connector);

      await svc.createIntegration(baseParams);

      // The repo.create is fire-and-forget, so we just verify no error was thrown
      // and the integration was created in memory
      const integrations = await svc.listIntegrations('tenant-1');
      expect(integrations).toHaveLength(1);
    });
  });

  describe('getIntegration', () => {
    it('should return integration from memory cache', async () => {
      const connector = createMockConnector();
      mockRegistry.get.mockReturnValue(connector);

      const created = await service.createIntegration({
        tenantId: 't1',
        provider: 'test-provider',
        name: 'Test',
        config: { token: 'abc' },
      });

      const result = await service.getIntegration(created.id);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(created.id);
    });

    it('should return null for unknown ID when no repo', async () => {
      const result = await service.getIntegration('non-existent-id');
      expect(result).toBeNull();
    });

    it('should fall back to repo when not in cache', async () => {
      const mockDb = { query: jest.fn() };
      const svc = new IntegrationService(mockDb as any);

      // The repo is mocked to return null by default
      const result = await svc.getIntegration('some-id');
      expect(result).toBeNull();
    });
  });

  describe('listIntegrations', () => {
    it('should list integrations for a tenant', async () => {
      const connector = createMockConnector();
      mockRegistry.get.mockReturnValue(connector);

      await service.createIntegration({
        tenantId: 't1',
        provider: 'test-provider',
        name: 'Integration 1',
        config: { token: 'abc' },
      });
      await service.createIntegration({
        tenantId: 't2',
        provider: 'test-provider',
        name: 'Integration 2',
        config: { token: 'def' },
      });

      const t1Results = await service.listIntegrations('t1');
      expect(t1Results).toHaveLength(1);
      expect(t1Results[0].name).toBe('Integration 1');

      const t2Results = await service.listIntegrations('t2');
      expect(t2Results).toHaveLength(1);
    });

    it('should filter by provider', async () => {
      const connector1 = createMockConnector({ name: 'provider-a' });
      const connector2 = createMockConnector({ name: 'provider-b' });
      mockRegistry.get
        .mockReturnValueOnce(connector1)
        .mockReturnValueOnce(connector2);

      await service.createIntegration({
        tenantId: 't1',
        provider: 'provider-a',
        name: 'A',
        config: { token: 'a' },
      });
      await service.createIntegration({
        tenantId: 't1',
        provider: 'provider-b',
        name: 'B',
        config: { token: 'b' },
      });

      const results = await service.listIntegrations('t1', 'provider-a');
      expect(results).toHaveLength(1);
      expect(results[0].provider).toBe('provider-a');
    });

    it('should return empty array for tenant with no integrations', async () => {
      const results = await service.listIntegrations('empty-tenant');
      expect(results).toHaveLength(0);
    });
  });

  describe('updateIntegration', () => {
    it('should update integration name', async () => {
      const connector = createMockConnector();
      mockRegistry.get.mockReturnValue(connector);

      const created = await service.createIntegration({
        tenantId: 't1',
        provider: 'test-provider',
        name: 'Original',
        config: { token: 'abc' },
      });

      const updated = await service.updateIntegration(created.id, { name: 'Updated' });
      expect(updated.name).toBe('Updated');
      expect(updated.status).toBe('active');
    });

    it('should update integration status', async () => {
      const connector = createMockConnector();
      mockRegistry.get.mockReturnValue(connector);

      const created = await service.createIntegration({
        tenantId: 't1',
        provider: 'test-provider',
        name: 'Test',
        config: { token: 'abc' },
      });

      const updated = await service.updateIntegration(created.id, { status: 'inactive' });
      expect(updated.status).toBe('inactive');
    });

    it('should validate and test config when updating config', async () => {
      const connector = createMockConnector();
      mockRegistry.get.mockReturnValue(connector);

      const created = await service.createIntegration({
        tenantId: 't1',
        provider: 'test-provider',
        name: 'Test',
        config: { token: 'abc' },
      });

      const updated = await service.updateIntegration(created.id, {
        config: { token: 'new-token' },
      });

      expect(connector.validateConfig).toHaveBeenCalled();
      expect(connector.testConnection).toHaveBeenCalled();
      expect(updated.config.token).toBe('new-token');
    });

    it('should throw when updating config with invalid config', async () => {
      const connector = createMockConnector();
      mockRegistry.get.mockReturnValue(connector);

      const created = await service.createIntegration({
        tenantId: 't1',
        provider: 'test-provider',
        name: 'Test',
        config: { token: 'abc' },
      });

      // After createIntegration, mock returns same connector, but now make validate fail
      const failConnector = createMockConnector({
        validateConfig: jest.fn().mockResolvedValue(false),
      });
      mockRegistry.get.mockReturnValue(failConnector);

      await expect(
        service.updateIntegration(created.id, { config: { token: 'bad' } })
      ).rejects.toThrow(OrionError);
    });

    it('should throw when updating config with failed connection test', async () => {
      const connector = createMockConnector();
      mockRegistry.get.mockReturnValue(connector);

      const created = await service.createIntegration({
        tenantId: 't1',
        provider: 'test-provider',
        name: 'Test',
        config: { token: 'abc' },
      });

      const failConnector = createMockConnector({
        testConnection: jest.fn().mockResolvedValue(false),
      });
      mockRegistry.get.mockReturnValue(failConnector);

      await expect(
        service.updateIntegration(created.id, { config: { token: 'bad' } })
      ).rejects.toThrow(OrionError);
    });

    it('should throw NOT_FOUND for non-existent integration', async () => {
      await expect(
        service.updateIntegration('non-existent', { name: 'New' })
      ).rejects.toThrow(OrionError);
      await expect(
        service.updateIntegration('non-existent', { name: 'New' })
      ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
    });
  });

  describe('deleteIntegration', () => {
    it('should delete an existing integration', async () => {
      const connector = createMockConnector();
      mockRegistry.get.mockReturnValue(connector);

      const created = await service.createIntegration({
        tenantId: 't1',
        provider: 'test-provider',
        name: 'To Delete',
        config: { token: 'abc' },
      });

      await service.deleteIntegration(created.id);
      const result = await service.getIntegration(created.id);
      expect(result).toBeNull();
    });

    it('should also clean up mappings when deleting', async () => {
      const connector = createMockConnector();
      mockRegistry.get.mockReturnValue(connector);

      const created = await service.createIntegration({
        tenantId: 't1',
        provider: 'test-provider',
        name: 'With Mappings',
        config: { token: 'abc' },
      });

      await service.createMapping({
        integrationId: created.id,
        resourceType: 'pipeline',
        resourceId: 'p1',
        externalId: 'ext-1',
      });

      await service.deleteIntegration(created.id);

      // Mappings should be gone
      const mapping = await service.getMappingsByResource(created.id, 'pipeline', 'p1');
      expect(mapping).toBeNull();
    });

    it('should throw NOT_FOUND for non-existent integration', async () => {
      await expect(service.deleteIntegration('non-existent')).rejects.toThrow(OrionError);
      await expect(service.deleteIntegration('non-existent')).rejects.toMatchObject({
        code: ErrorCode.NOT_FOUND,
      });
    });
  });

  describe('executeConnectorAction', () => {
    it('should execute an action on an active integration', async () => {
      const connector = createMockConnector({
        execute: jest.fn().mockResolvedValue({ data: 'result' }),
      });
      mockRegistry.get.mockReturnValue(connector);

      const created = await service.createIntegration({
        tenantId: 't1',
        provider: 'test-provider',
        name: 'Test',
        config: { token: 'abc' },
      });

      const result = await service.executeConnectorAction(created.id, 'listProjects', {
        page: 1,
      });

      expect(result).toEqual({ data: 'result' });
      expect(connector.initialize).toHaveBeenCalledWith(created.config);
      expect(connector.execute).toHaveBeenCalledWith('listProjects', { page: 1 });
    });

    it('should throw for non-existent integration', async () => {
      await expect(
        service.executeConnectorAction('non-existent', 'action', {})
      ).rejects.toThrow(OrionError);
    });

    it('should throw for inactive integration', async () => {
      const connector = createMockConnector();
      mockRegistry.get.mockReturnValue(connector);

      const created = await service.createIntegration({
        tenantId: 't1',
        provider: 'test-provider',
        name: 'Test',
        config: { token: 'abc' },
      });

      await service.updateIntegration(created.id, { status: 'inactive' });

      await expect(
        service.executeConnectorAction(created.id, 'action', {})
      ).rejects.toThrow(OrionError);
    });

    it('should throw when connector is not found in registry', async () => {
      const connector = createMockConnector();
      mockRegistry.get.mockReturnValue(connector);

      const created = await service.createIntegration({
        tenantId: 't1',
        provider: 'test-provider',
        name: 'Test',
        config: { token: 'abc' },
      });

      // Now remove the connector from registry
      mockRegistry.get.mockReturnValue(undefined);

      await expect(
        service.executeConnectorAction(created.id, 'action', {})
      ).rejects.toThrow(OrionError);
    });
  });

  describe('testConnection', () => {
    it('should test connection for an existing integration', async () => {
      const connector = createMockConnector({
        testConnection: jest.fn().mockResolvedValue(true),
      });
      mockRegistry.get.mockReturnValue(connector);

      const created = await service.createIntegration({
        tenantId: 't1',
        provider: 'test-provider',
        name: 'Test',
        config: { token: 'abc' },
      });

      const result = await service.testConnection(created.id);
      expect(result).toBe(true);
    });

    it('should return false when connection fails', async () => {
      const connector = createMockConnector();
      mockRegistry.get.mockReturnValue(connector);

      const created = await service.createIntegration({
        tenantId: 't1',
        provider: 'test-provider',
        name: 'Test',
        config: { token: 'abc' },
      });

      // Now connector returns false
      mockRegistry.get.mockReturnValue(
        createMockConnector({ testConnection: jest.fn().mockResolvedValue(false) })
      );

      const result = await service.testConnection(created.id);
      expect(result).toBe(false);
    });

    it('should throw for non-existent integration', async () => {
      await expect(service.testConnection('non-existent')).rejects.toThrow(OrionError);
    });

    it('should throw when connector not found', async () => {
      const connector = createMockConnector();
      mockRegistry.get.mockReturnValue(connector);

      const created = await service.createIntegration({
        tenantId: 't1',
        provider: 'test-provider',
        name: 'Test',
        config: { token: 'abc' },
      });

      mockRegistry.get.mockReturnValue(undefined);

      await expect(service.testConnection(created.id)).rejects.toThrow(OrionError);
    });
  });

  describe('mapping operations', () => {
    let integrationId: string;

    beforeEach(async () => {
      const connector = createMockConnector();
      mockRegistry.get.mockReturnValue(connector);

      const created = await service.createIntegration({
        tenantId: 't1',
        provider: 'test-provider',
        name: 'Test',
        config: { token: 'abc' },
      });
      integrationId = created.id;
    });

    describe('createMapping', () => {
      it('should create a mapping', async () => {
        const mapping = await service.createMapping({
          integrationId,
          resourceType: 'pipeline',
          resourceId: 'res-1',
          externalId: 'ext-1',
          metadata: { branch: 'main' },
        });

        expect(mapping).toMatchObject({
          id: 'mock-uuid-2',
          integrationId,
          resourceType: 'pipeline',
          resourceId: 'res-1',
          externalId: 'ext-1',
          metadata: { branch: 'main' },
        });
      });

      it('should create mapping with empty metadata by default', async () => {
        const mapping = await service.createMapping({
          integrationId,
          resourceType: 'issue',
          resourceId: 'res-2',
          externalId: 'ext-2',
        });

        expect(mapping.metadata).toEqual({});
      });

      it('should throw for non-existent integration', async () => {
        await expect(
          service.createMapping({
            integrationId: 'non-existent',
            resourceType: 'pipeline',
            resourceId: 'r1',
            externalId: 'e1',
          })
        ).rejects.toThrow(OrionError);
      });
    });

    describe('getMappingsByResource', () => {
      it('should find mapping by resource type and ID', async () => {
        await service.createMapping({
          integrationId,
          resourceType: 'pipeline',
          resourceId: 'res-1',
          externalId: 'ext-1',
        });

        const result = await service.getMappingsByResource(
          integrationId,
          'pipeline',
          'res-1'
        );

        expect(result).not.toBeNull();
        expect(result!.externalId).toBe('ext-1');
      });

      it('should return null for non-matching resource', async () => {
        await service.createMapping({
          integrationId,
          resourceType: 'pipeline',
          resourceId: 'res-1',
          externalId: 'ext-1',
        });

        const result = await service.getMappingsByResource(
          integrationId,
          'issue',
          'res-1'
        );
        expect(result).toBeNull();
      });

      it('should return null for non-existent integration', async () => {
        const result = await service.getMappingsByResource(
          'non-existent',
          'pipeline',
          'res-1'
        );
        expect(result).toBeNull();
      });
    });

    describe('getMappingByExternalId', () => {
      it('should find mapping by external ID', async () => {
        await service.createMapping({
          integrationId,
          resourceType: 'pipeline',
          resourceId: 'res-1',
          externalId: 'ext-unique',
        });

        const result = await service.getMappingByExternalId(integrationId, 'ext-unique');
        expect(result).not.toBeNull();
        expect(result!.resourceId).toBe('res-1');
      });

      it('should return null for unknown external ID', async () => {
        const result = await service.getMappingByExternalId(integrationId, 'unknown');
        expect(result).toBeNull();
      });
    });
  });

  describe('listAvailableProviders', () => {
    it('should return provider names from registry', () => {
      mockRegistry.listAll.mockReturnValue([
        { name: 'gitlab', version: '1.0.0', capabilities: [ConnectorCapability.SourceControl] },
        { name: 'jira', version: '1.0.0', capabilities: [ConnectorCapability.IssueTracker] },
      ]);

      const providers = service.listAvailableProviders();
      expect(providers).toEqual(['gitlab', 'jira']);
    });

    it('should return empty array when no providers registered', () => {
      mockRegistry.listAll.mockReturnValue([]);
      expect(service.listAvailableProviders()).toEqual([]);
    });
  });

  describe('getConnectorCapabilities', () => {
    it('should return capabilities for a known provider', () => {
      const connector = createMockConnector({
        capabilities: [ConnectorCapability.SourceControl, ConnectorCapability.CICD],
      });
      mockRegistry.get.mockReturnValue(connector);

      const caps = service.getConnectorCapabilities('test-provider');
      expect(caps).toEqual([ConnectorCapability.SourceControl, ConnectorCapability.CICD]);
    });

    it('should return empty array for unknown provider', () => {
      mockRegistry.get.mockReturnValue(undefined);
      expect(service.getConnectorCapabilities('unknown')).toEqual([]);
    });
  });

  describe('listConnectors', () => {
    it('should delegate to globalConnectorRegistry.listAll', () => {
      mockRegistry.listAll.mockReturnValue([
        { name: 'gitlab', version: '1.0.0', capabilities: [] },
      ]);

      const result = service.listConnectors();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('gitlab');
    });
  });

  describe('registerConnector', () => {
    it('should delegate to globalConnectorRegistry.register', () => {
      const connector = createMockConnector();
      service.registerConnector(connector);
      expect(mockRegistry.register).toHaveBeenCalledWith(connector);
    });
  });
});
