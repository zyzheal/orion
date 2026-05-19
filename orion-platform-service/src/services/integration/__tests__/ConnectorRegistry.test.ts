/**
 * ConnectorRegistry Tests
 */

import {
  ConnectorRegistry,
  ConnectorCapability,
  Connector,
  ConnectorConfig,
  globalConnectorRegistry,
} from '../ConnectorRegistry';

describe('ConnectorRegistry', () => {
  let registry: ConnectorRegistry;

  // Mock connector for testing
  const createMockConnector = (name: string, capabilities: ConnectorCapability[]): Connector => ({
    name,
    version: '1.0.0',
    capabilities,
    initialize: jest.fn().mockResolvedValue(undefined),
    validateConfig: jest.fn().mockResolvedValue(true),
    testConnection: jest.fn().mockResolvedValue(true),
    execute: jest.fn().mockResolvedValue({ result: 'success' }),
    transformEvent: jest.fn().mockReturnValue({
      type: 'test:event',
      source: name,
      payload: {},
      timestamp: new Date(),
    }),
  });

  beforeEach(() => {
    registry = new ConnectorRegistry();
    // Clear global registry to prevent test pollution
    globalConnectorRegistry.clear();
  });

  describe('register', () => {
    it('should register a connector', () => {
      const connector = createMockConnector('test-provider', [
        ConnectorCapability.SourceControl,
      ]);
      registry.register(connector);
      expect(registry.has('test-provider')).toBe(true);
    });

    it('should throw when registering duplicate connector', () => {
      const connector = createMockConnector('duplicate-provider', [
        ConnectorCapability.SourceControl,
      ]);
      registry.register(connector);
      expect(() => registry.register(connector)).toThrow(
        "Connector with name 'duplicate-provider' is already registered"
      );
    });
  });

  describe('get', () => {
    it('should retrieve a registered connector', () => {
      const connector = createMockConnector('test-get', [
        ConnectorCapability.SourceControl,
      ]);
      registry.register(connector);
      const retrieved = registry.get('test-get');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('test-get');
    });

    it('should return undefined for unknown connector', () => {
      const result = registry.get('unknown-connector');
      expect(result).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return true for registered connector', () => {
      const connector = createMockConnector('test-has', [
        ConnectorCapability.SourceControl,
      ]);
      registry.register(connector);
      expect(registry.has('test-has')).toBe(true);
    });

    it('should return false for unregistered connector', () => {
      expect(registry.has('unregistered')).toBe(false);
    });
  });

  describe('getByCapability', () => {
    it('should return connectors with matching capability', () => {
      const gitlabConnector = createMockConnector('gitlab', [
        ConnectorCapability.SourceControl,
        ConnectorCapability.SourceRead,
        ConnectorCapability.CICD,
      ]);
      const jiraConnector = createMockConnector('jira', [
        ConnectorCapability.IssueTracker,
        ConnectorCapability.Notification,
      ]);
      const slackConnector = createMockConnector('slack', [
        ConnectorCapability.Notification,
      ]);

      registry.register(gitlabConnector);
      registry.register(jiraConnector);
      registry.register(slackConnector);

      const notificationConnectors = registry.getByCapability(
        ConnectorCapability.Notification
      );
      expect(notificationConnectors).toHaveLength(2);
      expect(notificationConnectors.map((c) => c.name)).toContain('jira');
      expect(notificationConnectors.map((c) => c.name)).toContain('slack');
    });

    it('should return empty array when no connectors match', () => {
      const connector = createMockConnector('test', [
        ConnectorCapability.SourceControl,
      ]);
      registry.register(connector);

      const result = registry.getByCapability(ConnectorCapability.Monitoring);
      expect(result).toHaveLength(0);
    });
  });

  describe('listAll', () => {
    it('should list all registered connectors', () => {
      const connector1 = createMockConnector('provider-1', [
        ConnectorCapability.SourceControl,
      ]);
      const connector2 = createMockConnector('provider-2', [
        ConnectorCapability.IssueTracker,
      ]);

      registry.register(connector1);
      registry.register(connector2);

      const list = registry.listAll();
      expect(list).toHaveLength(2);
      expect(list.map((c) => c.name)).toContain('provider-1');
      expect(list.map((c) => c.name)).toContain('provider-2');
    });

    it('should return empty array when no connectors registered', () => {
      const list = registry.listAll();
      expect(list).toHaveLength(0);
    });
  });

  describe('unregister', () => {
    it('should unregister a connector', () => {
      const connector = createMockConnector('test-unregister', [
        ConnectorCapability.SourceControl,
      ]);
      registry.register(connector);
      expect(registry.has('test-unregister')).toBe(true);

      const result = registry.unregister('test-unregister');
      expect(result).toBe(true);
      expect(registry.has('test-unregister')).toBe(false);
    });

    it('should return false when unregistering non-existent connector', () => {
      const result = registry.unregister('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all connectors', () => {
      const connector1 = createMockConnector('clear-1', [
        ConnectorCapability.SourceControl,
      ]);
      const connector2 = createMockConnector('clear-2', [
        ConnectorCapability.IssueTracker,
      ]);

      registry.register(connector1);
      registry.register(connector2);
      expect(registry.listAll()).toHaveLength(2);

      registry.clear();
      expect(registry.listAll()).toHaveLength(0);
    });
  });

  describe('Connector interface', () => {
    it('should call initialize on connector', async () => {
      const mockConnector = createMockConnector('test-init', [
        ConnectorCapability.SourceControl,
      ]);
      registry.register(mockConnector);

      const config: ConnectorConfig = { token: 'test-token' };
      const connector = registry.get('test-init');
      await connector?.initialize(config);

      expect(mockConnector.initialize).toHaveBeenCalledWith(config);
    });

    it('should call execute on connector', async () => {
      const mockConnector = createMockConnector('test-execute', [
        ConnectorCapability.SourceControl,
      ]);
      registry.register(mockConnector);

      const connector = registry.get('test-execute');
      const result = await connector?.execute('listProjects', { page: 1 });

      expect(mockConnector.execute).toHaveBeenCalledWith('listProjects', { page: 1 });
      expect(result).toEqual({ result: 'success' });
    });

    it('should transform events', () => {
      const mockConnector = createMockConnector('test-transform', [
        ConnectorCapability.SourceControl,
      ]);
      registry.register(mockConnector);

      const connector = registry.get('test-transform');
      const event = connector?.transformEvent?.({ object_kind: 'push' });

      expect(event).toBeDefined();
      expect(event?.source).toBe('test-transform');
      expect(event?.type).toBe('test:event');
    });
  });
});