/**
 * AIDiagnosisService Tests
 *
 * Tests for G2: AI Diagnosis Service.
 * Verifies: rule-based fallback, pattern matching, timeout handling.
 * Note: AI service HTTP integration tests require orion-ai-service running.
 */

import { AIDiagnosisService, DiagnosisContext } from '../ai/AIDiagnosisService';

describe('AIDiagnosisService', () => {
  let service: AIDiagnosisService;

  beforeEach(() => {
    // Point to a non-existent AI service so all tests use rule-based fallback
    service = new AIDiagnosisService({
      aiServiceUrl: 'http://127.0.0.1:1', // Will fail, triggering fallback
      diagnosisTimeoutMs: 2000,
    });
  });

  describe('rule-based diagnosis (fallback)', () => {
    it('should diagnose connection refused errors', async () => {
      const context: DiagnosisContext = {
        taskId: 'task-001',
        pluginId: 'deploy-plugin',
        errorMessage: 'Error: connect ECONNREFUSED 10.0.0.1:8080',
        errorStack: 'at TCPConnectWrap.afterConnect',
        durationMs: 1234,
      };

      const result = await service.diagnose(context);

      expect(result.rootCause).toContain('connection refused');
      expect(result.confidence).toBe(85);
    });

    it('should diagnose connection timeout errors', async () => {
      const context: DiagnosisContext = {
        taskId: 'task-002',
        pluginId: 'deploy-plugin',
        errorMessage: 'Error: connect ETIMEDOUT 10.0.0.1:443',
        errorStack: '',
        durationMs: 30000,
      };

      const result = await service.diagnose(context);

      expect(result.rootCause).toContain('timeout');
      expect(result.confidence).toBe(80);
    });

    it('should diagnose DNS resolution failures', async () => {
      const context: DiagnosisContext = {
        taskId: 'task-003',
        pluginId: 'deploy-plugin',
        errorMessage: 'Error: getaddrinfo ENOTFOUND api.example.com',
        errorStack: '',
        durationMs: 5000,
      };

      const result = await service.diagnose(context);

      expect(result.rootCause).toContain('DNS');
      expect(result.confidence).toBe(90);
    });

    it('should diagnose out of memory errors', async () => {
      const context: DiagnosisContext = {
        taskId: 'task-004',
        pluginId: 'build-plugin',
        errorMessage: 'FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory',
        errorStack: '',
        durationMs: 60000,
      };

      const result = await service.diagnose(context);

      expect(result.rootCause).toContain('memory');
      expect(result.confidence).toBe(85);
    });

    it('should diagnose permission denied errors', async () => {
      const context: DiagnosisContext = {
        taskId: 'task-005',
        pluginId: 'deploy-plugin',
        errorMessage: 'Error: EACCES: permission denied, open /etc/nginx/nginx.conf',
        errorStack: '',
        durationMs: 100,
      };

      const result = await service.diagnose(context);

      expect(result.rootCause).toContain('Permission denied');
      expect(result.confidence).toBe(85);
    });

    it('should diagnose authentication failures', async () => {
      const context: DiagnosisContext = {
        taskId: 'task-006',
        pluginId: 'deploy-plugin',
        errorMessage: 'Error: authentication failed - invalid token',
        errorStack: '',
        durationMs: 200,
      };

      const result = await service.diagnose(context);

      expect(result.rootCause).toContain('Authentication failure');
      expect(result.confidence).toBe(85);
    });

    it('should diagnose forbidden / authorization errors', async () => {
      const context: DiagnosisContext = {
        taskId: 'task-007',
        pluginId: 'deploy-plugin',
        errorMessage: 'Error: 403 Forbidden - insufficient privileges',
        errorStack: '',
        durationMs: 100,
      };

      const result = await service.diagnose(context);

      expect(result.rootCause).toContain('Authorization failure');
      expect(result.confidence).toBe(80);
    });

    it('should diagnose file not found errors', async () => {
      const context: DiagnosisContext = {
        taskId: 'task-008',
        pluginId: 'build-plugin',
        errorMessage: 'Error: ENOENT: no such file or directory, open /app/package.json',
        errorStack: '',
        durationMs: 50,
      };

      const result = await service.diagnose(context);

      expect(result.rootCause).toContain('not found');
      expect(result.confidence).toBe(75);
    });

    it('should diagnose Docker daemon issues', async () => {
      const context: DiagnosisContext = {
        taskId: 'task-009',
        pluginId: 'container-plugin',
        errorMessage: 'Error: docker daemon not running',
        errorStack: '',
        durationMs: 100,
      };

      const result = await service.diagnose(context);

      expect(result.rootCause).toContain('Docker daemon');
      expect(result.confidence).toBe(90);
    });

    it('should diagnose image pull failures', async () => {
      const context: DiagnosisContext = {
        taskId: 'task-010',
        pluginId: 'container-plugin',
        errorMessage: 'Error: image pull failed: manifest unknown',
        errorStack: '',
        durationMs: 10000,
      };

      const result = await service.diagnose(context);

      expect(result.rootCause).toContain('image');
      expect(result.confidence).toBe(85);
    });

    it('should diagnose file descriptor exhaustion', async () => {
      const context: DiagnosisContext = {
        taskId: 'task-011',
        pluginId: 'build-plugin',
        errorMessage: 'Error: EMFILE: too many open files',
        errorStack: '',
        durationMs: 5000,
      };

      const result = await service.diagnose(context);

      expect(result.rootCause).toContain('File descriptor');
      expect(result.confidence).toBe(80);
    });

    it('should provide generic fallback for unknown errors', async () => {
      const context: DiagnosisContext = {
        taskId: 'task-012',
        pluginId: 'unknown-plugin',
        errorMessage: 'Some completely unknown error xyz123',
        errorStack: '',
        durationMs: 100,
      };

      const result = await service.diagnose(context);

      expect(result.rootCause).toContain('unknown-plugin');
      expect(result.confidence).toBe(50);
      expect(result.suggestedFix).toBeTruthy();
    });
  });

  describe('findSimilarIncidents', () => {
    it('should return empty array when audit log repo is not configured', async () => {
      const incidents = await service.findSimilarIncidents('some error message', 5);
      expect(incidents).toEqual([]);
    });
  });

  describe('diagnose with recentLogs', () => {
    it('should include recentLogs in context', async () => {
      const context: DiagnosisContext = {
        taskId: 'task-013',
        pluginId: 'test-plugin',
        errorMessage: 'Connection refused',
        errorStack: '',
        durationMs: 100,
        recentLogs: ['Starting server...', 'Listening on port 8080', 'Connection attempt failed'],
      };

      const result = await service.diagnose(context);

      expect(result).toHaveProperty('rootCause');
      expect(result).toHaveProperty('suggestedFix');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('similarIncidents');
    });
  });
});
