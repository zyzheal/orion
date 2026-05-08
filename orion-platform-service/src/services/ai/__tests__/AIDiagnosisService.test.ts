/**
 * AIDiagnosisService Tests
 *
 * Verifies rule-based diagnosis fallback patterns.
 */

import { AIDiagnosisService, DiagnosisContext } from '../AIDiagnosisService';

describe('AIDiagnosisService', () => {
  let service: AIDiagnosisService;

  beforeEach(() => {
    // Point to a non-existent AI service to force fallback
    service = new AIDiagnosisService({
      aiServiceUrl: 'http://localhost:19999', // deliberately unreachable
      diagnosisTimeoutMs: 2000,
    });
  });

  const makeContext = (errorMessage: string): DiagnosisContext => ({
    taskId: 'test-task-001',
    pluginId: 'test-plugin',
    errorMessage,
    errorStack: '',
    isolationTier: 'MEDIUM',
    durationMs: 1000,
  });

  describe('rule-based fallback diagnosis', () => {
    it('should diagnose connection refused issues', async () => {
      const result = await service.diagnose(makeContext('Error: Connection refused ECONNREFUSED 10.0.0.1:8080'));

      expect(result.rootCause).toContain('connection refused');
      expect(result.confidence).toBeGreaterThan(70);
      expect(result.suggestedFix).toContain('network policy');
    });

    it('should diagnose connection timeout issues', async () => {
      const result = await service.diagnose(makeContext('Error: ETIMEDOUT connection timed out'));

      expect(result.rootCause).toContain('timeout');
      expect(result.confidence).toBe(80);
    });

    it('should diagnose out of memory issues', async () => {
      const result = await service.diagnose(makeContext('FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - out of memory'));

      expect(result.rootCause).toContain('memory');
      expect(result.suggestedFix).toContain('memory limit');
    });

    it('should diagnose permission denied issues', async () => {
      const result = await service.diagnose(makeContext('Error: EACCES permission denied /var/log'));

      expect(result.rootCause).toContain('Permission denied');
      expect(result.confidence).toBe(85);
    });

    it('should diagnose Docker daemon issues', async () => {
      const result = await service.diagnose(makeContext('docker: Cannot connect to the Docker daemon. Is the docker daemon running?'));

      expect(result.rootCause).toContain('Docker daemon');
      expect(result.confidence).toBe(90);
    });

    it('should diagnose image pull failures', async () => {
      const result = await service.diagnose(makeContext('Error: image pull failed: manifest for nginx:latest not found'));

      expect(result.rootCause).toContain('Container image');
      expect(result.suggestedFix).toContain('registry');
    });

    it('should diagnose authentication failures', async () => {
      const result = await service.diagnose(makeContext('Error: 401 Unauthorized - invalid API key'));

      expect(result.rootCause).toContain('Authentication');
    });

    it('should diagnose authorization failures', async () => {
      const result = await service.diagnose(makeContext('Error: 403 Forbidden - insufficient privileges'));

      expect(result.rootCause).toContain('Authorization');
    });

    it('should provide generic diagnosis for unknown errors', async () => {
      const result = await service.diagnose(makeContext('Something weird happened'));

      expect(result.rootCause).toContain('test-plugin');
      expect(result.confidence).toBe(50); // generic fallback confidence
    });

    it('should handle empty error messages gracefully', async () => {
      const result = await service.diagnose(makeContext(''));

      expect(result.rootCause).toBeTruthy();
      expect(result.confidence).toBeLessThanOrEqual(50);
    });
  });

  describe('findSimilarIncidents', () => {
    it('should return empty array when no audit log repo configured', async () => {
      const incidents = await service.findSimilarIncidents('some error', 5);
      expect(incidents).toEqual([]);
    });
  });

  describe('timeout handling', () => {
    it('should use configured timeout', async () => {
      // Service configured with 2s timeout, AI service unreachable
      const start = Date.now();
      try {
        await service.diagnose(makeContext('some error'));
      } catch { /* expected to fallback */ }
      // Should fallback quickly (not hang for default 30s)
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(5000); // should fallback within a few seconds
    });
  });
});
