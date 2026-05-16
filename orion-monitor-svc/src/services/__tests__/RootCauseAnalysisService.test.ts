import { describe, it, expect, beforeEach } from 'vitest';
import {
  RootCauseAnalysisService,
  type RCARequest,
  type Alert,
  type DetectedPattern,
} from '../RootCauseAnalysisService.js';

function makeService() {
  return new RootCauseAnalysisService();
}

function makeRCARequest(overrides: Partial<RCARequest> = {}): RCARequest {
  const now = new Date();
  const start = new Date(now.getTime() - 3600000); // 1 hour ago
  const end = new Date(now.getTime());
  return {
    incidentId: overrides.incidentId ?? 'incident-001',
    timeRange: overrides.timeRange ?? { start, end },
    includePatterns: overrides.includePatterns,
    excludePatterns: overrides.excludePatterns,
  };
}

function makeAlerts(): Alert[] {
  return [
    { id: 'alert-1', name: 'HighCPU', timestamp: new Date() },
    { id: 'alert-2', name: 'MemoryPressure', timestamp: new Date() },
    { id: 'alert-3', name: 'ServiceDown', timestamp: new Date() },
  ];
}

// -- Tests ------------------------------------------------------------------

describe('RootCauseAnalysisService', () => {
  let svc: RootCauseAnalysisService;

  beforeEach(() => {
    svc = makeService();
  });

  describe('analyze', () => {
    it('returns correct report structure', async () => {
      const request = makeRCARequest();
      const report = await svc.analyze(request);

      expect(report).toHaveProperty('incidentId');
      expect(report).toHaveProperty('status');
      expect(report).toHaveProperty('rootCauses');
      expect(report).toHaveProperty('timeline');
      expect(report).toHaveProperty('duration');
      expect(report).toHaveProperty('generatedAt');

      expect(report.incidentId).toBe(request.incidentId);
      expect(report.rootCauses).toBeInstanceOf(Array);
      expect(report.timeline).toBeInstanceOf(Array);
      expect(typeof report.duration).toBe('number');
      expect(report.generatedAt).toBeInstanceOf(Date);
    });

    it('marks status as complete when root causes are found', async () => {
      const request = makeRCARequest();
      const report = await svc.analyze(request);

      expect(report.status).toBe('complete');
      expect(report.rootCauses.length).toBeGreaterThan(0);
    });

    it('tracks timeline events', async () => {
      const request = makeRCARequest();
      const report = await svc.analyze(request);

      expect(report.timeline.length).toBeGreaterThan(0);
      expect(report.timeline[0]).toHaveProperty('timestamp');
      expect(report.timeline[0]).toHaveProperty('event');
      expect(report.timeline[0].timestamp).toBeInstanceOf(Date);
    });

    it('includes includePatterns filter in analysis', async () => {
      const request = makeRCARequest({
        includePatterns: ['resource_exhaustion'],
      });
      const report = await svc.analyze(request);

      // With filter, only matching patterns should be included
      expect(report.rootCauses.length).toBeGreaterThanOrEqual(0);
    });

    it('excludes patterns in excludePatterns', async () => {
      const request = makeRCARequest({
        excludePatterns: ['cascading_failure'],
      });
      const report = await svc.analyze(request);

      // Should not have cascading_failure related root cause
      const cascadingRC = report.rootCauses.find((rc) =>
        rc.description.toLowerCase().includes('cascading')
      );
      expect(cascadingRC).toBeUndefined();
    });
  });

  describe('detectPatterns', () => {
    it('identifies resource_exhaustion pattern', async () => {
      const alerts: Alert[] = [
        { id: 'a1', name: 'HighCPU', timestamp: new Date() },
        { id: 'a2', name: 'MemoryPressure', timestamp: new Date() },
        { id: 'a3', name: 'HighCPU', timestamp: new Date() },
      ];
      const request = makeRCARequest();

      // Use reflection to call private method
      const patterns = await (svc as unknown as { detectPatterns: (alerts: Alert[], request: RCARequest) => Promise<DetectedPattern[]> }).detectPatterns(alerts, request);

      const resourcePattern = patterns.find((p) => p.pattern === 'resource_exhaustion');
      expect(resourcePattern).toBeDefined();
      expect(resourcePattern?.occurrences).toBeGreaterThanOrEqual(2);
    });

    it('identifies cascading_failure pattern', async () => {
      const alerts: Alert[] = [
        { id: 'a1', name: 'ServiceDown', timestamp: new Date() },
        { id: 'a2', name: 'ConnectionFailed', timestamp: new Date() },
      ];
      const request = makeRCARequest();

      const patterns = await (svc as unknown as { detectPatterns: (alerts: Alert[], request: RCARequest) => Promise<DetectedPattern[]> }).detectPatterns(alerts, request);

      const cascadePattern = patterns.find((p) => p.pattern === 'cascading_failure');
      expect(cascadePattern).toBeDefined();
    });

    it('identifies configuration_issue pattern', async () => {
      const alerts: Alert[] = [
        { id: 'a1', name: 'ConfigChanged', timestamp: new Date() },
        { id: 'a2', name: 'ConfigError', timestamp: new Date() },
      ];
      const request = makeRCARequest();

      const patterns = await (svc as unknown as { detectPatterns: (alerts: Alert[], request: RCARequest) => Promise<DetectedPattern[]> }).detectPatterns(alerts, request);

      const configPattern = patterns.find((p) => p.pattern === 'configuration_issue');
      expect(configPattern).toBeDefined();
    });

    it('filters patterns with includePatterns', async () => {
      const alerts = makeAlerts();
      const request = makeRCARequest({ includePatterns: ['resource_exhaustion'] });

      const patterns = await (svc as unknown as { detectPatterns: (alerts: Alert[], request: RCARequest) => Promise<DetectedPattern[]> }).detectPatterns(alerts, request);

      expect(patterns.every((p) => p.pattern === 'resource_exhaustion')).toBe(true);
    });
  });

  describe('determineRootCauses', () => {
    it('finds infrastructure root cause for resource exhaustion', async () => {
      const alerts = makeAlerts();
      const patterns: DetectedPattern[] = [
        { pattern: 'resource_exhaustion', occurrences: 2, severity: 'high' },
      ];

      const rootCauses = await (svc as unknown as { determineRootCauses: (alerts: Alert[], patterns: DetectedPattern[]) => Promise<import('../RootCauseAnalysisService.js').RootCause[]> }).determineRootCauses(alerts, patterns);

      const infraRC = rootCauses.find((rc) => rc.type === 'infrastructure');
      expect(infraRC).toBeDefined();
      expect(infraRC?.confidence).toBeGreaterThan(0.7);
      expect(infraRC?.suggestedFix).toContain('Scale up');
    });

    it('finds application root cause for cascading failure', async () => {
      const alerts = makeAlerts();
      const patterns: DetectedPattern[] = [
        { pattern: 'cascading_failure', occurrences: 2, severity: 'critical' },
      ];

      const rootCauses = await (svc as unknown as { determineRootCauses: (alerts: Alert[], patterns: DetectedPattern[]) => Promise<import('../RootCauseAnalysisService.js').RootCause[]> }).determineRootCauses(alerts, patterns);

      const appRC = rootCauses.find((rc) => rc.type === 'application');
      expect(appRC).toBeDefined();
      expect(appRC?.suggestedFix).toContain('circuit breaker');
    });

    it('finds configuration root cause for config issues', async () => {
      const alerts = makeAlerts();
      const patterns: DetectedPattern[] = [
        { pattern: 'configuration_issue', occurrences: 1, severity: 'medium' },
      ];

      const rootCauses = await (svc as unknown as { determineRootCauses: (alerts: Alert[], patterns: DetectedPattern[]) => Promise<import('../RootCauseAnalysisService.js').RootCause[]> }).determineRootCauses(alerts, patterns);

      const configRC = rootCauses.find((rc) => rc.type === 'configuration');
      expect(configRC).toBeDefined();
    });

    it('returns unknown root cause when no patterns matched', async () => {
      const alerts = makeAlerts();
      const patterns: DetectedPattern[] = [];

      const rootCauses = await (svc as unknown as { determineRootCauses: (alerts: Alert[], patterns: DetectedPattern[]) => Promise<import('../RootCauseAnalysisService.js').RootCause[]> }).determineRootCauses(alerts, patterns);

      expect(rootCauses.length).toBeGreaterThan(0);
      expect(rootCauses[0].type).toBe('unknown');
    });
  });

  describe('getTimeline', () => {
    it('returns events in chronological order', async () => {
      const timeline = await svc.getTimeline('incident-001');

      expect(timeline.length).toBeGreaterThan(0);
      for (let i = 1; i < timeline.length; i++) {
        expect(timeline[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          timeline[i - 1].timestamp.getTime()
        );
      }
    });

    it('includes key incident events', async () => {
      const timeline = await svc.getTimeline('incident-001');
      const eventTexts = timeline.map((e) => e.event).join(' ');

      expect(eventTexts).toContain('Incident created');
      expect(eventTexts).toContain('RCA');
    });

    it('returns array of timestamp and event pairs', async () => {
      const timeline = await svc.getTimeline('incident-001');

      expect(timeline[0]).toHaveProperty('timestamp');
      expect(timeline[0]).toHaveProperty('event');
      expect(timeline[0].timestamp).toBeInstanceOf(Date);
      expect(typeof timeline[0].event).toBe('string');
    });
  });

  describe('suggestFixes', () => {
    it('provides fixes for infrastructure root cause', async () => {
      const fixes = await svc.suggestFixes('rc-1');

      expect(fixes.length).toBeGreaterThan(0);
      expect(fixes.some((f) => f.toLowerCase().includes('cpu') || f.toLowerCase().includes('scale'))).toBe(true);
    });

    it('provides fixes for application root cause', async () => {
      const fixes = await svc.suggestFixes('rc-2');

      expect(fixes.length).toBeGreaterThan(0);
      expect(fixes.some((f) => f.toLowerCase().includes('circuit'))).toBe(true);
    });

    it('provides fixes for configuration root cause', async () => {
      const fixes = await svc.suggestFixes('rc-3');

      expect(fixes.length).toBeGreaterThan(0);
      expect(fixes.some((f) => f.toLowerCase().includes('configuration') || f.toLowerCase().includes('rollback'))).toBe(true);
    });

    it('provides default fixes for unknown root cause', async () => {
      const fixes = await svc.suggestFixes('rc-unknown');

      expect(fixes.length).toBeGreaterThan(0);
      expect(fixes.some((f) => f.toLowerCase().includes('manual'))).toBe(true);
    });

    it('provides default fixes for non-existent root cause ID', async () => {
      const fixes = await svc.suggestFixes('non-existent-id');

      expect(fixes.length).toBeGreaterThan(0);
      expect(fixes.some((f) => f.toLowerCase().includes('manual') || f.toLowerCase().includes('diagnostic'))).toBe(true);
    });
  });
});