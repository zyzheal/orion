/**
 * DataLineageService - Enhanced data lineage tracking
 *
 * Tracks data flow from source through transformations to destination,
 * provides lineage visualization, and impact analysis.
 */

import { v4 as uuidv4 } from 'uuid';

export interface LineageNode {
  id: string;
  name: string;
  type: 'source' | 'transform' | 'sink' | 'dataset' | 'model';
  description?: string;
  pipelineId?: string;
  stageId?: string;
  schema?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface LineageEdge {
  id: string;
  from: string;
  to: string;
  relationship: 'produces' | 'consumes' | 'transforms' | 'derives';
  fieldMapping?: Record<string, string>;
}

export interface DataLineageGraph {
  tenantId: string;
  pipelineId?: string;
  nodes: LineageNode[];
  edges: LineageEdge[];
  generatedAt: Date;
}

export interface LineageRecord {
  id: string;
  tenantId: string;
  pipelineId: string;
  executionId: string;
  graph: DataLineageGraph;
  recordedAt: Date;
}

// ============================================================
// Service
// ============================================================

export class DataLineageService {
  private lineageRecords: LineageRecord[] = [];
  private nodes = new Map<string, LineageNode>();
  private edges = new Map<string, LineageEdge>();

  constructor() {
  }

  async recordLineage(
    tenantId: string,
    pipelineId: string,
    executionId: string,
    nodes: LineageNode[],
    edges: LineageEdge[]
  ): Promise<LineageRecord> {
    for (const node of nodes) this.nodes.set(node.id, node);
    for (const edge of edges) this.edges.set(edge.id, edge);

    const graph: DataLineageGraph = {
      tenantId, pipelineId, nodes, edges,
      generatedAt: new Date(),
    };

    const record: LineageRecord = {
      id: uuidv4(), tenantId, pipelineId, executionId, graph,
      recordedAt: new Date(),
    };
    this.lineageRecords.push(record);
    return record;
  }

  getLineage(pipelineId: string): DataLineageGraph | null {
    const latest = [...this.lineageRecords]
      .filter(r => r.pipelineId === pipelineId)
      .sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime())[0];
    return latest?.graph || null;
  }

  getLineageHistory(pipelineId: string, limit: number = 20): LineageRecord[] {
    return this.lineageRecords
      .filter(r => r.pipelineId === pipelineId)
      .sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime())
      .slice(0, limit);
  }

  async addNode(node: LineageNode): Promise<void> {
    this.nodes.set(node.id, node);
  }

  async addEdge(edge: LineageEdge): Promise<void> {
    this.edges.set(edge.id, edge);
  }

  getUpstream(nodeId: string): LineageNode[] {
    const upstreamIds = new Set<string>();
    for (const edge of this.edges.values()) {
      if (edge.to === nodeId) upstreamIds.add(edge.from);
    }
    return Array.from(upstreamIds).map(id => this.nodes.get(id)).filter(Boolean) as LineageNode[];
  }

  getDownstream(nodeId: string): LineageNode[] {
    const downstreamIds = new Set<string>();
    for (const edge of this.edges.values()) {
      if (edge.from === nodeId) downstreamIds.add(edge.to);
    }
    return Array.from(downstreamIds).map(id => this.nodes.get(id)).filter(Boolean) as LineageNode[];
  }

  async getImpactAnalysis(nodeId: string): Promise<{
    node: LineageNode | undefined;
    upstreamCount: number;
    downstreamCount: number;
    affectedPipelines: string[];
  }> {
    const node = this.nodes.get(nodeId);
    const upstream = this.getUpstream(nodeId);
    const downstream = this.getDownstream(nodeId);

    const affectedPipelines = new Set<string>();
    if (node?.pipelineId) affectedPipelines.add(node.pipelineId);
    for (const n of [...upstream, ...downstream]) {
      if (n.pipelineId) affectedPipelines.add(n.pipelineId);
    }

    return {
      node,
      upstreamCount: upstream.length,
      downstreamCount: downstream.length,
      affectedPipelines: Array.from(affectedPipelines),
    };
  }

  getAllLineage(tenantId: string): DataLineageGraph {
    const nodes = Array.from(this.nodes.values()).filter(n => true);
    const edges = Array.from(this.edges.values());
    return { tenantId, nodes, edges, generatedAt: new Date() };
  }
}
