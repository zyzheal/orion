/**
 * Tests for RootCauseAnalysisService
 */

import { RootCauseAnalysisService, RcaAlert, TimeWindow } from '../RootCauseAnalysisService';

describe('RootCauseAnalysisService', () => {
  let service: RootCauseAnalysisService;

  beforeEach(() => {
    service = new RootCauseAnalysisService();
  });

  const timeWindow: TimeWindow = {
    startTime: new Date(Date.now() - 30 * 60 * 1000),
    endTime: new Date(),
  };

  const sampleAlerts: RcaAlert[] = [
    {
      id: 'alert-1',
      name: 'Database Connection Pool Exhausted',
      service: 'postgres-primary',
      severity: 'critical',
      firedAt: new Date(Date.now() - 60 * 1000), // 1 min ago (within correlation window)
      message: 'Connection pool exhausted',
    },
    {
      id: 'alert-2',
      name: 'API Latency High',
      service: 'api-gateway',
      severity: 'warning',
      firedAt: new Date(Date.now() - 30 * 1000), // 30 sec ago
      message: 'P99 latency > 2s',
    },
    {
      id: 'alert-3',
      name: 'User Service Timeout',
      service: 'user-service',
      severity: 'critical',
      firedAt: new Date(), // now
      message: 'Request timeout to user-service',
    },
  ];

  // ==================== analyze ====================

  describe('analyze', () => {
    it('should perform RCA on multiple alerts', async () => {
      const result = await service.analyze(
        ['postgres-primary', 'api-gateway', 'user-service'],
        sampleAlerts,
        timeWindow,
      );

      expect(result.analysisId).toBeDefined();
      expect(result.status).toBe('completed');
      expect(result.alertCount).toBe(3);
      expect(result.rootCause).not.toBeNull();
      expect(result.topRootCauses.length).toBeGreaterThan(0);
    });

    it('should identify the root cause', async () => {
      const result = await service.analyze(
        ['postgres-primary', 'api-gateway'],
        sampleAlerts,
        timeWindow,
      );

      expect(result.rootCause).not.toBeNull();
      expect(result.rootCause!.confidence).toBeGreaterThan(0);
      expect(result.rootCause!.confidence).toBeLessThanOrEqual(1);
    });

    it('should list affected services', async () => {
      const result = await service.analyze(
        ['postgres-primary', 'api-gateway', 'user-service'],
        sampleAlerts,
        timeWindow,
      );

      expect(result.affectedServices.length).toBeGreaterThan(0);
      const serviceNames = result.affectedServices.map((s) => s.name);
      expect(serviceNames).toContain('postgres-primary');
    });

    it('should return partial status when no groups found', async () => {
      const result = await service.analyze([], [], timeWindow);
      expect(result.status).toBe('partial');
      expect(result.rootCause).toBeNull();
    });

    it('should store analysis result', async () => {
      const result = await service.analyze(
        ['service-a'],
        [sampleAlerts[0]],
        timeWindow,
      );

      const retrieved = service.getAnalysis(result.analysisId);
      expect(retrieved).toBeDefined();
      expect(retrieved!.analysisId).toBe(result.analysisId);
    });
  });

  // ==================== getCorrelatedAlerts ====================

  describe('getCorrelatedAlerts', () => {
    it('should return correlated alerts for given IDs', async () => {
      await service.analyze(
        ['postgres-primary'],
        sampleAlerts,
        timeWindow,
      );

      const correlated = service.getCorrelatedAlerts(['alert-1', 'alert-2']);
      expect(correlated.length).toBeGreaterThan(0);
    });

    it('should return empty for non-matching IDs', async () => {
      const correlated = service.getCorrelatedAlerts(['non-existent']);
      expect(correlated).toEqual([]);
    });
  });

  // ==================== getTopRootCauses ====================

  describe('getTopRootCauses', () => {
    beforeEach(async () => {
      // Generate some analysis data
      await service.analyze(
        ['postgres-primary', 'api-gateway', 'user-service'],
        sampleAlerts,
        timeWindow,
      );
    });

    it('should return top root causes', async () => {
      const causes = service.getTopRootCauses('default');
      expect(Array.isArray(causes)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const causes = service.getTopRootCauses('default', undefined, 1);
      expect(causes.length).toBeLessThanOrEqual(1);
    });

    it('should return causes sorted by confidence', async () => {
      const causes = service.getTopRootCauses('default');
      for (let i = 1; i < causes.length; i++) {
        expect(causes[i - 1].confidence).toBeGreaterThanOrEqual(causes[i].confidence);
      }
    });

    it('should filter by time window', async () => {
      const futureWindow: TimeWindow = {
        startTime: new Date(Date.now() + 1000),
        endTime: new Date(Date.now() + 2000),
      };
      const causes = service.getTopRootCauses('default', futureWindow);
      expect(causes.length).toBe(0);
    });
  });

  // ==================== getAnalysis ====================

  describe('getAnalysis', () => {
    it('should return undefined for non-existent analysis', async () => {
      const result = service.getAnalysis('non-existent');
      expect(result).toBeUndefined();
    });

    it('should return the analysis by ID', async () => {
      const created = await service.analyze(['svc'], [sampleAlerts[0]], timeWindow);
      const retrieved = service.getAnalysis(created.analysisId);
      expect(retrieved).toBeDefined();
      expect(retrieved!.analysisId).toBe(created.analysisId);
    });
  });

  // ==================== getAllAnalyses ====================

  describe('getAllAnalyses', () => {
    it('should return all analyses', async () => {
      await service.analyze(['svc1'], [sampleAlerts[0]], timeWindow);
      await service.analyze(['svc2'], [sampleAlerts[1]], timeWindow);

      const all = service.getAllAnalyses();
      expect(all.length).toBe(2);
    });

    it('should respect limit', async () => {
      await service.analyze(['svc1'], [sampleAlerts[0]], timeWindow);
      await service.analyze(['svc2'], [sampleAlerts[1]], timeWindow);

      const limited = service.getAllAnalyses(1);
      expect(limited.length).toBe(1);
    });
  });
});
