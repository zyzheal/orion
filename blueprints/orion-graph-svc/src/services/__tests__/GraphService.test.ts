/**
 * GraphService 单元测试
 *
 * 测试图查询服务的参数验证和数据转换逻辑。
 * 由于 GraphService 依赖 Neo4j，测试聚焦于纯逻辑部分。
 */

import { describe, it, expect } from '@jest/globals';

// Validation logic extracted from GraphService
function validateCypherLabel(label: string): string | null {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(label)) {
    return `Invalid label: ${label}. Only alphanumeric characters and underscores allowed.`;
  }
  return null;
}

function validateGraphQuery(cypher: string): string[] {
  const errors: string[] = [];
  if (!cypher || cypher.trim().length === 0) {
    errors.push('Cypher query is required');
  }
  return errors;
}

function validateNodeProperties(properties: Record<string, unknown>): string[] {
  const errors: string[] = [];
  for (const [key, value] of Object.entries(properties)) {
    if (typeof value === 'function') {
      errors.push(`Property '${key}' cannot be a function`);
    }
    if (typeof value === 'undefined') {
      errors.push(`Property '${key}' cannot be undefined`);
    }
  }
  return errors;
}

function normalizeGraphResult(rawRecords: Array<Record<string, unknown>>): { nodes: unknown[]; relationships: unknown[] } {
  const nodes: unknown[] = [];
  const relationships: unknown[] = [];
  const seenNodes = new Set<string>();
  const seenRels = new Set<string>();

  for (const record of rawRecords) {
    for (const [_key, value] of Object.entries(record)) {
      if (value && typeof value === 'object' && 'labels' in value && 'properties' in value) {
        const nodeId = (value as any).identity?.toString() || JSON.stringify(value);
        if (!seenNodes.has(nodeId)) {
          seenNodes.add(nodeId);
          nodes.push({ id: nodeId, labels: (value as any).labels, properties: (value as any).properties });
        }
      }
      if (value && typeof value === 'object' && 'type' in value && 'start' in value && 'end' in value) {
        const relId = (value as any).identity?.toString() || JSON.stringify(value);
        if (!seenRels.has(relId)) {
          seenRels.add(relId);
          relationships.push({ id: relId, type: (value as any).type, startNodeId: (value as any).start, endNodeId: (value as any).end });
        }
      }
    }
  }

  return { nodes, relationships };
}

describe('GraphService - Validation', () => {
  describe('validateCypherLabel', () => {
    it('accepts valid labels', () => {
      expect(validateCypherLabel('Service')).toBeNull();
      expect(validateCypherLabel('My_Node')).toBeNull();
      expect(validateCypherLabel('_Private')).toBeNull();
      expect(validateCypherLabel('Node123')).toBeNull();
    });

    it('rejects invalid labels', () => {
      expect(validateCypherLabel('123Node')).not.toBeNull();
      expect(validateCypherLabel('My-Node')).not.toBeNull();
      expect(validateCypherLabel('My.Node')).not.toBeNull();
      expect(validateCypherLabel('')).not.toBeNull();
      expect(validateCypherLabel('Node; DROP')).not.toBeNull();
    });
  });

  describe('validateGraphQuery', () => {
    it('accepts valid query', () => {
      expect(validateGraphQuery('MATCH (n) RETURN n')).toHaveLength(0);
    });

    it('rejects empty query', () => {
      expect(validateGraphQuery('')).toHaveLength(1);
    });

    it('rejects whitespace-only query', () => {
      expect(validateGraphQuery('   ')).toHaveLength(1);
    });
  });

  describe('validateNodeProperties', () => {
    it('accepts valid properties', () => {
      const props = { name: 'test', count: 42, active: true };
      expect(validateNodeProperties(props)).toHaveLength(0);
    });

    it('rejects function values', () => {
      const props = { name: 'test', callback: () => {} };
      const errors = validateNodeProperties(props);
      expect(errors.some(e => e.includes('callback'))).toBe(true);
    });

    it('rejects undefined values', () => {
      const props = { name: 'test', value: undefined };
      const errors = validateNodeProperties(props);
      expect(errors.some(e => e.includes('value'))).toBe(true);
    });
  });

  describe('normalizeGraphResult', () => {
    it('extracts nodes from raw records', () => {
      const records = [
        { n: { identity: { toString: () => '1' }, labels: ['Service'], properties: { name: 'svc1' } } },
      ];
      const result = normalizeGraphResult(records);
      expect(result.nodes).toHaveLength(1);
      expect(result.relationships).toHaveLength(0);
    });

    it('extracts relationships from raw records', () => {
      const records = [
        {
          r: {
            identity: { toString: () => 'r1' },
            type: 'DEPENDS_ON',
            start: { toString: () => '1' },
            end: { toString: () => '2' },
            properties: {},
          },
        },
      ];
      const result = normalizeGraphResult(records);
      expect(result.nodes).toHaveLength(0);
      expect(result.relationships).toHaveLength(1);
    });

    it('deduplicates nodes', () => {
      const records = [
        { n: { identity: { toString: () => '1' }, labels: ['Service'], properties: { name: 'svc1' } } },
        { n: { identity: { toString: () => '1' }, labels: ['Service'], properties: { name: 'svc1' } } },
      ];
      const result = normalizeGraphResult(records);
      expect(result.nodes).toHaveLength(1);
    });
  });
});
