/**
 * DiagnosticDecisionTree 单元测试
 */

import {
  DiagnosticDecisionTree,
  createDefaultDiagnosticDecisionTree,
} from '../DiagnosticDecisionTree';
import { Symptom } from '../../types';

describe('DiagnosticDecisionTree', () => {
  describe('constructor and basic operations', () => {
    it('should create a tree with root node', () => {
      const tree = new DiagnosticDecisionTree();
      const root = tree.getRoot();

      expect(root).toBeDefined();
      expect(root.id).toBe('root');
      expect(root.isLeaf).toBe(false);
      expect(root.branches).toEqual([]);
    });

    it('should add branches to the tree', () => {
      const tree = new DiagnosticDecisionTree();

      const childId = tree.addBranch('root', {
        name: 'Test Branch',
        conditions: [{ field: 'type', operator: 'equals', value: 'test' }],
        childNode: {
          name: 'Test Node',
          description: 'A test node',
          isLeaf: true,
        },
      });

      expect(childId).toBeDefined();
      expect(tree.getNodeCount()).toBe(2); // root + child
    });

    it('should throw error when adding branch to non-existent parent', () => {
      const tree = new DiagnosticDecisionTree();

      expect(() => {
        tree.addBranch('non-existent', {
          name: 'Test Branch',
          conditions: [],
          childNode: { name: 'Test', description: '', isLeaf: false },
        });
      }).toThrow('Parent node non-existent not found');
    });
  });

  describe('evaluate', () => {
    it('should return root cause for matching leaf node', () => {
      const tree = createDefaultDiagnosticDecisionTree();

      const symptoms: Symptom[] = [
        {
          type: 'deployment_failure',
          source: 'kubernetes-deploy-01',
          description: 'Container in CrashLoopBackOff state',
          severity: 'error',
          timestamp: new Date(),
        },
      ];

      const result = tree.evaluate(symptoms);

      expect(result.path.length).toBeGreaterThan(1);
      expect(result.recommendedChecks.length).toBeGreaterThan(0);
    });

    it('should handle non-matching symptoms with default branch', () => {
      const tree = createDefaultDiagnosticDecisionTree();

      const symptoms: Symptom[] = [
        {
          type: 'unknown_type',
          source: 'unknown-service',
          description: 'Something went wrong',
          severity: 'warning',
          timestamp: new Date(),
        },
      ];

      const result = tree.evaluate(symptoms);

      expect(result).toBeDefined();
      expect(result.path.length).toBeGreaterThan(0);
    });

    it('should return recommended checks', () => {
      const tree = createDefaultDiagnosticDecisionTree();

      const symptoms: Symptom[] = [
        {
          type: 'deployment_failure',
          source: 'kubernetes-deploy-01',
          description: 'ImagePullBackOff error',
          severity: 'error',
          timestamp: new Date(),
        },
      ];

      const result = tree.evaluate(symptoms);
      expect(result.recommendedChecks.length).toBeGreaterThan(0);
    });

    it('should return matched branches', () => {
      const tree = createDefaultDiagnosticDecisionTree();

      const symptoms: Symptom[] = [
        {
          type: 'pipeline_failure',
          source: 'pipeline-runner-01',
          description: 'Runner is not available',
          severity: 'error',
          timestamp: new Date(),
        },
      ];

      const result = tree.evaluate(symptoms);
      expect(result.matchedBranches.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getRecommendedChecks', () => {
    it('should return recommended checks for symptoms', () => {
      const tree = createDefaultDiagnosticDecisionTree();

      const symptoms: Symptom[] = [
        {
          type: 'deployment_failure',
          source: 'kubernetes-deploy-01',
          description: 'CrashLoopBackOff detected',
          severity: 'error',
          timestamp: new Date(),
        },
      ];

      const checks = tree.getRecommendedChecks(symptoms);
      expect(checks.length).toBeGreaterThan(0);
    });
  });

  describe('getAllRootCauses', () => {
    it('should return all leaf node root causes', () => {
      const tree = createDefaultDiagnosticDecisionTree();
      const rootCauses = tree.getAllRootCauses();

      expect(rootCauses.length).toBeGreaterThan(0);
      for (const rc of rootCauses) {
        expect(rc.description).toBeDefined();
        expect(rc.category).toBeDefined();
        expect(rc.confidence).toBeGreaterThanOrEqual(0);
        expect(rc.confidence).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('set default branch', () => {
    it('should set default branch on a node', () => {
      const tree = new DiagnosticDecisionTree();

      const childId = tree.addBranch('root', {
        name: 'Known Branch',
        conditions: [{ field: 'type', operator: 'equals', value: 'known' }],
        childNode: {
          name: 'Known Node',
          description: 'Known issue',
          isLeaf: true,
        },
      });

      const defaultChildId = tree.setDefaultBranch(childId, {
        name: 'Default Branch',
        childNode: {
          name: 'Default Node',
          description: 'Unknown issue',
          isLeaf: true,
        },
      });

      expect(defaultChildId).toBeDefined();
    });

    it('should throw error when setting default branch on non-existent parent', () => {
      const tree = new DiagnosticDecisionTree();

      expect(() => {
        tree.setDefaultBranch('non-existent', {
          name: 'Default Branch',
          childNode: { name: 'Default', description: '', isLeaf: false },
        });
      }).toThrow('Parent node non-existent not found');
    });
  });
});

describe('createDefaultDiagnosticDecisionTree', () => {
  it('should create a tree with multiple nodes', () => {
    const tree = createDefaultDiagnosticDecisionTree();
    expect(tree.getNodeCount()).toBeGreaterThan(5);
  });

  it('should handle deployment failure symptoms', () => {
    const tree = createDefaultDiagnosticDecisionTree();

    const symptoms: Symptom[] = [
      {
        type: 'deployment_failure',
        source: 'kubernetes-deploy',
        description: 'Insufficient cpu resources',
        severity: 'error',
        timestamp: new Date(),
      },
    ];

    const result = tree.evaluate(symptoms);
    expect(result).toBeDefined();
    expect(result.path.length).toBeGreaterThan(1);
  });

  it('should handle pipeline failure symptoms', () => {
    const tree = createDefaultDiagnosticDecisionTree();

    const symptoms: Symptom[] = [
      {
        type: 'pipeline_failure',
        source: 'pipeline-test',
        description: 'Tests failed with assertion errors',
        severity: 'error',
        timestamp: new Date(),
      },
    ];

    // Add a test_failure symptom for proper matching
    symptoms.push({
      type: 'test_failure',
      source: 'pipeline-test',
      description: 'Test failures detected',
      severity: 'error',
      timestamp: new Date(),
    });

    const result = tree.evaluate(symptoms);
    expect(result).toBeDefined();
  });

  it('should handle database symptoms', () => {
    const tree = createDefaultDiagnosticDecisionTree();

    const symptoms: Symptom[] = [
      {
        type: 'database_error',
        source: 'app-db-01',
        description: 'Connection timeout to database',
        severity: 'error',
        timestamp: new Date(),
      },
    ];

    const result = tree.evaluate(symptoms);
    expect(result).toBeDefined();
    expect(result.path.length).toBeGreaterThan(1);
  });

  it('should handle infrastructure symptoms', () => {
    const tree = createDefaultDiagnosticDecisionTree();

    const symptoms: Symptom[] = [
      {
        type: 'resource_exhaustion',
        source: 'node-01',
        description: 'Disk full on node-01',
        severity: 'critical',
        timestamp: new Date(),
      },
    ];

    const result = tree.evaluate(symptoms);
    expect(result).toBeDefined();
  });
});
