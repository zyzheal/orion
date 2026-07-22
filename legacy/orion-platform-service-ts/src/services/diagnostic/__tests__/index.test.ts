/**
 * diagnostic/index.ts - Export verification tests
 */

import { DiagnosticEngine } from '../DiagnosticEngine';
import { DiagnosticDecisionTree, createDefaultDiagnosticDecisionTree } from '../DiagnosticDecisionTree';
import { DiagnosticKnowledgeBase } from '../DiagnosticKnowledgeBase';
import { DiagnosticReporter } from '../DiagnosticReporter';
import { DiagnosticAgentService } from '../DiagnosticAgentService';

// Re-import from index to verify exports
import * as indexExports from '../index';

describe('diagnostic/index exports', () => {
  it('should export DiagnosticEngine', () => {
    expect(indexExports.DiagnosticEngine).toBe(DiagnosticEngine);
  });

  it('should export DiagnosticDecisionTree', () => {
    expect(indexExports.DiagnosticDecisionTree).toBe(DiagnosticDecisionTree);
  });

  it('should export createDefaultDiagnosticDecisionTree', () => {
    expect(indexExports.createDefaultDiagnosticDecisionTree).toBe(createDefaultDiagnosticDecisionTree);
  });

  it('should export DiagnosticKnowledgeBase', () => {
    expect(indexExports.DiagnosticKnowledgeBase).toBe(DiagnosticKnowledgeBase);
  });

  it('should export DiagnosticReporter', () => {
    expect(indexExports.DiagnosticReporter).toBe(DiagnosticReporter);
  });

  it('should export DiagnosticAgentService', () => {
    expect(indexExports.DiagnosticAgentService).toBe(DiagnosticAgentService);
  });

  it('should export all expected symbols as functions or objects', () => {
    expect(typeof indexExports.DiagnosticEngine).toBe('function');
    expect(typeof indexExports.DiagnosticDecisionTree).toBe('function');
    expect(typeof indexExports.createDefaultDiagnosticDecisionTree).toBe('function');
    expect(typeof indexExports.DiagnosticKnowledgeBase).toBe('function');
    expect(typeof indexExports.DiagnosticReporter).toBe('function');
    expect(typeof indexExports.DiagnosticAgentService).toBe('function');
  });
});
