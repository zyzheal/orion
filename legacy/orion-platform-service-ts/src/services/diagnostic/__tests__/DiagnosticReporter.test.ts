/**
 * DiagnosticReporter 单元测试
 */

import { DiagnosticReporter } from '../DiagnosticReporter';
import { DiagnosticSession, RootCause, Symptom, Finding } from '../../types';

describe('DiagnosticReporter', () => {
  let reporter: DiagnosticReporter;

  beforeEach(() => {
    reporter = new DiagnosticReporter();
  });

  // ==================== generateReport ====================

  describe('generateReport', () => {
    const createMockSession = (overrides?: Partial<DiagnosticSession>): DiagnosticSession => ({
      id: 'session-001',
      triggerType: 'deployment_failure',
      triggerId: 'deploy-001',
      symptoms: [
        {
          type: 'deployment_failure',
          source: 'kubernetes-deploy',
          description: 'Container in CrashLoopBackOff',
          severity: 'error',
          timestamp: new Date(),
        },
      ],
      findings: [
        {
          description: 'Container startup failure detected',
          category: 'deployment',
          evidence: ['Container status shows CrashLoopBackOff'],
          severity: 'error',
          relatedSymptoms: ['deployment_failure'],
        },
      ],
      rootCause: {
        description: 'Application startup error causing container restart loop',
        category: 'deployment',
        confidence: 75,
        evidence: ['CrashLoopBackOff status', 'Container logs show startup error'],
        recommendedActions: [
          {
            description: 'Check container logs',
            actionType: 'investigate',
            priority: 'critical',
            estimatedTimeMs: 300000,
            automationLevel: 'semi_auto',
            commands: ['kubectl logs <pod-name> --previous'],
          },
          {
            description: 'Fix application error and redeploy',
            actionType: 'fix',
            priority: 'high',
            estimatedTimeMs: 600000,
            automationLevel: 'manual',
          },
        ],
      },
      confidence: 75,
      status: 'completed',
      createdAt: new Date(),
      completedAt: new Date(),
      ...overrides,
    });

    it('should generate a complete diagnostic report', () => {
      const session = createMockSession();
      const report = reporter.generateReport(session);

      expect(report.id).toBeDefined();
      expect(report.sessionId).toBe(session.id);
      expect(report.summary).toBeDefined();
      expect(report.findings.length).toBe(session.findings.length);
      expect(report.rootCause).toEqual(session.rootCause);
      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.timeline.length).toBeGreaterThan(0);
      expect(report.estimatedFixTimeMs).toBeGreaterThan(0);
      expect(report.generatedAt).toBeInstanceOf(Date);
    });

    it('should include tenant ID in report', () => {
      const session = createMockSession({ tenantId: 'tenant-001' });
      const report = reporter.generateReport(session);

      expect(report.tenantId).toBe('tenant-001');
    });

    it('should handle session without root cause', () => {
      const session = createMockSession({
        rootCause: null,
        confidence: 0,
        findings: [],
      });
      const report = reporter.generateReport(session);

      expect(report.rootCause).toBeNull();
      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });

  // ==================== formatTimeline ====================

  describe('formatTimeline', () => {
    it('should create timeline from session events', () => {
      const session: DiagnosticSession = {
        id: 'session-001',
        triggerType: 'incident',
        triggerId: 'incident-001',
        symptoms: [
          {
            type: 'error',
            source: 'service-a',
            description: 'Service error',
            severity: 'error',
            timestamp: new Date('2024-01-01T10:00:00Z'),
          },
          {
            type: 'warning',
            source: 'service-b',
            description: 'High latency',
            severity: 'warning',
            timestamp: new Date('2024-01-01T10:01:00Z'),
          },
        ],
        findings: [
          {
            description: 'Multiple services affected',
            category: 'infrastructure',
            evidence: ['service-a error', 'service-b latency'],
            severity: 'error',
            relatedSymptoms: ['error', 'warning'],
          },
        ],
        rootCause: {
          description: 'Network issue',
          category: 'network',
          confidence: 60,
          evidence: ['Multiple services affected'],
          recommendedActions: [],
        },
        confidence: 60,
        status: 'completed',
        createdAt: new Date('2024-01-01T10:00:00Z'),
        completedAt: new Date('2024-01-01T10:05:00Z'),
      };

      const timeline = reporter.formatTimeline(session);

      expect(timeline.length).toBe(4); // 2 symptoms + 1 finding + 1 root cause
      expect(timeline[0].timestamp).toBeDefined();
      expect(timeline[0].description).toBeDefined();
      expect(timeline[0].eventType).toBeDefined();
    });

    it('should sort timeline by timestamp', () => {
      const session: DiagnosticSession = {
        id: 'session-001',
        triggerType: 'manual',
        triggerId: 'manual-001',
        symptoms: [
          {
            type: 'error2',
            source: 'src',
            description: 'Later error',
            severity: 'error',
            timestamp: new Date('2024-01-01T12:00:00Z'),
          },
          {
            type: 'error1',
            source: 'src',
            description: 'Earlier error',
            severity: 'error',
            timestamp: new Date('2024-01-01T10:00:00Z'),
          },
        ],
        findings: [],
        rootCause: null,
        confidence: 0,
        status: 'completed',
        createdAt: new Date(),
        completedAt: new Date(),
      };

      const timeline = reporter.formatTimeline(session);

      expect(timeline.length).toBe(2);
      expect(timeline[0].description).toContain('Earlier error');
      expect(timeline[1].description).toContain('Later error');
    });

    it('should include root cause in timeline', () => {
      const session: DiagnosticSession = {
        id: 'session-001',
        triggerType: 'manual',
        triggerId: 'manual-001',
        symptoms: [],
        findings: [],
        rootCause: {
          description: 'Test root cause',
          category: 'application',
          confidence: 80,
          evidence: [],
          recommendedActions: [],
        },
        confidence: 80,
        status: 'completed',
        createdAt: new Date(),
        completedAt: new Date(),
      };

      const timeline = reporter.formatTimeline(session);

      const rootCauseEntry = timeline.find((e) => e.eventType === 'root_cause_identified');
      expect(rootCauseEntry).toBeDefined();
      expect(rootCauseEntry!.description).toContain('Test root cause');
      expect(rootCauseEntry!.description).toContain('80');
    });
  });

  // ==================== formatRecommendations ====================

  describe('formatRecommendations', () => {
    it('should format recommendations with priority order', () => {
      const recommendations = [
        {
          description: 'Low priority action',
          actionType: 'investigate' as const,
          priority: 'low' as const,
          estimatedTimeMs: 600000,
          automationLevel: 'manual' as const,
        },
        {
          description: 'Critical action',
          actionType: 'fix' as const,
          priority: 'critical' as const,
          estimatedTimeMs: 300000,
          automationLevel: 'semi_auto' as const,
        },
        {
          description: 'High priority action',
          actionType: 'investigate' as const,
          priority: 'high' as const,
          estimatedTimeMs: 180000,
          automationLevel: 'manual' as const,
        },
      ];

      const formatted = reporter.formatRecommendations(recommendations);

      expect(formatted.length).toBe(3);
      expect(formatted[0]).toContain('CRITICAL');
      expect(formatted[1]).toContain('HIGH');
      expect(formatted[2]).toContain('LOW');
    });

    it('should include automation labels', () => {
      const recommendations = [
        {
          description: 'Auto action',
          actionType: 'fix' as const,
          priority: 'high' as const,
          estimatedTimeMs: 300000,
          automationLevel: 'fully_auto' as const,
        },
        {
          description: 'Manual action',
          actionType: 'investigate' as const,
          priority: 'medium' as const,
          estimatedTimeMs: 600000,
          automationLevel: 'manual' as const,
        },
      ];

      const formatted = reporter.formatRecommendations(recommendations);

      expect(formatted[0]).toContain('[Auto]');
      expect(formatted[1]).toContain('[Manual]');
    });

    it('should include commands when present', () => {
      const recommendations = [
        {
          description: 'Check logs',
          actionType: 'investigate' as const,
          priority: 'high' as const,
          estimatedTimeMs: 180000,
          automationLevel: 'semi_auto' as const,
          commands: ['kubectl logs pod-1', 'kubectl describe pod pod-1'],
        },
      ];

      const formatted = reporter.formatRecommendations(recommendations);

      expect(formatted[0]).toContain('Commands:');
      expect(formatted[0]).toContain('kubectl logs pod-1');
    });

    it('should include time estimates', () => {
      const recommendations = [
        {
          description: 'Action with time estimate',
          actionType: 'fix' as const,
          priority: 'high' as const,
          estimatedTimeMs: 600000, // 10 minutes
          automationLevel: 'manual' as const,
        },
      ];

      const formatted = reporter.formatRecommendations(recommendations);

      expect(formatted[0]).toContain('~10min');
    });
  });

  // ==================== estimateFixComplexity ====================

  describe('estimateFixComplexity', () => {
    it('should return expert complexity when root cause is unknown', () => {
      const session: DiagnosticSession = {
        id: 'session-001',
        triggerType: 'manual',
        triggerId: 'manual-001',
        symptoms: [],
        findings: [],
        rootCause: null,
        confidence: 0,
        status: 'completed',
        createdAt: new Date(),
      };

      const estimate = reporter.estimateFixComplexity(session);

      expect(estimate.complexity).toBe('expert');
      expect(estimate.manualInterventionRequired).toBe(true);
      expect(estimate.riskLevel).toBe('high');
    });

    it('should estimate based on recommended actions', () => {
      const session: DiagnosticSession = {
        id: 'session-001',
        triggerType: 'deployment_failure',
        triggerId: 'deploy-001',
        symptoms: [
          {
            type: 'deployment_failure',
            source: 'kubernetes',
            description: 'CrashLoopBackOff',
            severity: 'error',
            timestamp: new Date(),
          },
        ],
        findings: [],
        rootCause: {
          description: 'Container startup error',
          category: 'deployment',
          confidence: 80,
          evidence: ['CrashLoopBackOff'],
          recommendedActions: [
            {
              description: 'Check logs',
              actionType: 'investigate',
              priority: 'critical',
              estimatedTimeMs: 180000,
              automationLevel: 'semi_auto',
            },
            {
              description: 'Fix and redeploy',
              actionType: 'fix',
              priority: 'high',
              estimatedTimeMs: 600000,
              automationLevel: 'manual',
            },
          ],
        },
        confidence: 80,
        status: 'completed',
        createdAt: new Date(),
      };

      const estimate = reporter.estimateFixComplexity(session);

      expect(estimate.complexity).toBeDefined();
      expect(estimate.estimatedFixTimeMs).toBe(780000); // 180000 + 600000
      expect(estimate.description).toBeDefined();
    });
  });
});
