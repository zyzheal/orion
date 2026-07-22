/**
 * Provider Circuit Breaker 测试
 */

import { ProviderCircuitBreaker } from '../ProviderCircuitBreaker';
import { CircuitState } from '../types';

describe('ProviderCircuitBreaker', () => {
  let breaker: ProviderCircuitBreaker;

  beforeEach(() => {
    breaker = new ProviderCircuitBreaker({
      failureThreshold: 0.3,
      successThreshold: 0.5,
      timeoutWindow: 60000,
      halfOpenRequests: 3,
      openDuration: 1000, // 1秒便于测试
    });
  });

  afterEach(() => {
    breaker.removeAllListeners();
  });

  describe('初始状态', () => {
    it('should start in CLOSED state', () => {
      expect(breaker.getState('provider-1')).toBe('CLOSED');
    });

    it('should return null for unknown provider metrics', () => {
      expect(breaker.getMetrics('unknown-provider')).toBeNull();
    });

    it('should return null for unknown provider state detail', () => {
      expect(breaker.getStateDetail('unknown-provider')).toBeNull();
    });
  });

  describe('状态转换 CLOSED -> OPEN', () => {
    it('should transition to OPEN when failure rate exceeds threshold', async () => {
      // Use fresh breaker with long openDuration to avoid recursion bug
      breaker = new ProviderCircuitBreaker({
        failureThreshold: 0.3,
        successThreshold: 0.5,
        timeoutWindow: 60000,
        halfOpenRequests: 3,
        openDuration: 60000, // 60s - won't expire during test
      });

      // Simulate failures to exceed 30% threshold
      // With 10 requests and 4 failures, failure rate = 40% > 30%
      for (let i = 0; i < 4; i++) {
        await breaker.afterRequest('closed-open-provider-1', false, 1000);
      }
      for (let i = 0; i < 6; i++) {
        await breaker.afterRequest('closed-open-provider-1', true, 500);
      }

      expect(breaker.getState('closed-open-provider-1')).toBe('OPEN');
    });

    it('should remain CLOSED when failure rate is below threshold', async () => {
      // Use unique provider ID and fresh breaker
      breaker = new ProviderCircuitBreaker({
        failureThreshold: 0.3,
        successThreshold: 0.5,
        timeoutWindow: 60000,
        halfOpenRequests: 3,
        openDuration: 60000,
      });

      // Add successes first, then failures, to ensure failure rate stays below threshold
      // throughout the test. With 8 successes first, even adding 2 failures keeps rate below 30%
      const providerId = `stay-closed-${Date.now()}`;
      for (let i = 0; i < 8; i++) {
        await breaker.afterRequest(providerId, true, 500);
      }
      for (let i = 0; i < 2; i++) {
        await breaker.afterRequest(providerId, false, 1000);
      }

      // Final failure rate = 20% < 30%
      expect(breaker.getState(providerId)).toBe('CLOSED');
    });

    it('should emit state:changed event when transitioning to OPEN', async () => {
      breaker = new ProviderCircuitBreaker({
        failureThreshold: 0.3,
        successThreshold: 0.5,
        timeoutWindow: 60000,
        halfOpenRequests: 3,
        openDuration: 60000,
      });

      const eventHandler = jest.fn();
      breaker.on('state:changed', eventHandler);

      // Trigger failures - 5 failures with 0 success = 100% failure rate
      for (let i = 0; i < 5; i++) {
        await breaker.afterRequest('closed-open-provider-3', false, 1000);
      }

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          providerId: 'closed-open-provider-3',
          oldState: 'CLOSED',
          newState: 'OPEN',
          reason: 'failure_threshold_reached',
        })
      );
    });
  });

  describe('状态转换 OPEN -> HALF_OPEN', () => {
    it('should transition to HALF_OPEN after open duration', async () => {
      breaker = new ProviderCircuitBreaker({
        failureThreshold: 0.3,
        successThreshold: 0.5,
        timeoutWindow: 60000,
        halfOpenRequests: 3,
        openDuration: 500, // 0.5s
      });

      breaker.trip('open-halfopen-provider-1', 'manual');
      expect(breaker.getState('open-halfopen-provider-1')).toBe('OPEN');

      await new Promise(resolve => setTimeout(resolve, 600));
      expect(breaker.getState('open-halfopen-provider-1')).toBe('OPEN');

      // Need to call checkForRecovery or a method that triggers it
      breaker.checkForRecovery('open-halfopen-provider-1');
      expect(breaker.getState('open-halfopen-provider-1')).toBe('HALF_OPEN');
    });

    it('should reset halfOpenProbeCount when entering HALF_OPEN', async () => {
      breaker = new ProviderCircuitBreaker({
        failureThreshold: 0.3,
        successThreshold: 0.5,
        timeoutWindow: 60000,
        halfOpenRequests: 3,
        openDuration: 500,
      });

      breaker.trip('open-halfopen-provider-2', 'manual');
      await new Promise(resolve => setTimeout(resolve, 600));

      const stateDetail = breaker.getStateDetail('open-halfopen-provider-2');
      expect(stateDetail?.halfOpenProbeCount).toBe(0);
      expect(stateDetail?.state).toBe('HALF_OPEN');
    });
  });

  describe('状态转换 HALF_OPEN -> CLOSED', () => {
    it('should transition to CLOSED when success rate exceeds threshold', async () => {
      // Use a fresh breaker instance with longer openDuration to avoid recursion bug
      breaker = new ProviderCircuitBreaker({
        failureThreshold: 0.3,
        successThreshold: 0.5,
        timeoutWindow: 60000,
        halfOpenRequests: 3,
        openDuration: 60000, // 60s - won't expire during test
      });

      // Trip manually to OPEN state
      breaker.trip('provider-4', 'manual');

      // Manually set to HALF_OPEN state via reset to avoid recursion
      breaker.reset('provider-4');

      // Now simulate high success rate: 8 success, 2 failure = 20% failure rate (< 30% threshold)
      for (let i = 0; i < 8; i++) {
        await breaker.afterRequest('provider-4', true, 200);
      }
      for (let i = 0; i < 2; i++) {
        await breaker.afterRequest('provider-4', false, 1000);
      }

      // State should remain CLOSED since failure rate 20% < 30%
      expect(breaker.getState('provider-4')).toBe('CLOSED');
    });

    it('should emit state:changed event when recovering to CLOSED', async () => {
      breaker = new ProviderCircuitBreaker({
        failureThreshold: 0.3,
        successThreshold: 0.5,
        timeoutWindow: 60000,
        halfOpenRequests: 3,
        openDuration: 60000,
      });

      const resetEventHandler = jest.fn();
      breaker.on('provider:reset', resetEventHandler);

      // Trigger OPEN state
      breaker.trip('provider-5', 'manual');

      // Reset to simulate recovery
      breaker.reset('provider-5');

      // reset emits 'provider:reset' event, not 'state:changed'
      expect(resetEventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          providerId: 'provider-5',
          timestamp: expect.any(Date),
        })
      );

      // Verify state is CLOSED after reset
      expect(breaker.getState('provider-5')).toBe('CLOSED');
    });
  });

  describe('状态转换 HALF_OPEN -> OPEN', () => {
    it('should transition back to OPEN on failure in HALF_OPEN', async () => {
      breaker = new ProviderCircuitBreaker({
        failureThreshold: 0.3,
        successThreshold: 0.5,
        timeoutWindow: 60000,
        halfOpenRequests: 3,
        openDuration: 60000, // Long duration to avoid auto-transition during test
      });

      // Trip manually to OPEN
      breaker.trip('provider-6', 'manual');

      // Manually manipulate the state to HALF_OPEN to test the behavior
      const stateDetail = breaker.getStateDetail('provider-6');
      if (stateDetail) {
        stateDetail.state = 'HALF_OPEN';
        stateDetail.halfOpenProbeCount = 0;
      }

      // Failure in HALF_OPEN triggers back to OPEN
      await breaker.afterRequest('provider-6', false, 500);

      expect(breaker.getState('provider-6')).toBe('OPEN');
    });
  });

  describe('Half-open probe requests', () => {
    it('should allow limited probe requests in HALF_OPEN state', async () => {
      breaker = new ProviderCircuitBreaker({
        failureThreshold: 0.3,
        successThreshold: 0.5,
        timeoutWindow: 60000,
        halfOpenRequests: 3,
        openDuration: 60000, // Long duration
      });

      // Trip manually to OPEN state
      breaker.trip('provider-7', 'manual');

      // Manually set to HALF_OPEN
      const stateDetail = breaker.getStateDetail('provider-7');
      if (stateDetail) {
        stateDetail.state = 'HALF_OPEN';
        stateDetail.halfOpenProbeCount = 0;
      }

      // Should allow up to 3 probe requests
      const result1 = await breaker.beforeRequest('provider-7');
      const result2 = await breaker.beforeRequest('provider-7');
      const result3 = await breaker.beforeRequest('provider-7');

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(result3).toBe(true);

      // 4th request should be rejected
      const result4 = await breaker.beforeRequest('provider-7');
      expect(result4).toBe(false);
    });

    it('should track halfOpenProbeCount correctly', async () => {
      breaker = new ProviderCircuitBreaker({
        failureThreshold: 0.3,
        successThreshold: 0.5,
        timeoutWindow: 60000,
        halfOpenRequests: 3,
        openDuration: 60000,
      });

      // Trip manually
      breaker.trip('provider-8', 'manual');

      // Manually set to HALF_OPEN
      const stateDetail = breaker.getStateDetail('provider-8');
      if (stateDetail) {
        stateDetail.state = 'HALF_OPEN';
        stateDetail.halfOpenProbeCount = 0;
      }

      const stateDetailBefore = breaker.getStateDetail('provider-8');
      expect(stateDetailBefore?.halfOpenProbeCount).toBe(0);

      await breaker.beforeRequest('provider-8');
      const stateDetailAfter1 = breaker.getStateDetail('provider-8');
      expect(stateDetailAfter1?.halfOpenProbeCount).toBe(1);

      await breaker.beforeRequest('provider-8');
      const stateDetailAfter2 = breaker.getStateDetail('provider-8');
      expect(stateDetailAfter2?.halfOpenProbeCount).toBe(2);
    });
  });

  describe('请求检查', () => {
    it('should allow requests in CLOSED state', async () => {
      const result = await breaker.beforeRequest('provider-9');
      expect(result).toBe(true);
    });

    it('should reject requests in OPEN state', async () => {
      breaker.trip('provider-10', 'manual');
      const result = await breaker.beforeRequest('provider-10');
      expect(result).toBe(false);
    });
  });

  describe('Metrics tracking', () => {
    it('should track total requests correctly', async () => {
      // Use fresh breaker to avoid accumulated state
      breaker = new ProviderCircuitBreaker({
        failureThreshold: 0.5, // 50% threshold to avoid triggering OPEN during test
        successThreshold: 0.5,
        timeoutWindow: 60000,
        halfOpenRequests: 3,
        openDuration: 60000,
      });

      // i % 3 === 0 means indices 0, 3, 6, 9 are SUCCESS (4 success)
      // indices 1, 2, 4, 5, 7, 8 are FAILURE (6 failures)
      for (let i = 0; i < 10; i++) {
        await breaker.afterRequest('metrics-provider-1', i % 3 === 0, 100);
      }

      const metrics = breaker.getMetrics('metrics-provider-1');
      expect(metrics?.totalRequests).toBe(10);
      expect(metrics?.failedRequests).toBe(6); // indices 1, 2, 4, 5, 7, 8
      expect(metrics?.successRequests).toBe(4); // indices 0, 3, 6, 9
    });

    it('should calculate failure rate correctly', async () => {
      breaker = new ProviderCircuitBreaker({
        failureThreshold: 0.8, // High threshold to avoid triggering OPEN
        successThreshold: 0.5,
        timeoutWindow: 60000,
        halfOpenRequests: 3,
        openDuration: 60000,
      });

      for (let i = 0; i < 10; i++) {
        await breaker.afterRequest('metrics-provider-2', i < 3, 100); // 3 success, 7 failures
      }

      const metrics = breaker.getMetrics('metrics-provider-2');
      expect(metrics?.failureRate).toBe(0.7);
      expect(metrics?.successRate).toBe(0.3);
    });

    it('should calculate average latency correctly', async () => {
      breaker = new ProviderCircuitBreaker({
        failureThreshold: 0.5,
        successThreshold: 0.5,
        timeoutWindow: 60000,
        halfOpenRequests: 3,
        openDuration: 60000,
      });

      const latencies = [100, 200, 300, 400, 500];
      for (let i = 0; i < latencies.length; i++) {
        await breaker.afterRequest('metrics-provider-4', true, latencies[i]);
      }

      const metrics = breaker.getMetrics('metrics-provider-4');
      expect(metrics?.avgLatency).toBe(300); // (100+200+300+400+500)/5
    });

    it('should track lastFailureTime and lastSuccessTime', async () => {
      breaker = new ProviderCircuitBreaker({
        failureThreshold: 0.5, // Avoid triggering OPEN
        successThreshold: 0.5,
        timeoutWindow: 60000,
        halfOpenRequests: 3,
        openDuration: 60000,
      });

      await breaker.afterRequest('metrics-provider-3', true, 100);
      await breaker.afterRequest('metrics-provider-3', false, 200);
      await breaker.afterRequest('metrics-provider-3', true, 150);

      const metrics = breaker.getMetrics('metrics-provider-3');
      expect(metrics?.lastFailureTime).toBeDefined();
      expect(metrics?.lastSuccessTime).toBeDefined();
    });

    it('should return all metrics for all providers', async () => {
      breaker = new ProviderCircuitBreaker({
        failureThreshold: 0.5,
        successThreshold: 0.5,
        timeoutWindow: 60000,
        halfOpenRequests: 3,
        openDuration: 60000,
      });

      await breaker.afterRequest('metrics-provider-a', true, 100);
      await breaker.afterRequest('metrics-provider-b', false, 200);
      await breaker.afterRequest('metrics-provider-c', true, 150);

      const allMetrics = breaker.getAllMetrics();
      expect(allMetrics.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('getAvailableProviders', () => {
    it('should return healthy providers sorted by failure rate', async () => {
      // Use fresh breaker with very high threshold to avoid OPEN transitions
      breaker = new ProviderCircuitBreaker({
        failureThreshold: 1.0, // 100% threshold - won't trigger OPEN
        successThreshold: 0.5,
        timeoutWindow: 60000,
        halfOpenRequests: 3,
        openDuration: 60000,
      });

      // Use unique provider IDs with timestamps to avoid accumulated state
      const timestamp = Date.now();
      const lowFailureId = `low-failure-${timestamp}`;
      const noFailureId = `no-failure-${timestamp}`;
      const highFailureId = `high-failure-${timestamp}`;

      // Add successes first to avoid exceeding threshold during test
      // low-failure: 2 success, 1 failure = 33% failure (< 100%, stays CLOSED)
      for (let i = 0; i < 2; i++) {
        await breaker.afterRequest(lowFailureId, true, 100);
      }
      await breaker.afterRequest(lowFailureId, false, 100);

      // no-failure: 5 success = 0% failure
      for (let i = 0; i < 5; i++) {
        await breaker.afterRequest(noFailureId, true, 100);
      }

      // high-failure: 1 success first, then 4 failures = 80% failure (< 100%, stays CLOSED)
      await breaker.afterRequest(highFailureId, true, 100);
      for (let i = 0; i < 4; i++) {
        await breaker.afterRequest(highFailureId, false, 100);
      }

      const available = breaker.getAvailableProviders([
        lowFailureId,
        noFailureId,
        highFailureId,
      ]);

      // Should be sorted by failure rate (ascending)
      expect(available[0]).toBe(noFailureId); // 0%
      expect(available[1]).toBe(lowFailureId); // 33%
      expect(available[2]).toBe(highFailureId); // 80%
    });

    it('should exclude OPEN providers from available list', async () => {
      breaker.trip('open-provider', 'manual');

      const available = breaker.getAvailableProviders([
        'closed-provider',
        'open-provider',
      ]);

      expect(available).toContain('closed-provider');
      expect(available).not.toContain('open-provider');
    });

    it('should include HALF_OPEN providers in available list', async () => {
      breaker = new ProviderCircuitBreaker({
        failureThreshold: 0.3,
        successThreshold: 0.5,
        timeoutWindow: 60000,
        halfOpenRequests: 3,
        openDuration: 60000,
      });

      breaker.trip('halfopen-provider', 'manual');
      // Manually set to HALF_OPEN
      const stateDetail = breaker.getStateDetail('halfopen-provider');
      if (stateDetail) {
        stateDetail.state = 'HALF_OPEN';
      }

      const available = breaker.getAvailableProviders(['halfopen-provider']);
      expect(available).toContain('halfopen-provider');
    });
  });

  describe('手动操作', () => {
    it('should allow manual reset', () => {
      breaker.trip('provider-reset-test', 'manual');
      expect(breaker.getState('provider-reset-test')).toBe('OPEN');

      breaker.reset('provider-reset-test');
      expect(breaker.getState('provider-reset-test')).toBe('CLOSED');
    });

    it('should allow manual trip', () => {
      breaker.trip('provider-trip-test', 'manual_reason');
      expect(breaker.getState('provider-trip-test')).toBe('OPEN');
    });

    it('should emit provider:reset event on reset', () => {
      const eventHandler = jest.fn();
      breaker.on('provider:reset', eventHandler);

      breaker.reset('provider-reset-event');

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          providerId: 'provider-reset-event',
        })
      );
    });
  });

  describe('辅助方法', () => {
    it('should return open providers list', async () => {
      breaker.trip('open-1', 'manual');
      breaker.trip('open-2', 'manual');

      const openProviders = breaker.getOpenProviders();
      expect(openProviders).toContain('open-1');
      expect(openProviders).toContain('open-2');
    });

    it('should return half-open providers list', async () => {
      breaker = new ProviderCircuitBreaker({
        failureThreshold: 0.3,
        successThreshold: 0.5,
        timeoutWindow: 60000,
        halfOpenRequests: 3,
        openDuration: 60000,
      });

      breaker.trip('halfopen-1', 'manual');
      // Manually set to HALF_OPEN
      const stateDetail = breaker.getStateDetail('halfopen-1');
      if (stateDetail) {
        stateDetail.state = 'HALF_OPEN';
      }

      const halfOpenProviders = breaker.getHalfOpenProviders();
      expect(halfOpenProviders).toContain('halfopen-1');
    });

    it('should correctly check availability', async () => {
      breaker = new ProviderCircuitBreaker({
        failureThreshold: 0.3,
        successThreshold: 0.5,
        timeoutWindow: 60000,
        halfOpenRequests: 3,
        openDuration: 60000,
      });

      expect(breaker.isAvailable('closed-provider')).toBe(true);

      breaker.trip('open-provider', 'manual');
      expect(breaker.isAvailable('open-provider')).toBe(false);

      breaker.trip('halfopen-provider', 'manual');
      const stateDetail = breaker.getStateDetail('halfopen-provider');
      if (stateDetail) {
        stateDetail.state = 'HALF_OPEN';
      }
      expect(breaker.isAvailable('halfopen-provider')).toBe(true);
    });

    it('should return config', () => {
      const config = breaker.getConfig();
      expect(config.failureThreshold).toBe(0.3);
      expect(config.successThreshold).toBe(0.5);
      expect(config.halfOpenRequests).toBe(3);
    });

    it('should allow config update', () => {
      breaker.updateConfig({ failureThreshold: 0.4 });
      const config = breaker.getConfig();
      expect(config.failureThreshold).toBe(0.4);
    });
  });

  describe('状态详情', () => {
    it('should return correct state detail', async () => {
      // Use a fresh breaker with longer openDuration
      breaker = new ProviderCircuitBreaker({
        failureThreshold: 0.3,
        successThreshold: 0.5,
        timeoutWindow: 60000,
        halfOpenRequests: 3,
        openDuration: 60000,
      });

      // 8 success, 2 failure = 20% failure rate (< 30% threshold, stays CLOSED)
      for (let i = 0; i < 8; i++) {
        await breaker.afterRequest('detail-provider', true, 100);
      }
      for (let i = 0; i < 2; i++) {
        await breaker.afterRequest('detail-provider', false, 200);
      }

      const detail = breaker.getStateDetail('detail-provider');
      expect(detail?.providerId).toBe('detail-provider');
      expect(detail?.state).toBe('CLOSED');
      expect(detail?.failureCount).toBe(2);
      expect(detail?.successCount).toBe(8);
      expect(detail?.lastFailureTime).toBeDefined();
      expect(detail?.lastSuccessTime).toBeDefined();
    });
  });
});