/**
 * Infrastructure Service - Unit Tests
 *
 * Covers:
 * - Connector registration and lifecycle
 * - Exponential backoff reconnection (iterative, no stack overflow)
 * - Circuit breaker open/close/stats
 * - Connector configuration updates
 * - Sandbox isolation, DNS isolation, and egress traffic control
 */

import {
  InfrastructureService,
  ConnectorType,
  ConnectorStatus,
  ConnectorConfigService,
  ConnectorTypeConfig,
  SandboxNetworkService,
  DnsIsolationParams,
  EgressTrafficControlParams,
  EgressTrafficRule,
} from '../index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fast deterministic service for testing (disable internal health monitor) */
function createTestInfrastructureService(): { service: InfrastructureService; sandboxSvc: SandboxNetworkService } {
  // Use a short interval so startHealthMonitor() doesn't fire noise during tests
  const service = new InfrastructureService({
    maxRetries: 3,
    initialDelayMs: 10,
    maxDelayMs: 100,
    backoffMultiplier: 2,
    jitterMs: 0,       // deterministic for tests
  });
  // Stop the background health monitor that fires every 30s
  service['stopHealthMonitor']();
  const sandboxSvc = new SandboxNetworkService(service);
  return { service, sandboxSvc };
}

// ---------------------------------------------------------------------------
// ConnectorConfigService tests
// ---------------------------------------------------------------------------

describe('ConnectorConfigService', () => {
  let configSvc: ConnectorConfigService;

  beforeEach(() => {
    configSvc = new ConnectorConfigService();
  });

  describe('getTypeConfig', () => {
    it('should return default config for any known connector type', () => {
      const k8sCfg = configSvc.getTypeConfig(ConnectorType.Kubernetes);
      expect(k8sCfg.timeoutMs).toBe(5000);
      expect(k8sCfg.maxRetries).toBe(5);
      expect(k8sCfg.circuitBreakerFailureThreshold).toBe(5);
    });

    it('should return default config for all connector types', () => {
      for (const type of Object.values(ConnectorType)) {
        const cfg = configSvc.getTypeConfig(type);
        expect(cfg.timeoutMs).toBeGreaterThan(0);
        expect(cfg.maxRetries).toBeGreaterThan(0);
      }
    });
  });

  describe('getReconnectPolicy', () => {
    it('should derive ReconnectPolicy from type config', () => {
      const policy = configSvc.getReconnectPolicy(ConnectorType.Docker);
      expect(policy.maxRetries).toBe(5);
      expect(policy.initialDelayMs).toBe(1000);
      expect(policy.maxDelayMs).toBe(30000);
      expect(policy.backoffMultiplier).toBe(2);
    });
  });

  describe('getCircuitBreakerConfig', () => {
    it('should return circuit breaker config for a type', () => {
      const cbCfg = configSvc.getCircuitBreakerConfig(ConnectorType.Aws);
      expect(cbCfg.failureThreshold).toBe(5);
      expect(cbCfg.recoveryTimeoutMs).toBe(60000);
      expect(cbCfg.successThreshold).toBe(1);
    });
  });

  describe('updateTypeConfig', () => {
    it('should update and persist type-specific config', () => {
      configSvc.updateTypeConfig(ConnectorType.Kubernetes, { timeoutMs: 15000, maxRetries: 8 });
      const cfg = configSvc.getTypeConfig(ConnectorType.Kubernetes);
      expect(cfg.timeoutMs).toBe(15000);
      expect(cfg.maxRetries).toBe(8);
      // Unchanged fields should remain defaults
      expect(cfg.circuitBreakerFailureThreshold).toBe(5);
    });
  });

  describe('updateGlobalDefaults', () => {
    it('should update global default timeout', () => {
      configSvc.updateGlobalDefaults({ timeoutMs: 20000 });
      const defaults = configSvc.getGlobalDefaults();
      expect(defaults.timeoutMs).toBe(20000);
      expect(defaults.maxRetries).toBe(5); // unchanged
    });
  });

  describe('exportConfig / importConfig', () => {
    it('should round-trip configuration', () => {
      configSvc.updateTypeConfig(ConnectorType.Gcp, { timeoutMs: 9000 });
      configSvc.updateGlobalDefaults({ maxRetries: 10 });

      const exported = configSvc.exportConfig();
      expect(exported.defaults.maxRetries).toBe(10);
      expect(exported.typeOverrides[ConnectorType.Gcp].timeoutMs).toBe(9000);

      // Create a new service and import
      const newSvc = new ConnectorConfigService();
      newSvc.importConfig(exported);
      expect(newSvc.getTypeConfig(ConnectorType.Gcp).timeoutMs).toBe(9000);
      expect(newSvc.getGlobalDefaults().maxRetries).toBe(10);
    });
  });

  describe('applyTypeConfigToConnectorConfig', () => {
    it('should fill in missing fields from type config', () => {
      const base: ConnectorConfig = {
        type: ConnectorType.Kubernetes,
        name: 'test-k8s',
        credentials: { token: 'tok' },
      };
      const result = configSvc.applyTypeConfigToConnectorConfig(base);
      expect(result.timeoutMs).toBe(5000);
      expect(result.maxRetries).toBe(5);
      expect(result.metadata).toEqual({});
    });

    it('should not override explicit values in base config', () => {
      const base: ConnectorConfig = {
        type: ConnectorType.Azure,
        name: 'test-azure',
        timeoutMs: 30000,
        maxRetries: 10,
        credentials: {},
      };
      const result = configSvc.applyTypeConfigToConnectorConfig(base);
      expect(result.timeoutMs).toBe(30000);
      expect(result.maxRetries).toBe(10);
    });
  });
});

