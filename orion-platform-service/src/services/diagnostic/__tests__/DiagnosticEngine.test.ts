/**
 * DiagnosticEngine 单元测试
 */

import { DiagnosticEngine } from '../DiagnosticEngine';
import { Symptom, DiagnosticCategory } from '../../types';

describe('DiagnosticEngine', () => {
  let engine: DiagnosticEngine;

  beforeEach(() => {
    engine = new DiagnosticEngine();
  });

  afterEach(() => {
    engine.clearSessions();
  });

  // ==================== startDiagnostic ====================

  describe('startDiagnostic', () => {
    it('should create a new diagnostic session', () => {
      const symptoms: Symptom[] = [
        {
          type: 'deployment_failure',
          source: 'kubernetes-deploy',
          description: 'Container failed to start',
          severity: 'error',
          timestamp: new Date(),
        },
      ];

      const session = engine.startDiagnostic({
        triggerType: 'deployment_failure',
        triggerId: 'deploy-001',
        initialSymptoms: symptoms,
      });

      expect(session.id).toBeDefined();
      expect(session.triggerType).toBe('deployment_failure');
      expect(session.triggerId).toBe('deploy-001');
      expect(session.symptoms.length).toBe(1);
      expect(session.status).toBe('running');
      expect(session.findings).toEqual([]);
      expect(session.rootCause).toBeNull();
      expect(session.confidence).toBe(0);
      expect(session.createdAt).toBeInstanceOf(Date);
    });

    it('should include tenant ID', () => {
      const session = engine.startDiagnostic({
        triggerType: 'manual',
        triggerId: 'manual-001',
        initialSymptoms: [],
        tenantId: 'tenant-001',
      });

      expect(session.tenantId).toBe('tenant-001');
    });

    it('should set timestamps on symptoms', () => {
      const symptoms: Symptom[] = [
        {
          type: 'error',
          source: 'test',
          description: 'Test error',
          severity: 'error',
          timestamp: new Date(),
        },
      ];

      const session = engine.startDiagnostic({
        triggerType: 'manual',
        triggerId: 'manual-001',
        initialSymptoms: symptoms,
      });

      expect(session.symptoms[0].timestamp).toBeInstanceOf(Date);
    });
  });

  // ==================== addSymptom ====================

  describe('addSymptom', () => {
    let sessionId: string;

    beforeEach(() => {
      const session = engine.startDiagnostic({
        triggerType: 'deployment_failure',
        triggerId: 'deploy-001',
        initialSymptoms: [
          {
            type: 'deployment_failure',
            source: 'kubernetes-deploy',
            description: 'Initial error',
            severity: 'error',
            timestamp: new Date(),
          },
        ],
      });
      sessionId = session.id;
    });

    it('should add a symptom to existing session', () => {
      const session = engine.addSymptom(sessionId, {
        type: 'network_issue',
        source: 'network-01',
        description: 'Network timeout',
        severity: 'warning',
        timestamp: new Date(),
      });

      expect(session.symptoms.length).toBe(2);
      expect(session.symptoms[1].type).toBe('network_issue');
    });

    it('should throw error for non-existent session', () => {
      expect(() => {
        engine.addSymptom('non-existent', {
          type: 'error',
          source: 'test',
          description: 'Test',
          severity: 'error',
          timestamp: new Date(),
        });
      }).toThrow('Diagnostic session non-existent not found');
    });
  });

  // ==================== correlateSymptoms ====================

  describe('correlateSymptoms', () => {
    let sessionId: string;

    beforeEach(() => {
      const session = engine.startDiagnostic({
        triggerType: 'incident',
        triggerId: 'incident-001',
        initialSymptoms: [
          {
            type: 'database_error',
            source: 'app-db-01',
            description: 'Connection timeout',
            severity: 'error',
            timestamp: new Date(),
          },
          {
            type: 'database_error',
            source: 'app-db-01',
            description: 'Query failure',
            severity: 'error',
            timestamp: new Date(),
          },
          {
            type: 'network_issue',
            source: 'network-01',
            description: 'High latency',
            severity: 'warning',
            timestamp: new Date(),
          },
        ],
      });
      sessionId = session.id;
    });

    it('should generate findings from symptoms', () => {
      const { findings } = engine.correlateSymptoms(sessionId);

      expect(findings.length).toBeGreaterThan(0);
    });

    it('should cluster symptoms by source', () => {
      const { clusters } = engine.correlateSymptoms(sessionId);

      expect(clusters.length).toBeGreaterThan(0);
    });

    it('should update session findings', () => {
      const { findings } = engine.correlateSymptoms(sessionId);
      const session = engine.getSession(sessionId);

      expect(session!.findings.length).toBe(findings.length);
    });

    it('should throw error for non-existent session', () => {
      expect(() => {
        engine.correlateSymptoms('non-existent');
      }).toThrow('Diagnostic session non-existent not found');
    });
  });

  // ==================== identifyRootCause ====================

  describe('identifyRootCause', () => {
    let sessionId: string;

    beforeEach(() => {
      const session = engine.startDiagnostic({
        triggerType: 'deployment_failure',
        triggerId: 'deploy-001',
        initialSymptoms: [
          {
            type: 'deployment_failure',
            source: 'kubernetes-deploy',
            description: 'Container in CrashLoopBackOff state',
            severity: 'error',
            timestamp: new Date(),
          },
        ],
      });
      sessionId = session.id;
    });

    it('should identify root cause from symptoms', () => {
      const session = engine.identifyRootCause(sessionId);

      expect(session.rootCause).not.toBeNull();
      expect(session.rootCause!.description).toBeDefined();
      expect(session.rootCause!.category).toBeDefined();
      expect(session.rootCause!.confidence).toBeGreaterThanOrEqual(0);
      expect(session.rootCause!.confidence).toBeLessThanOrEqual(100);
      expect(session.rootCause!.evidence.length).toBeGreaterThan(0);
      expect(session.rootCause!.recommendedActions.length).toBeGreaterThanOrEqual(0);
    });

    it('should update confidence score', () => {
      const session = engine.identifyRootCause(sessionId);
      expect(session.confidence).toBe(session.rootCause!.confidence);
    });

    it('should handle session with no symptoms', () => {
      const emptySession = engine.startDiagnostic({
        triggerType: 'manual',
        triggerId: 'manual-001',
        initialSymptoms: [],
      });

      const session = engine.identifyRootCause(emptySession.id);

      expect(session.status).toBe('failed');
      expect(session.rootCause).not.toBeNull();
      expect(session.confidence).toBe(0);
    });

    it('should throw error for non-existent session', () => {
      expect(() => {
        engine.identifyRootCause('non-existent');
      }).toThrow('Diagnostic session non-existent not found');
    });
  });

  // ==================== completeDiagnostic ====================

  describe('completeDiagnostic', () => {
    let sessionId: string;

    beforeEach(() => {
      const session = engine.startDiagnostic({
        triggerType: 'deployment_failure',
        triggerId: 'deploy-001',
        initialSymptoms: [
          {
            type: 'deployment_failure',
            source: 'kubernetes-deploy',
            description: 'CrashLoopBackOff',
            severity: 'error',
            timestamp: new Date(),
          },
        ],
      });
      sessionId = session.id;
    });

    it('should complete the session', () => {
      const session = engine.completeDiagnostic(sessionId);

      expect(session.status).toBe('completed');
      expect(session.completedAt).toBeInstanceOf(Date);
    });

    it('should auto-run root cause identification if not done', () => {
      const session = engine.completeDiagnostic(sessionId);

      expect(session.rootCause).not.toBeNull();
    });

    it('should throw error for non-existent session', () => {
      expect(() => {
        engine.completeDiagnostic('non-existent');
      }).toThrow('Diagnostic session non-existent not found');
    });
  });

  // ==================== getDiagnosticHistory ====================

  describe('getDiagnosticHistory', () => {
    beforeEach(() => {
      engine.startDiagnostic({
        triggerType: 'deployment_failure',
        triggerId: 'deploy-1',
        initialSymptoms: [{ type: 'error', source: 'test', description: 'err', severity: 'error', timestamp: new Date() }],
        tenantId: 'tenant-a',
      });

      engine.startDiagnostic({
        triggerType: 'pipeline_failure',
        triggerId: 'pipeline-1',
        initialSymptoms: [{ type: 'error', source: 'test', description: 'err', severity: 'error', timestamp: new Date() }],
        tenantId: 'tenant-b',
      });

      engine.startDiagnostic({
        triggerType: 'deployment_failure',
        triggerId: 'deploy-2',
        initialSymptoms: [{ type: 'error', source: 'test', description: 'err', severity: 'error', timestamp: new Date() }],
        tenantId: 'tenant-a',
      });
    });

    it('should return all sessions by default', () => {
      const history = engine.getDiagnosticHistory();
      expect(history.length).toBe(3);
    });

    it('should filter by triggerType', () => {
      const history = engine.getDiagnosticHistory({ triggerType: 'deployment_failure' });
      expect(history.length).toBe(2);
      history.forEach((s) => expect(s.triggerType).toBe('deployment_failure'));
    });

    it('should filter by tenantId', () => {
      const history = engine.getDiagnosticHistory({ tenantId: 'tenant-a' });
      expect(history.length).toBe(2);
    });

    it('should filter by triggerId', () => {
      const history = engine.getDiagnosticHistory({ triggerId: 'deploy-1' });
      expect(history.length).toBe(1);
      expect(history[0].triggerId).toBe('deploy-1');
    });

    it('should limit results', () => {
      const history = engine.getDiagnosticHistory({ limit: 2 });
      expect(history.length).toBe(2);
    });

    it('should filter by status', () => {
      const history = engine.getDiagnosticHistory({ status: 'running' });
      expect(history.length).toBe(3); // All are running by default
    });
  });

  // ==================== getSession ====================

  describe('getSession', () => {
    it('should return session by ID', () => {
      const session = engine.startDiagnostic({
        triggerType: 'manual',
        triggerId: 'manual-001',
        initialSymptoms: [],
      });

      const found = engine.getSession(session.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(session.id);
    });

    it('should return undefined for non-existent ID', () => {
      const found = engine.getSession('non-existent');
      expect(found).toBeUndefined();
    });
  });

  // ==================== getDecisionTree ====================

  describe('getDecisionTree', () => {
    it('should return the decision tree instance', () => {
      const tree = engine.getDecisionTree();
      expect(tree).toBeDefined();
      expect(tree.getNodeCount()).toBeGreaterThan(0);
    });
  });

  // ==================== getKnowledgeBase ====================

  describe('getKnowledgeBase', () => {
    it('should return the knowledge base instance', () => {
      const kb = engine.getKnowledgeBase();
      expect(kb).toBeDefined();
      expect(kb.getAllPatterns().length).toBe(0);
    });
  });
});
