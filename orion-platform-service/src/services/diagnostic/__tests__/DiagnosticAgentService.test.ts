/**
 * DiagnosticAgentService 单元测试
 */

import { DiagnosticAgentService } from '../DiagnosticAgentService';
import { Symptom, DiagnosticCategory } from '../../types';

describe('DiagnosticAgentService', () => {
  let service: DiagnosticAgentService;

  beforeEach(() => {
    service = new DiagnosticAgentService();
  });

  afterEach(() => {
    service.clearAll();
  });

  // ==================== triggerDiagnostic ====================

  describe('triggerDiagnostic', () => {
    it('should trigger a complete diagnostic flow', async () => {
      const result = await service.triggerDiagnostic({
        triggerType: 'deployment_failure',
        triggerId: 'deploy-001',
        symptoms: [
          {
            type: 'deployment_failure',
            source: 'kubernetes-deploy-01',
            description: 'Container in CrashLoopBackOff state',
            severity: 'error',
          },
        ],
      });

      expect(result.session.id).toBeDefined();
      expect(result.session.status).toBe('completed');
      expect(result.session.rootCause).not.toBeNull();
      expect(result.session.confidence).toBeGreaterThanOrEqual(0);
      expect(result.report.id).toBeDefined();
      expect(result.report.sessionId).toBe(result.session.id);
      expect(result.report.summary).toBeDefined();
      expect(result.report.recommendations.length).toBeGreaterThan(0);
    });

    it('should include tenant ID in result', async () => {
      const result = await service.triggerDiagnostic({
        triggerType: 'manual',
        triggerId: 'manual-001',
        symptoms: [
          {
            type: 'error',
            source: 'test-service',
            description: 'Test error',
            severity: 'error',
          },
        ],
        tenantId: 'tenant-001',
      });

      expect(result.session.tenantId).toBe('tenant-001');
      expect(result.report.tenantId).toBe('tenant-001');
    });

    it('should handle multiple symptoms', async () => {
      const result = await service.triggerDiagnostic({
        triggerType: 'incident',
        triggerId: 'incident-001',
        symptoms: [
          {
            type: 'database_error',
            source: 'app-db-01',
            description: 'Connection timeout',
            severity: 'error',
          },
          {
            type: 'network_issue',
            source: 'network-01',
            description: 'High latency detected',
            severity: 'warning',
          },
        ],
      });

      expect(result.session.symptoms.length).toBe(2);
      expect(result.session.findings.length).toBeGreaterThan(0);
    });
  });

  // ==================== addSymptomToSession ====================

  describe('addSymptomToSession', () => {
    let sessionId: string;

    beforeEach(async () => {
      const result = await service.triggerDiagnostic({
        triggerType: 'deployment_failure',
        triggerId: 'deploy-001',
        symptoms: [
          {
            type: 'deployment_failure',
            source: 'kubernetes-deploy',
            description: 'Initial error',
            severity: 'error',
          },
        ],
      });
      sessionId = result.session.id;
    });

    it('should add symptom to existing session', async () => {
      const session = await service.addSymptomToSession(sessionId, {
        type: 'network_issue',
        source: 'network-01',
        description: 'Network timeout',
        severity: 'warning',
      });

      expect(session.symptoms.length).toBeGreaterThan(1);
    });

    it('should throw error for non-existent session', async () => {
      await expect(
        service.addSymptomToSession('non-existent', {
          type: 'error',
          source: 'test',
          description: 'Test',
          severity: 'error',
        })
      ).rejects.toThrow('Diagnostic session non-existent not found');
    });
  });

  // ==================== getDiagnosticHistory ====================

  describe('getDiagnosticHistory', () => {
    beforeEach(async () => {
      await service.triggerDiagnostic({
        triggerType: 'deployment_failure',
        triggerId: 'deploy-1',
        symptoms: [
          { type: 'error', source: 'test', description: 'err', severity: 'error' },
        ],
        tenantId: 'tenant-a',
      });

      await service.triggerDiagnostic({
        triggerType: 'pipeline_failure',
        triggerId: 'pipeline-1',
        symptoms: [
          { type: 'error', source: 'test', description: 'err', severity: 'error' },
        ],
        tenantId: 'tenant-b',
      });

      await service.triggerDiagnostic({
        triggerType: 'deployment_failure',
        triggerId: 'deploy-2',
        symptoms: [
          { type: 'error', source: 'test', description: 'err', severity: 'error' },
        ],
        tenantId: 'tenant-a',
      });
    });

    it('should return all sessions by default', () => {
      const history = service.getDiagnosticHistory();
      expect(history.length).toBe(3);
    });

    it('should filter by triggerType', () => {
      const history = service.getDiagnosticHistory({ triggerType: 'deployment_failure' });
      expect(history.length).toBe(2);
    });

    it('should filter by tenantId', () => {
      const history = service.getDiagnosticHistory({ tenantId: 'tenant-a' });
      expect(history.length).toBe(2);
    });

    it('should limit results', () => {
      const history = service.getDiagnosticHistory({ limit: 2 });
      expect(history.length).toBe(2);
    });
  });

  // ==================== getDiagnosticDetail ====================

  describe('getDiagnosticDetail', () => {
    it('should return session detail by ID', async () => {
      const result = await service.triggerDiagnostic({
        triggerType: 'manual',
        triggerId: 'manual-001',
        symptoms: [
          { type: 'error', source: 'test', description: 'err', severity: 'error' },
        ],
      });

      const detail = service.getDiagnosticDetail(result.session.id);
      expect(detail).toBeDefined();
      expect(detail!.id).toBe(result.session.id);
    });

    it('should return undefined for non-existent ID', () => {
      const detail = service.getDiagnosticDetail('non-existent');
      expect(detail).toBeUndefined();
    });
  });

  // ==================== Reports ====================

  describe('report management', () => {
    let reportId: string;

    beforeEach(async () => {
      const result = await service.triggerDiagnostic({
        triggerType: 'manual',
        triggerId: 'manual-001',
        symptoms: [
          { type: 'error', source: 'test', description: 'err', severity: 'error' },
        ],
        tenantId: 'tenant-001',
      });
      reportId = result.report.id;
    });

    it('should get report by ID', () => {
      const report = service.getReport(reportId);
      expect(report).toBeDefined();
      expect(report!.id).toBe(reportId);
    });

    it('should get report by session ID', async () => {
      const result = await service.triggerDiagnostic({
        triggerType: 'manual',
        triggerId: 'manual-002',
        symptoms: [
          { type: 'error', source: 'test', description: 'err', severity: 'error' },
        ],
      });

      const report = service.getReportBySession(result.session.id);
      expect(report).toBeDefined();
      expect(report!.sessionId).toBe(result.session.id);
    });

    it('should return undefined for non-existent report', () => {
      const report = service.getReport('non-existent');
      expect(report).toBeUndefined();
    });

    it('should return report history', () => {
      const reports = service.getReportHistory();
      expect(reports.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter report history by tenantId', () => {
      const reports = service.getReportHistory({ tenantId: 'tenant-001' });
      expect(reports.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ==================== Knowledge Base ====================

  describe('knowledge base management', () => {
    it('should add a diagnostic pattern', () => {
      const pattern = service.addPattern({
        name: 'Custom Pattern',
        symptoms: [
          {
            type: 'custom_error',
            keywords: ['custom', 'error'],
          },
        ],
        rootCause: 'Custom root cause',
        solution: 'Custom solution',
        category: 'application',
      });

      expect(pattern.id).toBeDefined();
      expect(pattern.name).toBe('Custom Pattern');
    });

    it('should get pattern by ID', () => {
      const pattern = service.addPattern({
        name: 'Test Pattern',
        symptoms: [{ type: 'error' }],
        rootCause: 'Test cause',
        solution: 'Test solution',
        category: 'application',
      });

      const found = service.getPattern(pattern.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(pattern.id);
    });

    it('should search patterns', () => {
      service.addPattern({
        name: 'Database Issue',
        symptoms: [{ type: 'database_error' }],
        rootCause: 'DB connection failure',
        solution: 'Fix connection',
        category: 'database',
      });

      const results = service.searchPatterns({ category: 'database' });
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should match symptoms', () => {
      service.addPattern({
        name: 'DB Pattern',
        symptoms: [
          {
            type: 'database_error',
            keywords: ['connection', 'timeout'],
          },
        ],
        rootCause: 'DB issue',
        solution: 'Fix DB',
        category: 'database',
      });

      const symptoms: Symptom[] = [
        {
          type: 'database_error',
          source: 'db-01',
          description: 'Connection timeout to database',
          severity: 'error',
          timestamp: new Date(),
        },
      ];

      const matches = service.matchSymptoms(symptoms);
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });

    it('should get all patterns', () => {
      const patterns = service.getAllPatterns();
      expect(patterns.length).toBeGreaterThan(0); // Default patterns exist
    });

    it('should record outcome', async () => {
      const pattern = service.addPattern({
        name: 'Test Pattern',
        symptoms: [{ type: 'error' }],
        rootCause: 'Test cause',
        solution: 'Test solution',
        category: 'application',
      });

      const result = await service.triggerDiagnostic({
        triggerType: 'manual',
        triggerId: 'manual-001',
        symptoms: [{ type: 'error', source: 'test', description: 'err', severity: 'error' }],
      });

      const outcome = service.recordOutcome({
        sessionId: result.session.id,
        patternId: pattern.id,
        confirmed: true,
        fixTimeMs: 300000,
      });

      expect(outcome.sessionId).toBe(result.session.id);
      expect(outcome.confirmed).toBe(true);
    });

    it('should get knowledge base stats', () => {
      const stats = service.getKnowledgeBaseStats();

      expect(stats.totalPatterns).toBeGreaterThan(0);
      expect(stats.patternsByCategory).toBeDefined();
      expect(stats.topPatterns).toBeDefined();
    });
  });

  // ==================== estimateFixComplexity ====================

  describe('estimateFixComplexity', () => {
    it('should estimate fix complexity for a session', async () => {
      const result = await service.triggerDiagnostic({
        triggerType: 'deployment_failure',
        triggerId: 'deploy-001',
        symptoms: [
          {
            type: 'deployment_failure',
            source: 'kubernetes-deploy',
            description: 'CrashLoopBackOff',
            severity: 'error',
          },
        ],
      });

      const estimate = service.estimateFixComplexity(result.session.id);

      expect(estimate.complexity).toBeDefined();
      expect(estimate.estimatedFixTimeMs).toBeGreaterThan(0);
      expect(estimate.description).toBeDefined();
    });

    it('should throw error for non-existent session', () => {
      expect(() => {
        service.estimateFixComplexity('non-existent');
      }).toThrow('Diagnostic session non-existent not found');
    });
  });

  // ==================== getStatus ====================

  describe('getStatus', () => {
    it('should return service status', () => {
      const status = service.getStatus();

      expect(status.service).toBe('diagnostic-agent');
      expect(status.sessionsCount).toBe(0);
      expect(status.reportsCount).toBe(0);
      expect(status.patternsCount).toBeGreaterThan(0); // Default patterns
    });

    it('should reflect counts after operations', async () => {
      await service.triggerDiagnostic({
        triggerType: 'manual',
        triggerId: 'manual-001',
        symptoms: [{ type: 'error', source: 'test', description: 'err', severity: 'error' }],
      });

      const status = service.getStatus();
      expect(status.sessionsCount).toBe(1);
      expect(status.reportsCount).toBe(1);
    });
  });

  // ==================== clearAll ====================

  describe('clearAll', () => {
    it('should clear all sessions and reports', async () => {
      await service.triggerDiagnostic({
        triggerType: 'manual',
        triggerId: 'manual-001',
        symptoms: [{ type: 'error', source: 'test', description: 'err', severity: 'error' }],
      });

      service.clearAll();

      const status = service.getStatus();
      expect(status.sessionsCount).toBe(0);
      expect(status.reportsCount).toBe(0);
    });
  });
});
