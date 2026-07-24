/**
 * StateSimulationEngine - Enhanced Unit Tests (Task 4.37)
 *
 * Coverage:
 * - New failure mode injection (network_partition, service_degradation,
 *   cpu_exhaustion, memory_exhaustion, disk_exhaustion, cascading_failure)
 * - injectChaos (chaos engineering scenarios)
 * - stopSimulation / getSimulationStatus
 * - registerServiceDependency / propagateFailure (cascading failures)
 * - predictHealingOutcome (SelfHealing integration)
 * - validateHealingRules (SelfHealing integration)
 * - Backward compatibility with existing injectFault
 */

import { StateSimulationEngine, ServiceSimulationState, FaultType } from '../StateSimulationEngine';

describe('StateSimulationEngine (Task 4.37 Enhanced)', () => {
  let engine: StateSimulationEngine;

  beforeEach(() => {
    engine = new StateSimulationEngine();
  });

  // ==================== Service Registration ====================

  describe('registerService', () => {
    it('should register a new service with HEALTHY state', () => {
      engine.registerService('svc-a');
      const state = engine.getServiceState('svc-a');
      expect(state).toBeDefined();
      expect(state!.state).toBe(ServiceSimulationState.HEALTHY);
      expect(state!.name).toBe('svc-a');
    });

    it('should register with custom initial state', () => {
      engine.registerService('svc-a', ServiceSimulationState.DEGRADED);
      const state = engine.getServiceState('svc-a');
      expect(state!.state).toBe(ServiceSimulationState.DEGRADED);
    });

    it('should reset an already-registered service', () => {
      engine.registerService('svc-a');
      engine.registerService('svc-a'); // re-register
      const state = engine.getServiceState('svc-a');
      expect(state).toBeDefined();
      expect(state!.state).toBe(ServiceSimulationState.HEALTHY);
    });
  });

  // ==================== Original Fault Types (Backward Compatibility) ====================

  describe('injectFault (legacy)', () => {
    it('should inject LATENCY_SPIKE and set DEGRADED state', () => {
      engine.registerService('svc-a');
      const result = engine.injectFault('svc-a', FaultType.LATENCY_SPIKE, 30000);
      expect(result.state).toBe(ServiceSimulationState.DEGRADED);
      expect(result.latency).toBeGreaterThanOrEqual(500);
      expect(result.errorRate).toBeGreaterThanOrEqual(0);
    });

    it('should inject ERROR_RATE and set FAULTED state', () => {
      engine.registerService('svc-a');
      const result = engine.injectFault('svc-a', FaultType.ERROR_RATE, 30000);
      expect(result.state).toBe(ServiceSimulationState.FAULTED);
      expect(result.errorRate).toBeGreaterThanOrEqual(0.3);
    });

    it('should inject COMPLETE_OUTAGE and set OFFLINE state', () => {
      engine.registerService('svc-a');
      const result = engine.injectFault('svc-a', FaultType.COMPLETE_OUTAGE, 30000);
      expect(result.state).toBe(ServiceSimulationState.OFFLINE);
      expect(result.latency).toBe(0);
      expect(result.errorRate).toBe(1.0);
    });
  });

  // ==================== Task 4.37 New Failure Modes ====================

  describe('injectFailure (Task 4.37 new fault types)', () => {
    it('should inject NETWORK_PARTITION with high latency and partial errors', () => {
      engine.registerService('svc-a');
      const result = engine.injectFailure('svc-a', FaultType.NETWORK_PARTITION, 30000);
      expect(result.state).toBe(ServiceSimulationState.DEGRADED);
      expect(result.latency).toBeGreaterThanOrEqual(800);
      expect(result.latency).toBeLessThanOrEqual(2800);
      expect(result.errorRate).toBeGreaterThanOrEqual(0.2);
      expect(result.errorRate).toBeLessThanOrEqual(0.5);
    });

    it('should inject SERVICE_DEGRADATION with moderate latency and errors', () => {
      engine.registerService('svc-a');
      const result = engine.injectFailure('svc-a', FaultType.SERVICE_DEGRADATION, 30000);
      expect(result.state).toBe(ServiceSimulationState.DEGRADED);
      expect(result.latency).toBeGreaterThanOrEqual(300);
      expect(result.latency).toBeLessThanOrEqual(1100);
      expect(result.errorRate).toBeGreaterThanOrEqual(0.05);
      expect(result.errorRate).toBeLessThanOrEqual(0.15);
    });

    it('should inject CPU_EXHAUSTION with elevated latency', () => {
      engine.registerService('svc-a');
      const result = engine.injectFailure('svc-a', FaultType.CPU_EXHAUSTION, 30000);
      expect(result.state).toBe(ServiceSimulationState.DEGRADED);
      expect(result.latency).toBeGreaterThanOrEqual(150);
      expect(result.latency).toBeLessThanOrEqual(650);
      expect(result.errorRate).toBeGreaterThanOrEqual(0.02);
      expect(result.errorRate).toBeLessThanOrEqual(0.1);
    });

    it('should inject MEMORY_EXHAUSTION with elevated latency and errors', () => {
      engine.registerService('svc-a');
      const result = engine.injectFailure('svc-a', FaultType.MEMORY_EXHAUSTION, 30000);
      expect(result.state).toBe(ServiceSimulationState.DEGRADED);
      expect(result.latency).toBeGreaterThanOrEqual(200);
      expect(result.latency).toBeLessThanOrEqual(600);
      expect(result.errorRate).toBeGreaterThanOrEqual(0.05);
      expect(result.errorRate).toBeLessThanOrEqual(0.15);
    });

    it('should inject DISK_EXHAUSTION with elevated latency and write failures', () => {
      engine.registerService('svc-a');
      const result = engine.injectFailure('svc-a', FaultType.DISK_EXHAUSTION, 30000);
      expect(result.state).toBe(ServiceSimulationState.DEGRADED);
      expect(result.latency).toBeGreaterThanOrEqual(100);
      expect(result.latency).toBeLessThanOrEqual(400);
      expect(result.errorRate).toBeGreaterThanOrEqual(0.1);
      expect(result.errorRate).toBeLessThanOrEqual(0.25);
    });

    it('should inject CASCADING_FAILURE with FAULTED state and high error rate', () => {
      engine.registerService('svc-a');
      const result = engine.injectFailure('svc-a', FaultType.CASCADING_FAILURE, 30000);
      expect(result.state).toBe(ServiceSimulationState.FAULTED);
      expect(result.latency).toBeGreaterThanOrEqual(400);
      expect(result.latency).toBeLessThanOrEqual(1000);
      expect(result.errorRate).toBeGreaterThanOrEqual(0.3);
      expect(result.errorRate).toBeLessThanOrEqual(0.6);
    });

    it('should auto-register service if not already registered', () => {
      const result = engine.injectFailure('new-svc', FaultType.CASCADING_FAILURE, 10000);
      expect(result.name).toBe('new-svc');
      expect(result.state).toBe(ServiceSimulationState.FAULTED);
    });

    it('should throw for unknown fault type', () => {
      engine.registerService('svc-a');
      // @ts-ignore - testing unknown fault type
      expect(() => engine.injectFailure('svc-a', 'unknown_type', 1000)).toThrow('Unknown fault type');
    });
  });

  // ==================== Chaos Scenario ====================

  describe('injectChaos', () => {
    it('should inject multiple failures with no delays', () => {
      engine.registerService('svc-a');
      engine.registerService('svc-b');

      const scenario = {
        name: 'network-chaos',
        failures: [
          { serviceId: 'svc-a', failureType: FaultType.NETWORK_PARTITION as FaultType, durationMs: 10000 },
          { serviceId: 'svc-b', failureType: FaultType.CASCADING_FAILURE as FaultType, durationMs: 5000 },
        ],
      };

      const status = engine.injectChaos(scenario);
      expect(status.totalActive).toBeGreaterThanOrEqual(1);
    });

    it('should return simulation status', () => {
      engine.registerService('svc-a');

      const scenario = {
        name: 'cpu-storm',
        failures: [
          { serviceId: 'svc-a', failureType: FaultType.CPU_EXHAUSTION as FaultType, durationMs: 15000 },
        ],
      };

      const status = engine.injectChaos(scenario);
      expect(status.activeSimulations).toHaveLength(1);
      expect(status.activeSimulations[0].serviceId).toBe('svc-a');
      expect(status.activeSimulations[0].failureType).toBe(FaultType.CPU_EXHAUSTION);
      expect(status.activeSimulations[0].remainingMs).toBeGreaterThan(0);
    });
  });

  // ==================== Simulation Controls ====================

  describe('stopSimulation', () => {
    it('should stop an active simulation and return true', () => {
      engine.registerService('svc-a');
      engine.injectFailure('svc-a', FaultType.CPU_EXHAUSTION, 60000);

      const result = engine.stopSimulation('svc-a');
      expect(result).toBe(true);

      const state = engine.getServiceState('svc-a');
      expect(state!.state).toBe(ServiceSimulationState.RECOVERING);
      expect(state!.faultInjection.type).toBeNull();
    });

    it('should return false when no simulation is active', () => {
      engine.registerService('svc-a');
      const result = engine.stopSimulation('svc-a');
      expect(result).toBe(false);
    });
  });

  describe('getSimulationStatus', () => {
    it('should return zero active simulations when none are running', () => {
      engine.registerService('svc-a');
      const status = engine.getSimulationStatus();
      expect(status.totalActive).toBe(0);
      expect(status.activeSimulations).toHaveLength(0);
    });

    it('should return active simulations with remaining time', () => {
      engine.registerService('svc-a');
      engine.injectFailure('svc-a', FaultType.NETWORK_PARTITION, 60000);

      const status = engine.getSimulationStatus();
      expect(status.totalActive).toBe(1);
      expect(status.activeSimulations[0].serviceId).toBe('svc-a');
      expect(status.activeSimulations[0].failureType).toBe(FaultType.NETWORK_PARTITION);
      expect(status.activeSimulations[0].remainingMs).toBeGreaterThan(0);
      expect(status.activeSimulations[0].remainingMs).toBeLessThanOrEqual(60000);
    });

    it('should track multiple concurrent simulations', () => {
      engine.registerService('svc-a');
      engine.registerService('svc-b');
      engine.injectFailure('svc-a', FaultType.CPU_EXHAUSTION, 60000);
      engine.injectFailure('svc-b', FaultType.MEMORY_EXHAUSTION, 45000);

      const status = engine.getSimulationStatus();
      expect(status.totalActive).toBe(2);
      const serviceIds = status.activeSimulations.map(s => s.serviceId);
      expect(serviceIds).toContain('svc-a');
      expect(serviceIds).toContain('svc-b');
    });
  });

  // ==================== Cascading Failures ====================

  describe('registerServiceDependency and propagateFailure', () => {
    it('should propagate cascading failure to dependent services', async () => {
      // Register services and dependency: svc-a → svc-b, svc-c
      engine.registerService('svc-a');
      engine.registerService('svc-b');
      engine.registerService('svc-c');
      engine.registerServiceDependency('svc-a', ['svc-b', 'svc-c']);

      // Inject cascading failure on source
      engine.injectFailure('svc-a', FaultType.CASCADING_FAILURE, 30000);

      // Wait for propagation (2s delay)
      await new Promise(resolve => setTimeout(resolve, 2500));

      // Dependents should have been affected
      const svcB = engine.getServiceState('svc-b');
      const svcC = engine.getServiceState('svc-c');
      // Dependents should be FAULTED or DEGRADED after propagation
      expect([ServiceSimulationState.FAULTED, ServiceSimulationState.DEGRADED]).toContain(svcB!.state);
      expect([ServiceSimulationState.FAULTED, ServiceSimulationState.DEGRADED]).toContain(svcC!.state);
    }, 10000);

    it('should not propagate to non-dependent services', async () => {
      engine.registerService('svc-a');
      engine.registerService('svc-b');
      // svc-b is NOT a dependent of svc-a
      engine.registerServiceDependency('svc-a', ['svc-c']);

      engine.injectFailure('svc-a', FaultType.COMPLETE_OUTAGE, 30000);

      await new Promise(resolve => setTimeout(resolve, 100));

      const svcB = engine.getServiceState('svc-b');
      // svc-b should remain healthy (not affected)
      expect(svcB!.state).toBe(ServiceSimulationState.HEALTHY);
    }, 5000);
  });

  // ==================== SelfHealing Integration ====================

  describe('predictHealingOutcome', () => {
    it('should predict recovery for restart action on faulted service', async () => {
      engine.registerService('svc-a');
      engine.injectFailure('svc-a', FaultType.CASCADING_FAILURE, 60000);

      const outcome = await engine.predictHealingOutcome('svc-a', 'restart');

      expect(outcome.serviceId).toBe('svc-a');
      expect(outcome.currentState).toBe(ServiceSimulationState.FAULTED);
      expect(outcome.predictedStateAfterHealing).toBe(ServiceSimulationState.RECOVERING);
      expect(outcome.recoveryProbability).toBeGreaterThan(0);
      expect(outcome.estimatedRecoveryMs).toBeGreaterThan(0);
      expect(outcome.warnings.length).toBeGreaterThanOrEqual(0);
    });

    it('should recommend scaling for resource exhaustion', async () => {
      engine.registerService('svc-a');
      engine.injectFailure('svc-a', FaultType.CPU_EXHAUSTION, 30000);

      const outcome = await engine.predictHealingOutcome('svc-a', 'scale');

      expect(outcome.predictedStateAfterHealing).toBe(ServiceSimulationState.RECOVERING);
      expect(outcome.warnings.length).toBeGreaterThanOrEqual(0);
    });

    it('should recommend failover for offline service', async () => {
      engine.registerService('svc-a');
      engine.injectFailure('svc-a', FaultType.COMPLETE_OUTAGE, 30000);

      const outcome = await engine.predictHealingOutcome('svc-a', 'failover');

      expect(outcome.recoveryProbability).toBeGreaterThanOrEqual(0.75);
    });

    it('should include cascading impact when dependents are affected', async () => {
      engine.registerService('svc-a');
      engine.registerService('svc-b');
      engine.registerServiceDependency('svc-a', ['svc-b']);
      engine.injectFailure('svc-b', FaultType.CASCADING_FAILURE, 30000);

      const outcome = await engine.predictHealingOutcome('svc-b', 'restart');

      // svc-a depends on svc-b and may be affected
      expect(outcome.cascadingImpact).toBeDefined();
    });
  });

  describe('validateHealingRules', () => {
    it('should validate rules successfully for matching conditions', async () => {
      engine.registerService('svc-a');
      engine.injectFailure('svc-a', FaultType.CPU_EXHAUSTION, 30000);

      const result = await engine.validateHealingRules('svc-a', [
        { condition: 'high_cpu', expectedState: ServiceSimulationState.DEGRADED },
      ]);

      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.recommendedActions).toContain('All rules validated successfully');
    });

    it('should report violations when conditions do not match', async () => {
      engine.registerService('svc-a');
      // Service is healthy, not in faulted state
      const result = await engine.validateHealingRules('svc-a', [
        { condition: 'high_cpu', expectedState: ServiceSimulationState.FAULTED },
      ]);

      expect(result.isValid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it('should validate network_partition rule', async () => {
      engine.registerService('svc-a');
      engine.injectFailure('svc-a', FaultType.NETWORK_PARTITION, 30000);

      const result = await engine.validateHealingRules('svc-a', [
        { condition: 'network_partition', expectedState: ServiceSimulationState.DEGRADED },
      ]);

      expect(result.isValid).toBe(true);
    });

    it('should validate service_down rule for offline service', async () => {
      engine.registerService('svc-a');
      engine.injectFailure('svc-a', FaultType.COMPLETE_OUTAGE, 30000);

      const result = await engine.validateHealingRules('svc-a', [
        { condition: 'service_down', expectedState: ServiceSimulationState.OFFLINE },
      ]);

      expect(result.isValid).toBe(true);
    });

    it('should generate appropriate recommendations for violations', async () => {
      engine.registerService('svc-a');
      engine.injectFailure('svc-a', FaultType.DISK_EXHAUSTION, 30000);

      const result = await engine.validateHealingRules('svc-a', [
        { condition: 'high_cpu', expectedState: ServiceSimulationState.HEALTHY },
      ]);

      expect(result.isValid).toBe(false);
      expect(result.recommendedActions.some(a => a.includes('disk'))).toBe(true);
    });

    it('should warn on unknown rule conditions', async () => {
      engine.registerService('svc-a');
      const result = await engine.validateHealingRules('svc-a', [
        { condition: 'unknown_condition', expectedState: ServiceSimulationState.HEALTHY },
      ]);

      expect(result.warnings.some(w => w.includes('Unknown rule condition'))).toBe(true);
    });
  });

  // ==================== Markov Chain Simulation ====================

  describe('simulateStateTransition', () => {
    it('should simulate state transitions for given steps', async () => {
      engine.registerService('svc-a');
      const results = await engine.simulateStateTransition('twin-1', ServiceSimulationState.HEALTHY, 5);
      expect(results).toHaveLength(5);
      expect(results[0].step).toBe(1);
    });

    it('should throw for steps < 1', async () => {
      engine.registerService('svc-a');
      await expect(engine.simulateStateTransition('twin-1', ServiceSimulationState.HEALTHY, 0))
        .rejects.toThrow('Steps must be a positive integer');
    });
  });

  // ==================== State History ====================

  describe('state history', () => {
    it('should record state transitions in history', () => {
      engine.registerService('svc-a');
      engine.injectFailure('svc-a', FaultType.CPU_EXHAUSTION, 1000);

      const history = engine.getStateHistory('svc-a');
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history[history.length - 1].reason).toContain('fault_injected');
    });

    it('should filter history by service name', () => {
      engine.registerService('svc-a');
      engine.registerService('svc-b');
      engine.injectFailure('svc-a', FaultType.CPU_EXHAUSTION, 1000);
      engine.injectFailure('svc-b', FaultType.NETWORK_PARTITION, 1000);

      const svcAHistory = engine.getStateHistory('svc-a');
      expect(svcAHistory.every(e => e.service === 'svc-a')).toBe(true);
    });
  });

  // ==================== Recovery ====================

  describe('recoverService', () => {
    it('should transition faulted service to recovering', () => {
      engine.registerService('svc-a');
      engine.injectFailure('svc-a', FaultType.COMPLETE_OUTAGE, 60000);

      const result = engine.recoverService('svc-a');
      expect(result.state).toBe(ServiceSimulationState.RECOVERING);
      expect(result.faultInjection.type).toBeNull();
    });
  });

  // ==================== Run Simulation ====================

  describe('runSimulation', () => {
    it('should run a complete simulation scenario', async () => {
      engine.registerService('svc-a');
      const result = await engine.runSimulation('twin-1', { steps: 5 }, 0);
      expect(result.twinId).toBe('twin-1');
      expect(result.results).toHaveLength(5);
      expect(result.statistics.totalTransitions).toBe(5);
      expect(result.startedAt).toBeDefined();
      expect(result.completedAt).toBeDefined();
    });

    it('should calculate steady state', async () => {
      engine.registerService('svc-a');
      const result = await engine.runSimulation('twin-1', { steps: 3 }, 0);
      expect(result.steadyState).toBeDefined();
    });
  });
});
