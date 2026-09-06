/**
 * constants.ts - DataLineage 常量 + 工具函数
 * 抽取自 DataLineagePage.tsx (P2-9 Phase 61)
 */
import React from 'react';
import { DatabaseOutlined, ApiOutlined, CloudServerOutlined } from '@ant-design/icons';
import type { LineageNode as ApiLineageNode } from '@/api/data-lineage';
import type { ColumnDef } from './types';

export const nodeTypeConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  source: { color: 'blue', icon: <DatabaseOutlined />, label: '数据源' },
  transform: { color: 'purple', icon: <ApiOutlined />, label: '转换' },
  sink: { color: 'green', icon: <CloudServerOutlined />, label: '数据汇' },
  dataset: { color: 'orange', icon: <DatabaseOutlined />, label: '数据集' },
  model: { color: 'cyan', icon: <ApiOutlined />, label: '模型' },
};

/** Derive column schema from node metadata/schema or generate defaults */
export const deriveColumns = (node: ApiLineageNode): ColumnDef[] => {
  const schema = node.schema;
  if (schema && Object.keys(schema).length > 0) {
    return Object.entries(schema).map(([name, type]) => ({
      name,
      type,
      transformed: node.type === 'transform',
      upstreamSource: undefined,
      upstreamColumn: undefined,
    }));
  }

  // Default columns based on node type
  const defaults: Record<string, string[]> = {
    source: ['id', 'name', 'created_at', 'updated_at'],
    transform: ['id', 'input_ref', 'transformed_value', 'ts'],
    sink: ['id', 'destination', 'record_count', 'written_at'],
    dataset: ['id', 'partition_key', 'value', 'version'],
    model: ['id', 'feature_name', 'score', 'metadata'],
  };
  return (defaults[node.type] || defaults.source).map((name) => ({
    name,
    type: 'string',
    transformed: node.type === 'transform',
    upstreamSource: undefined,
    upstreamColumn: undefined,
  }));
};
