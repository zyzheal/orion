/**
 * diagnostic/types.ts - Type definition verification tests
 *
 * Verifies that all type definitions are correctly exported and
 * that sample objects conform to the expected interfaces.
 */

import type {
  DiagnosticTriggerType,
  DiagnosticSessionStatus,
  SymptomSeverity,
  DiagnosticCategory,
  RootCauseCategory,
  FixComplexity,
  Symptom,
  Finding,
  RecommendedAction,
  RootCause,
  DiagnosticSession,
  DiagnosticReport,
  TimelineEntry,
  DiagnosticPattern,
  SymptomPattern,
  DiagnosticOutcome,
  TriggerDiagnosticRequest,
  AddSymptomRequest,
  AddPatternRequest,
  DiagnosticHistoryQuery,
  KnowledgeBaseQuery,
} from '../types';

// Re-import all exports to verify barrel file works
import * as types from '../types';

describe('diagnostic/types', () => {
  // ==================== Type Guards / Runtime Verification ====================

  describe('Symptom', () => {
    it('should accept valid symptom object', () => {
      const symptom: Symptom = {
        type: 'high_cpu',
        source: 'web-server',
        description: 'CPU > 90%',
        severity: 'critical',
        timestamp: new Date(),
      };
      expect(symptom.type).toBe('high_cpu');
      expect(symptom.severity).toBe('critical');
    });

    it('should accept optional metadata', () => {
      const symptom: Symptom = {
        type: 'test',
        source: 'src',
        description: 'desc',
        severity: 'info',
        timestamp: new Date(),
        metadata: { key: 'value' },
      };
      expect(symptom.metadata).toEqual({ key: 'value' });
    });
  });

  describe('Finding', () => {
    it('should accept valid finding object', () => {
      const finding: Finding = {
        description: 'Memory leak',
        category: 'application',
        evidence: ['heap dump'],
        severity: 'error',
        relatedSymptoms: ['high_memory'],
      };
      expect(finding.category).toBe('application');
      expect(finding.evidence).toHaveLength(1);
    });
  });

  describe('RecommendedAction', () => {
    it('should accept all valid action types', () => {
      const actionTypes: RecommendedAction['actionType'][] = [
        'investigate', 'fix', 'rollback', 'restart', 'scale', 'notify',
      ];
      actionTypes.forEach(actionType => {
        const action: RecommendedAction = {
          description: `Action: ${actionType}`,
          actionType,
          priority: 'high',
          automationLevel: 'manual',
        };
        expect(action.actionType).toBe(actionType);
      });
    });

    it('should accept all valid priority levels', () => {
      const priorities: RecommendedAction['priority'][] = ['critical', 'high', 'medium', 'low'];
      priorities.forEach(priority => {
        const action: RecommendedAction = {
          description: 'test',
          actionType: 'fix',
          priority,
          automationLevel: 'semi_auto',
        };
        expect(action.priority).toBe(priority);
      });
    });

    it('should accept optional fields', () => {
      const action: RecommendedAction = {
        description: 'Restart service',
        actionType: 'restart',
        priority: 'high',
        automationLevel: 'fully_auto',
        estimatedTimeMs: 30000,
        commands: ['kubectl rollout restart deployment/web'],
      };
      expect(action.estimatedTimeMs).toBe(30000);
      expect(action.commands).toHaveLength(1);
    });
  });

  describe('RootCause', () => {
    it('should accept valid root cause object', () => {
      const rootCause: RootCause = {
        description: 'Memory leak in service X',
        category: 'application',
        confidence: 85,
        evidence: ['heap dump analysis'],
        recommendedActions: [],
      };
      expect(rootCause.confidence).toBe(85);
      expect(rootCause.category).toBe('application');
    });

    it('should accept unknown category', () => {
      const rootCause: RootCause = {
        description: 'Unknown issue',
        category: 'unknown',
        confidence: 30,
        evidence: [],
        recommendedActions: [],
      };
      expect(rootCause.category).toBe('unknown');
    });
  });

  describe('DiagnosticSession', () => {
    it('should accept valid session with all required fields', () => {
      const session: DiagnosticSession = {
        id: 'sess-1',
        triggerType: 'incident',
        triggerId: 'inc-001',
        symptoms: [],
        findings: [],
        rootCause: null,
        confidence: 0,
        status: 'running',
        createdAt: new Date(),
      };
      expect(session.status).toBe('running');
      expect(session.triggerType).toBe('incident');
    });

    it('should accept all valid trigger types', () => {
      const triggerTypes: DiagnosticTriggerType[] = [
        'incident', 'deployment_failure', 'pipeline_failure',
        'health_check_failure', 'manual', 'scheduled',
      ];
      triggerTypes.forEach(triggerType => {
        const session: DiagnosticSession = {
          id: 's1',
          triggerType,
          triggerId: 't1',
          symptoms: [],
          findings: [],
          rootCause: null,
          confidence: 0,
          status: 'pending',
          createdAt: new Date(),
        };
        expect(session.triggerType).toBe(triggerType);
      });
    });

    it('should accept all valid session statuses', () => {
      const statuses: DiagnosticSessionStatus[] = [
        'pending', 'running', 'completed', 'failed', 'cancelled',
      ];
      statuses.forEach(status => {
        const session: DiagnosticSession = {
          id: 's1',
          triggerType: 'manual',
          triggerId: 't1',
          symptoms: [],
          findings: [],
          rootCause: null,
          confidence: 0,
          status,
          createdAt: new Date(),
        };
        expect(session.status).toBe(status);
      });
    });

    it('should accept optional fields', () => {
      const session: DiagnosticSession = {
        id: 's1',
        triggerType: 'manual',
        triggerId: 't1',
        symptoms: [],
        findings: [],
        rootCause: null,
        confidence: 75,
        status: 'completed',
        createdAt: new Date(),
        completedAt: new Date(),
        tenantId: 'tenant-1',
        metadata: { title: 'Test session' },
      };
      expect(session.tenantId).toBe('tenant-1');
      expect(session.completedAt).toBeInstanceOf(Date);
    });
  });

  describe('DiagnosticReport', () => {
    it('should accept valid report object', () => {
      const report: DiagnosticReport = {
        id: 'rep-1',
        sessionId: 'sess-1',
        summary: 'Root cause identified',
        findings: [],
        rootCause: null,
        recommendations: [],
        timeline: [],
        generatedAt: new Date(),
      };
      expect(report.summary).toBe('Root cause identified');
    });

    it('should accept optional estimatedFixTimeMs and tenantId', () => {
      const report: DiagnosticReport = {
        id: 'rep-1',
        sessionId: 'sess-1',
        summary: 'Test',
        findings: [],
        rootCause: null,
        recommendations: [],
        timeline: [],
        generatedAt: new Date(),
        estimatedFixTimeMs: 60000,
        tenantId: 't-1',
      };
      expect(report.estimatedFixTimeMs).toBe(60000);
    });
  });

  describe('TimelineEntry', () => {
    it('should accept all event types', () => {
      const eventTypes: TimelineEntry['eventType'][] = [
        'symptom_detected', 'finding_made', 'root_cause_identified', 'action_recommended',
      ];
      eventTypes.forEach(eventType => {
        const entry: TimelineEntry = {
          timestamp: new Date(),
          description: `Event: ${eventType}`,
          eventType,
        };
        expect(entry.eventType).toBe(eventType);
      });
    });
  });

  describe('DiagnosticPattern', () => {
    it('should accept valid pattern object', () => {
      const pattern: DiagnosticPattern = {
        id: 'pat-1',
        name: 'High CPU Pattern',
        symptoms: [{ type: 'high_cpu', minSeverity: 'warning' }],
        rootCause: 'CPU spike',
        solution: 'Scale up',
        frequency: 10,
        category: 'infrastructure',
        averageConfidence: 80,
        createdAt: new Date(),
      };
      expect(pattern.frequency).toBe(10);
    });
  });

  describe('SymptomPattern', () => {
    it('should accept pattern with all optional fields', () => {
      const pattern: SymptomPattern = {
        type: 'error_rate',
        sourcePattern: 'service-*',
        keywords: ['timeout', 'connection'],
        minSeverity: 'warning',
      };
      expect(pattern.sourcePattern).toBe('service-*');
    });
  });

  describe('DiagnosticOutcome', () => {
    it('should accept valid outcome object', () => {
      const outcome: DiagnosticOutcome = {
        sessionId: 'sess-1',
        patternId: 'pat-1',
        confirmed: true,
        actualRootCause: 'Memory leak',
        fixTimeMs: 300000,
        recordedAt: new Date(),
      };
      expect(outcome.confirmed).toBe(true);
    });
  });

  describe('API request types', () => {
    it('should accept TriggerDiagnosticRequest', () => {
      const req: TriggerDiagnosticRequest = {
        triggerType: 'manual',
        triggerId: 't-1',
        symptoms: [{ type: 'test', source: 'src', description: 'desc', severity: 'info' }],
        tenantId: 't-1',
      };
      expect(req.symptoms).toHaveLength(1);
    });

    it('should accept AddSymptomRequest', () => {
      const req: AddSymptomRequest = {
        type: 'test',
        source: 'src',
        description: 'desc',
        severity: 'warning',
      };
      expect(req.severity).toBe('warning');
    });

    it('should accept AddPatternRequest', () => {
      const req: AddPatternRequest = {
        name: 'Test Pattern',
        symptoms: [{ type: 'test' }],
        rootCause: 'cause',
        solution: 'fix',
        category: 'application',
      };
      expect(req.category).toBe('application');
    });

    it('should accept DiagnosticHistoryQuery with all optional fields', () => {
      const query: DiagnosticHistoryQuery = {
        triggerType: 'incident',
        triggerId: 't-1',
        tenantId: 't-1',
        status: 'completed',
        since: '2026-01-01',
        limit: '50',
      };
      expect(query.limit).toBe('50');
    });

    it('should accept KnowledgeBaseQuery with all optional fields', () => {
      const query: KnowledgeBaseQuery = {
        category: 'infrastructure',
        keyword: 'cpu',
        minFrequency: 5,
        limit: '10',
      };
      expect(query.minFrequency).toBe(5);
    });
  });

  // ==================== Barrel Export Verification ====================

  describe('barrel exports', () => {
    it('should export type definitions via namespace import', () => {
      // Verify the module has exports (types are compile-time only, but the namespace should exist)
      expect(types).toBeDefined();
      expect(typeof types).toBe('object');
    });
  });
});
