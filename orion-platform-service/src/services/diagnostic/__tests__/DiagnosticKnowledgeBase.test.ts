/**
 * DiagnosticKnowledgeBase 单元测试
 */

import { DiagnosticKnowledgeBase } from '../DiagnosticKnowledgeBase';
import { Symptom, DiagnosticCategory, SymptomPattern } from '../../types';

describe('DiagnosticKnowledgeBase', () => {
  let kb: DiagnosticKnowledgeBase;

  beforeEach(() => {
    kb = new DiagnosticKnowledgeBase();
  });

  afterEach(() => {
    kb.clear();
  });

  // ==================== addPattern ====================

  describe('addPattern', () => {
    it('should add a new pattern', () => {
      const pattern = kb.addPattern({
        name: 'Test Pattern',
        symptoms: [
          {
            type: 'test_failure',
            keywords: ['test', 'fail'],
          },
        ],
        rootCause: 'Test root cause',
        solution: 'Test solution',
        category: 'pipeline',
      });

      expect(pattern.id).toBeDefined();
      expect(pattern.name).toBe('Test Pattern');
      expect(pattern.frequency).toBe(0);
      expect(pattern.createdAt).toBeInstanceOf(Date);
    });

    it('should add multiple patterns', () => {
      kb.addPattern({
        name: 'Pattern 1',
        symptoms: [{ type: 'error' }],
        rootCause: 'Cause 1',
        solution: 'Solution 1',
        category: 'application',
      });

      kb.addPattern({
        name: 'Pattern 2',
        symptoms: [{ type: 'warning' }],
        rootCause: 'Cause 2',
        solution: 'Solution 2',
        category: 'infrastructure',
      });

      const patterns = kb.getAllPatterns();
      expect(patterns.length).toBe(2);
    });
  });

  // ==================== getPattern ====================

  describe('getPattern', () => {
    it('should return pattern by ID', () => {
      const pattern = kb.addPattern({
        name: 'Test Pattern',
        symptoms: [{ type: 'error' }],
        rootCause: 'Test cause',
        solution: 'Test solution',
        category: 'application',
      });

      const found = kb.getPattern(pattern.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(pattern.id);
    });

    it('should return undefined for non-existent ID', () => {
      const found = kb.getPattern('non-existent');
      expect(found).toBeUndefined();
    });
  });

  // ==================== searchPatterns ====================

  describe('searchPatterns', () => {
    beforeEach(() => {
      kb.addPattern({
        name: 'Database Connection Issue',
        symptoms: [{ type: 'database_error' }],
        rootCause: 'Connection pool exhausted',
        solution: 'Increase pool size',
        category: 'database',
      });

      kb.addPattern({
        name: 'Deployment Failure',
        symptoms: [{ type: 'deployment_failure' }],
        rootCause: 'Image not found',
        solution: 'Check image reference',
        category: 'deployment',
      });

      kb.addPattern({
        name: 'Network Timeout',
        symptoms: [{ type: 'network_issue' }],
        rootCause: 'Network latency',
        solution: 'Check network config',
        category: 'network',
      });
    });

    it('should return all patterns by default', () => {
      const results = kb.searchPatterns({});
      expect(results.length).toBe(3);
    });

    it('should filter by category', () => {
      const results = kb.searchPatterns({ category: 'database' });
      expect(results.length).toBe(1);
      expect(results[0].category).toBe('database');
    });

    it('should filter by keyword', () => {
      const results = kb.searchPatterns({ keyword: 'connection' });
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter by minFrequency', () => {
      const results = kb.searchPatterns({ minFrequency: 1 });
      expect(results.length).toBe(0); // All have frequency 0
    });

    it('should limit results', () => {
      const results = kb.searchPatterns({ limit: 2 });
      expect(results.length).toBe(2);
    });

    it('should sort by frequency descending', () => {
      // Update frequency on one pattern
      const patterns = kb.getAllPatterns();
      kb.updatePattern(patterns[1].id, { frequency: 5 });
      kb.updatePattern(patterns[2].id, { frequency: 3 });

      const results = kb.searchPatterns({});
      expect(results[0].frequency).toBeGreaterThanOrEqual(results[1].frequency);
    });
  });

  // ==================== matchSymptoms ====================

  describe('matchSymptoms', () => {
    beforeEach(() => {
      kb.addPattern({
        name: 'Database Connection Pattern',
        symptoms: [
          {
            type: 'database_error',
            sourcePattern: 'app-db-*',
            keywords: ['connection', 'timeout'],
            minSeverity: 'error',
          },
        ],
        rootCause: 'DB connection failure',
        solution: 'Fix DB connection',
        category: 'database',
      });

      kb.addPattern({
        name: 'Deployment Failure Pattern',
        symptoms: [
          {
            type: 'deployment_failure',
            sourcePattern: 'kubernetes-*',
            keywords: ['crash', 'restart'],
            minSeverity: 'warning',
          },
        ],
        rootCause: 'Deployment failure',
        solution: 'Fix deployment',
        category: 'deployment',
      });
    });

    it('should match symptoms to patterns', () => {
      const symptoms: Symptom[] = [
        {
          type: 'database_error',
          source: 'app-db-01',
          description: 'Connection timeout to database',
          severity: 'error',
          timestamp: new Date(),
        },
      ];

      const results = kb.matchSymptoms(symptoms);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].pattern.category).toBe('database');
      expect(results[0].matchScore).toBeGreaterThan(0);
    });

    it('should return sorted results by match score', () => {
      const symptoms: Symptom[] = [
        {
          type: 'database_error',
          source: 'app-db-01',
          description: 'Connection timeout to database server',
          severity: 'error',
          timestamp: new Date(),
        },
        {
          type: 'deployment_failure',
          source: 'kubernetes-deploy',
          description: 'Container crash detected',
          severity: 'error',
          timestamp: new Date(),
        },
      ];

      const results = kb.matchSymptoms(symptoms);
      expect(results.length).toBe(2);
      expect(results[0].matchScore).toBeGreaterThanOrEqual(results[1].matchScore);
    });

    it('should return empty for non-matching symptoms', () => {
      const symptoms: Symptom[] = [
        {
          type: 'unknown_type',
          source: 'unknown',
          description: 'Unknown issue',
          severity: 'info',
          timestamp: new Date(),
        },
      ];

      const results = kb.matchSymptoms(symptoms);
      expect(results.length).toBe(0);
    });
  });

  // ==================== recordOutcome ====================

  describe('recordOutcome', () => {
    let patternId: string;

    beforeEach(() => {
      const pattern = kb.addPattern({
        name: 'Test Pattern',
        symptoms: [{ type: 'error' }],
        rootCause: 'Test cause',
        solution: 'Test solution',
        category: 'application',
      });
      patternId = pattern.id;
    });

    it('should record a confirmed outcome', () => {
      const outcome = kb.recordOutcome({
        sessionId: 'session-1',
        patternId,
        confirmed: true,
        fixTimeMs: 300000,
      });

      expect(outcome.sessionId).toBe('session-1');
      expect(outcome.patternId).toBe(patternId);
      expect(outcome.confirmed).toBe(true);
      expect(outcome.recordedAt).toBeInstanceOf(Date);
    });

    it('should update pattern frequency on outcome', () => {
      kb.recordOutcome({
        sessionId: 'session-1',
        patternId,
        confirmed: true,
      });

      const pattern = kb.getPattern(patternId);
      expect(pattern!.frequency).toBe(1);
      expect(pattern!.lastMatched).toBeDefined();
    });

    it('should update average confidence based on outcomes', () => {
      kb.recordOutcome({ sessionId: 's1', patternId, confirmed: true });
      kb.recordOutcome({ sessionId: 's2', patternId, confirmed: true });
      kb.recordOutcome({ sessionId: 's3', patternId, confirmed: false });

      const pattern = kb.getPattern(patternId);
      expect(pattern!.frequency).toBe(3);
      expect(pattern!.averageConfidence).toBe(67); // 2/3 = 67%
    });
  });

  // ==================== learnFromSession ====================

  describe('learnFromSession', () => {
    it('should create a new pattern from session data', () => {
      const symptoms: Symptom[] = [
        {
          type: 'database_error',
          source: 'app-db-01',
          description: 'Connection timeout error',
          severity: 'error',
          timestamp: new Date(),
        },
      ];

      const pattern = kb.learnFromSession({
        name: 'Learned DB Issue',
        symptoms,
        rootCause: {
          description: 'DB connection timeout',
          category: 'database',
          confidence: 80,
          evidence: ['timeout error'],
          recommendedActions: [],
        },
        solution: 'Increase connection timeout',
        category: 'database',
      });

      expect(pattern.id).toBeDefined();
      expect(pattern.name).toBe('Learned DB Issue');
      expect(pattern.symptoms.length).toBe(1);
      expect(pattern.symptoms[0].type).toBe('database_error');
    });
  });

  // ==================== getStats ====================

  describe('getStats', () => {
    it('should return correct statistics', () => {
      const p1 = kb.addPattern({
        name: 'Pattern 1',
        symptoms: [{ type: 'error' }],
        rootCause: 'Cause 1',
        solution: 'Solution 1',
        category: 'database',
      });

      const p2 = kb.addPattern({
        name: 'Pattern 2',
        symptoms: [{ type: 'warning' }],
        rootCause: 'Cause 2',
        solution: 'Solution 2',
        category: 'database',
      });

      kb.recordOutcome({ sessionId: 's1', patternId: p1.id, confirmed: true });
      kb.recordOutcome({ sessionId: 's2', patternId: p2.id, confirmed: false });

      const stats = kb.getStats();

      expect(stats.totalPatterns).toBe(2);
      expect(stats.totalOutcomes).toBe(2);
      expect(stats.patternsByCategory['database']).toBe(2);
      expect(stats.topPatterns.length).toBe(2);
      expect(stats.averageConfirmationRate).toBe(50);
    });

    it('should return zero stats for empty KB', () => {
      const stats = kb.getStats();

      expect(stats.totalPatterns).toBe(0);
      expect(stats.totalOutcomes).toBe(0);
      expect(stats.averageConfirmationRate).toBe(0);
    });
  });

  // ==================== updatePattern ====================

  describe('updatePattern', () => {
    it('should update pattern fields', () => {
      const pattern = kb.addPattern({
        name: 'Original Name',
        symptoms: [{ type: 'error' }],
        rootCause: 'Original cause',
        solution: 'Original solution',
        category: 'application',
      });

      const updated = kb.updatePattern(pattern.id, {
        name: 'Updated Name',
        frequency: 10,
      });

      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('Updated Name');
      expect(updated!.frequency).toBe(10);
    });

    it('should return null for non-existent pattern', () => {
      const updated = kb.updatePattern('non-existent', { name: 'New Name' });
      expect(updated).toBeNull();
    });
  });

  // ==================== deletePattern ====================

  describe('deletePattern', () => {
    it('should delete a pattern', () => {
      const pattern = kb.addPattern({
        name: 'To Delete',
        symptoms: [{ type: 'error' }],
        rootCause: 'Cause',
        solution: 'Solution',
        category: 'application',
      });

      const deleted = kb.deletePattern(pattern.id);
      expect(deleted).toBe(true);
      expect(kb.getPattern(pattern.id)).toBeUndefined();
    });

    it('should return false for non-existent pattern', () => {
      const deleted = kb.deletePattern('non-existent');
      expect(deleted).toBe(false);
    });
  });

  // ==================== getOutcome ====================

  describe('getOutcome', () => {
    it('should return outcome by session ID', () => {
      const pattern = kb.addPattern({
        name: 'Test',
        symptoms: [{ type: 'error' }],
        rootCause: 'Cause',
        solution: 'Solution',
        category: 'application',
      });

      kb.recordOutcome({
        sessionId: 'session-1',
        patternId: pattern.id,
        confirmed: true,
      });

      const outcome = kb.getOutcome('session-1');
      expect(outcome).toBeDefined();
      expect(outcome!.sessionId).toBe('session-1');
    });

    it('should return undefined for non-existent session', () => {
      const outcome = kb.getOutcome('non-existent');
      expect(outcome).toBeUndefined();
    });
  });
});