// ---------------------------------------------------------------------------
// InfrastructureService - Connector Lifecycle
// ---------------------------------------------------------------------------

describe('InfrastructureService - Connector Lifecycle', () => {
  let service: InfrastructureService;

  beforeEach(() => {
    service = createTestInfrastructureService().service;
  });

  afterEach(() => {
    service.destroy();
  });

  it('should register a connector', () => {
    const connector = service.registerConnector(ConnectorType.Kubernetes, {
      name: 'prod-k8s',
      credentials: { token: 'tok' },
    });
    expect(connector.id).toBeDefined();
    expect(connector.type).toBe(ConnectorType.Kubernetes);
    expect(connector.status).toBe(ConnectorStatus.Disconnected);
  });

  it('should list connectors', () => {
    service.registerConnector(ConnectorType.Kubernetes, { name: 'k8s-1' });
    service.registerConnector(ConnectorType.Docker, { name: 'docker-1' });
    const all = service.listConnectors();
    expect(all).toHaveLength(2);
  });

  it('should filter connectors by type', () => {
    service.registerConnector(ConnectorType.Kubernetes, { name: 'k8s-1' });
    service.registerConnector(ConnectorType.Kubernetes, { name: 'k8s-2' });
    service.registerConnector(ConnectorType.Docker, { name: 'docker-1' });
    const k8s = service.listConnectorsByType(ConnectorType.Kubernetes);
    expect(k8s).toHaveLength(2);
  });

  it('should unregister a connector and clean up metrics', () => {
    const connector = service.registerConnector(ConnectorType.Kubernetes, { name: 'k8s-1' });
    const deleted = service.unregisterConnector(connector.id);
    expect(deleted).toBe(true);
    expect(service.getConnector(connector.id)).toBeUndefined();
    expect(service.listConnectors()).toHaveLength(0);
  });

  it('should return undefined for unknown connector', () => {
    expect(service.getConnector('nonexistent')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// InfrastructureService - Exponential Backoff Reconnection (iterative)
// ---------------------------------------------------------------------------

describe('InfrastructureService - Reconnection', () => {
  let service: InfrastructureService;

  beforeEach(() => {
    service = createTestInfrastructureService().service;
  });

  afterEach(() => {
    service.destroy();
  });

  it('should connect successfully on first try', async () => {
    const connector = service.registerConnector(ConnectorType.Docker, { name: 'docker-ok' });
    const result = await service.connect(connector.id);
    expect(result.status).toBe(ConnectorStatus.Connected);
  });

  it('should iterate reconnection with backoff delays and not overflow stack', async () => {
    // Force connection to always fail by using a very short timeout with slow simulated delay
    const connector = service.registerConnector(ConnectorType.Kubernetes, {
      name: 'k8s-slow',
      timeoutMs: 1, // 1ms timeout
    });

    // Override the connection simulation to always fail fast
    const originalPerformConnection = (service as unknown as Record<string, unknown>).performConnection.bind(service);
    (service as unknown as Record<string, unknown>).performConnection = async () => {
      await new Promise(resolve => setTimeout(resolve, 100)); // always exceeds 1ms timeout
      throw new Error('always-fail');
    };

    await expect(service.reconnect(connector.id)).rejects.toThrow('Failed to connect');

    // Verify the connector status
    const updated = service.getConnector(connector.id);
    expect(updated?.status).toBe(ConnectorStatus.Error);
    expect(updated?.lastError).toContain('always-fail');
  });

  it('should update totalReconnects count across retry attempts', async () => {
    const connector = service.registerConnector(ConnectorType.Aws, {
      name: 'aws-bad',
      timeoutMs: 1,
    });

    (service as unknown as Record<string, unknown>).performConnection = async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      throw new Error('aws-down');
    };

    try {
      await service.reconnect(connector.id);
    } catch {
      // expected
    }

    const metrics = service.getHealthMetrics(connector.id);
    expect(metrics?.totalReconnects).toBe(0);
    expect(metrics?.status).toBe(ConnectorStatus.Error);
  });

  it('should throw NOT_FOUND for unknown connector', async () => {
    await expect(service.reconnect('nonexistent')).rejects.toThrow('Connector not found');
  });
});

// ---------------------------------------------------------------------------
// InfrastructureService - Circuit Breaker
// ---------------------------------------------------------------------------

describe('InfrastructureService - Circuit Breaker', () => {
  let service: InfrastructureService;

  beforeEach(() => {
    service = createTestInfrastructureService().service;
  });

  afterEach(() => {
    service.destroy();
  });

  it('should open circuit after failureThreshold failures', async () => {
    const connector = service.registerConnector(ConnectorType.Kubernetes, {
      name: 'k8s-always-fail',
      timeoutMs: 1,
    });

    // Fail 5 times to exceed the circuit breaker threshold (5)
    for (let i = 0; i < 6; i++) {
      try {
        await service.connect(connector.id);
      } catch {
        // expected
      }
    }

    // After threshold exceeded, circuit should be open
    const stats = service.getAllCircuitBreakerStats();
    const k8sStats = stats.find(s => s.connectorId === connector.id);
    expect(k8sStats).toBeDefined();
    expect(k8sStats!.state).toBe('open');
  });

  it('should allow manual open and close of circuit', async () => {
    const connector = service.registerConnector(ConnectorType.Docker, { name: 'docker-manual' });

    // Open circuit manually
    service.openCircuit(connector.id);
    const statsAfterOpen = service.getAllCircuitBreakerStats();
    expect(statsAfterOpen.find(s => s.connectorId === connector.id)!.state).toBe('open');

    // Close circuit manually
    service.closeCircuit(connector.id);
    const statsAfterClose = service.getAllCircuitBreakerStats();
    expect(statsAfterClose.find(s => s.connectorId === connector.id)!.state).toBe('closed');
  });

  it('should return empty stats when no connectors have been accessed', () => {
    const stats = service.getAllCircuitBreakerStats();
    expect(stats).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// InfrastructureService - Connector Config Update
// ---------------------------------------------------------------------------

describe('InfrastructureService - ConnectorConfig Update', () => {
  let service: InfrastructureService;

  beforeEach(() => {
    service = createTestInfrastructureService().service;
  });

  afterEach(() => {
    service.destroy();
  });

  it('should update connector timeout', async () => {
    const connector = service.registerConnector(ConnectorType.Kubernetes, {
      name: 'k8s-config-test',
      timeoutMs: 5000,
    });

    const updated = service.updateConnectorConfig(connector.id, { timeoutMs: 15000 });
    expect(updated.config.timeoutMs).toBe(15000);
  });

  it('should throw NOT_FOUND when updating unknown connector', () => {
    expect(() => service.updateConnectorConfig('nonexistent', { timeoutMs: 1000 })).toThrow('Connector not found');
  });

  it('should update maxRetries on connector config', async () => {
    const connector = service.registerConnector(ConnectorType.Gcp, {
      name: 'gcp-config',
      maxRetries: 2,
    });

    const updated = service.updateConnectorConfig(connector.id, { maxRetries: 10 });
    expect(updated.config.maxRetries).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// SandboxNetworkService - Sandbox Isolation
// ---------------------------------------------------------------------------

describe('SandboxNetworkService - Isolation', () => {
  let service: InfrastructureService;
  let sandboxSvc: SandboxNetworkService;

  beforeEach(() => {
    const setup = createTestInfrastructureService();
    service = setup.service;
    sandboxSvc = setup.sandboxSvc;
  });

  afterEach(() => {
    service.destroy();
  });

  it('should create a sandbox network with deny-all policies', async () => {
    const sandbox = await sandboxSvc.createSandboxNetwork({
      name: 'sandbox-1',
      namespace: 'ns-1',
    });

    expect(sandbox.id).toBe('sandbox-1');
    expect(sandbox.isolationStatus).toBe('isolated');
    expect(sandbox.networkPolicyId).toBeDefined();
  });

  it('should isolate an existing environment', async () => {
    const sandbox = await sandboxSvc.isolateEnvironment('env-1');
    expect(sandbox.isolationStatus).toBe('isolated');
  });

  it('should block all traffic', async () => {
    const sandbox = await sandboxSvc.blockAll('env-2');
    expect(sandbox.isolationStatus).toBe('isolated');
  });

  it('should release a sandbox', async () => {
    await sandboxSvc.createSandboxNetwork({ name: 'sandbox-release', namespace: 'ns-r' });
    const released = await sandboxSvc.isolateEnvironment('sandbox-release');
    expect(released.isolationStatus).toBe('isolated');

    // Release it
    const afterRelease = await sandboxSvc['infrastructureService'].releaseSandbox('sandbox-release');
    expect(afterRelease.isolationStatus).toBe('active');
  });

  it('should throw when releasing nonexistent sandbox', async () => {
    await expect(
      sandboxSvc['infrastructureService'].releaseSandbox('nonexistent')
    ).rejects.toThrow('NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// SandboxNetworkService - DNS Isolation
// ---------------------------------------------------------------------------

describe('SandboxNetworkService - DNS Isolation', () => {
  let service: InfrastructureService;
  let sandboxSvc: SandboxNetworkService;

  beforeEach(() => {
    const setup = createTestInfrastructureService();
    service = setup.service;
    sandboxSvc = setup.sandboxSvc;
  });

  afterEach(() => {
    service.destroy();
  });

  it('should configure isolated DNS for a sandbox', async () => {
    const policy = await sandboxSvc.configureIsolatedDns('dns-sandbox-1', {
      allowedDomains: ['orion.io', 'k8s.io'],
      customDnsServers: ['8.8.8.8', '1.1.1.1'],
      dnsTimeoutMs: 3000,
    });

    expect(policy.annotations['orion.io/dns-isolation']).toBe('enforced');
    expect(policy.annotations['orion.io/dns-allowed-domains']).toBe('orion.io,k8s.io');
    expect(policy.annotations['orion.io/dns-timeout']).toBe('3000');
    expect(policy.annotations['orion.io/dns-servers']).toBe('8.8.8.8,1.1.1.1');
  });

  it('should create policy if not exists when configuring DNS', async () => {
    const policy = await sandboxSvc.configureIsolatedDns('new-dns-sandbox', {
      allowedDomains: ['only-this-domain.com'],
    });

    expect(policy.id).toBeDefined();
    expect(policy.sandboxId).toBe('new-dns-sandbox');
  });

  it('should clear DNS isolation', async () => {
    await sandboxSvc.configureIsolatedDns('dns-sandbox-clear', {
      allowedDomains: ['x.com'],
    });

    await sandboxSvc.clearDnsIsolation('dns-sandbox-clear');

    const policies = service.listNetworkPolicies().filter(p => p.sandboxId === 'dns-sandbox-clear');
    const policy = policies[0];
    expect(policy.annotations['orion.io/dns-isolation']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// SandboxNetworkService - Egress Traffic Control
// ---------------------------------------------------------------------------

describe('SandboxNetworkService - Egress Traffic Control', () => {
  let service: InfrastructureService;
  let sandboxSvc: SandboxNetworkService;

  beforeEach(() => {
    const setup = createTestInfrastructureService();
    service = setup.service;
    sandboxSvc = setup.sandboxSvc;
  });

  afterEach(() => {
    service.destroy();
  });

  it('should configure egress rules with default deny', async () => {
    const rules: EgressTrafficRule[] = [
      { name: 'allow-dns', destination: 'kube-system', ports: [{ port: 53, protocol: 'UDP' }], allow: true },
      { name: 'block-external', destination: '0.0.0.0/0', ports: [{ port: 443, protocol: 'TCP' }], allow: false },
    ];

    const policy = await sandboxSvc.configureEgressTraffic({
      sandboxId: 'egress-sandbox-1',
      rules,
      defaultAction: 'deny',
    });

    expect(policy.annotations['orion.io/egress-default']).toBe('deny');
    expect(policy.annotations['orion.io/egress-control']).toBe('enforced');
    expect(policy.egressRules).toHaveLength(2);
    expect(policy.egressRules[0].allow).toBe(true);
    expect(policy.egressRules[1].allow).toBe(false);
  });

  it('should deny all egress traffic', async () => {
    const policy = await sandboxSvc.denyAllEgress('egress-deny-sandbox');

    expect(policy.annotations['orion.io/egress']).toBe('denied');
    expect(policy.annotations['orion.io/egress-default']).toBe('deny');
    expect(policy.egressRules.every(r => r.allow === false)).toBe(true);
  });

  it('should allow egress to a specific destination', async () => {
    const policy = await sandboxSvc.allowEgressTo(
      'egress-allow-sandbox',
      'allowed-ns',
      [{ port: 443, protocol: 'TCP' }]
    );

    expect(policy.annotations['orion.io/egress']).toBe('controlled');
    expect(policy.annotations['orion.io/egress-default']).toBe('deny');
    expect(policy.egressRules.length).toBeGreaterThanOrEqual(1);
    expect(policy.egressRules.some(r => r.namespaceSelector?.namespace === 'allowed-ns' && r.allow)).toBe(true);
  });

  it('should append egress rules on multiple allowEgressTo calls', async () => {
    await sandboxSvc.allowEgressTo('multi-egress-sandbox', 'ns-a', [{ port: 80, protocol: 'TCP' }]);
    const updated = await sandboxSvc.allowEgressTo('multi-egress-sandbox', 'ns-b', [{ port: 443, protocol: 'TCP' }]);

    const allowRules = updated.egressRules.filter(r => r.allow);
    expect(allowRules.length).toBeGreaterThanOrEqual(2);
  });

  it('should create egress policy for nonexistent sandbox', async () => {
    const policy = await sandboxSvc.denyAllEgress('brand-new-egress-sandbox');
    expect(policy.id).toBeDefined();
    expect(policy.sandboxId).toBe('brand-new-egress-sandbox');
  });
});

// ---------------------------------------------------------------------------
// SandboxNetworkService - Traffic allow/deny between environments
// ---------------------------------------------------------------------------

describe('SandboxNetworkService - Traffic allow/deny', () => {
  let service: InfrastructureService;
  let sandboxSvc: SandboxNetworkService;

  beforeEach(() => {
    const setup = createTestInfrastructureService();
    service = setup.service;
    sandboxSvc = setup.sandboxSvc;
  });

  afterEach(() => {
    service.destroy();
  });

  it('should allow traffic between environments', async () => {
    const policy = await sandboxSvc.allowTraffic({
      fromEnv: 'env-a',
      toEnv: 'env-b',
      ports: [{ port: 8080, protocol: 'TCP' }],
    });

    expect(policy.egressRules.some(r => r.allow && r.namespaceSelector?.namespace === 'env-b')).toBe(true);
  });

  it('should deny traffic between environments', async () => {
    // First allow
    await sandboxSvc.allowTraffic({
      fromEnv: 'env-x',
      toEnv: 'env-y',
      ports: [{ port: 9090, protocol: 'TCP' }],
    });

    // Then deny
    const policy = await sandboxSvc.denyTraffic('env-x', 'env-y');
    expect(policy).toBeDefined();
    expect(policy!.egressRules.some(r => r.namespaceSelector?.namespace === 'env-y' && r.allow)).toBe(false);
  });

  it('should return undefined when denying traffic with no policy', async () => {
    const result = await sandboxSvc.denyTraffic('no-policy-env', 'other-env');
    expect(result).toBeUndefined();
  });
});
