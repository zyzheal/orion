/**
 * DataLineageService - PostgreSQL-backed data lineage tracking
 *
 * Tracks data flow from source through transformations to destination,
 * provides lineage visualization, and impact analysis.
 * Migrated from in-memory Map storage to PostgreSQL Repository pattern.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  LineageNodeRepository,
  LineageEdgeRepository,
  LineageRecordRepository,
  LineageNodeEntity,
  LineageEdgeEntity,
} from './DataLineageRepository';
import { getCurrentTenantId } from '../../db/tenant-context-storage';

// ==================== Types ====================

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

// ==================== Service ====================

export class DataLineageService {
  private nodeRepo: LineageNodeRepository;
  private edgeRepo: LineageEdgeRepository;
  private recordRepo: LineageRecordRepository;

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.nodeRepo = new LineageNodeRepository(db);
    this.edgeRepo = new LineageEdgeRepository(db);
    this.recordRepo = new LineageRecordRepository(db);
  }

  /**
   * Record a lineage snapshot (nodes + edges) for a pipeline execution
   */
  async recordLineage(
    tenantId: string,
    pipelineId: string,
    executionId: string,
    nodes: LineageNode[],
    edges: LineageEdge[],
  ): Promise<LineageRecord> {
    // Upsert nodes
    const nodeIds: string[] = [];
    for (const node of nodes) {
      const existing = await this.nodeRepo.findById(node.id);
      if (existing) {
        await this.nodeRepo.update(node.id, {
          name: node.name,
          type: node.type,
          description: node.description ?? null,
          pipelineId: node.pipelineId ?? pipelineId,
          stageId: node.stageId ?? null,
          schemaData: node.schema ?? null,
          nodeMetadata: node.metadata ?? null,
        });
      } else {
        await this.nodeRepo.create({
          id: node.id,
          tenantId,
          name: node.name,
          type: node.type,
          description: node.description ?? null,
          pipelineId: node.pipelineId ?? pipelineId,
          stageId: node.stageId ?? null,
          schemaData: node.schema ?? null,
          nodeMetadata: node.metadata ?? null,
        });
      }
      nodeIds.push(node.id);
    }

    // Upsert edges
    const edgeIds: string[] = [];
    for (const edge of edges) {
      const existing = await this.edgeRepo.findById(edge.id);
      if (existing) {
        // Edge already exists, skip update
      } else {
        await this.edgeRepo.create({
          id: edge.id,
          tenantId,
          fromNodeId: edge.from,
          toNodeId: edge.to,
          relationship: edge.relationship,
          fieldMapping: edge.fieldMapping ?? null,
        });
      }
      edgeIds.push(edge.id);
    }

    // Create execution record
    const record = await this.recordRepo.create({
      id: uuidv4(),
      tenantId,
      pipelineId,
      executionId,
      nodeIds,
      edgeIds,
    });

    const graph = await this.buildGraph(tenantId, pipelineId);

    return {
      id: record.id,
      tenantId: record.tenantId,
      pipelineId: record.pipelineId,
      executionId: record.executionId,
      graph,
      recordedAt: record.recordedAt,
    };
  }

  /**
   * Get the latest lineage graph for a pipeline
   */
  async getLineage(pipelineId: string, tenantId?: string): Promise<DataLineageGraph | null> {
    const tid = tenantId || getCurrentTenantId();
    const record = await this.recordRepo.findLatestByPipeline(pipelineId, tid);
    if (!record) return null;

    return this.buildGraph(tid, pipelineId);
  }

  /**
   * Get lineage history for a pipeline
   */
  async getLineageHistory(pipelineId: string, limit: number = 20, tenantId?: string): Promise<LineageRecord[]> {
    const tid = tenantId || getCurrentTenantId();
    const records = await this.recordRepo.findByPipeline(pipelineId, tid, limit);

    const results: LineageRecord[] = [];
    for (const record of records) {
      const graph = await this.buildGraph(tid, pipelineId);
      results.push({
        id: record.id,
        tenantId: record.tenantId,
        pipelineId: record.pipelineId,
        executionId: record.executionId,
        graph,
        recordedAt: record.recordedAt,
      });
    }

    return results;
  }

  /**
   * Add a single node
   */
  async addNode(node: LineageNode, tenantId?: string): Promise<void> {
    const tid = tenantId || getCurrentTenantId();
    const existing = await this.nodeRepo.findById(node.id);
    if (existing) {
      await this.nodeRepo.update(node.id, {
        name: node.name,
        type: node.type,
        description: node.description ?? null,
        pipelineId: node.pipelineId ?? null,
        stageId: node.stageId ?? null,
        schemaData: node.schema ?? null,
        nodeMetadata: node.metadata ?? null,
      });
    } else {
      await this.nodeRepo.create({
        id: node.id,
        tenantId: tid,
        name: node.name,
        type: node.type,
        description: node.description ?? null,
        pipelineId: node.pipelineId ?? null,
        stageId: node.stageId ?? null,
        schemaData: node.schema ?? null,
        nodeMetadata: node.metadata ?? null,
      });
    }
  }

  /**
   * Add a single edge
   */
  async addEdge(edge: LineageEdge, tenantId?: string): Promise<void> {
    const tid = tenantId || getCurrentTenantId();
    await this.edgeRepo.create({
      id: edge.id,
      tenantId: tid,
      fromNodeId: edge.from,
      toNodeId: edge.to,
      relationship: edge.relationship,
      fieldMapping: edge.fieldMapping ?? null,
    });
  }

  /**
   * Get upstream nodes for a given node
   */
  async getUpstream(nodeId: string, tenantId?: string): Promise<LineageNode[]> {
    const tid = tenantId || getCurrentTenantId();
    const edges = await this.edgeRepo.findUpstream(nodeId, tid);
    const nodes: LineageNode[] = [];
    for (const edge of edges) {
      const node = await this.nodeRepo.findById(edge.fromNodeId);
      if (node) nodes.push(this.entityToNode(node));
    }
    return nodes;
  }

  /**
   * Get downstream nodes for a given node
   */
  async getDownstream(nodeId: string, tenantId?: string): Promise<LineageNode[]> {
    const tid = tenantId || getCurrentTenantId();
    const edges = await this.edgeRepo.findDownstream(nodeId, tid);
    const nodes: LineageNode[] = [];
    for (const edge of edges) {
      const node = await this.nodeRepo.findById(edge.toNodeId);
      if (node) nodes.push(this.entityToNode(node));
    }
    return nodes;
  }

  /**
   * Impact analysis for a node
   */
  async getImpactAnalysis(nodeId: string, tenantId?: string): Promise<{
    node: LineageNode | undefined;
    upstreamCount: number;
    downstreamCount: number;
    affectedPipelines: string[];
  }> {
    const tid = tenantId || getCurrentTenantId();
    const nodeEntity = await this.nodeRepo.findById(nodeId);
    const node = nodeEntity ? this.entityToNode(nodeEntity) : undefined;

    const upstream = await this.getUpstream(nodeId, tid);
    const downstream = await this.getDownstream(nodeId, tid);

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

  /**
   * Get all lineage data for a tenant
   */
  async getAllLineage(tenantId?: string): Promise<DataLineageGraph> {
    const tid = tenantId || getCurrentTenantId();
    return this.buildGraph(tid);
  }

  /**
   * Get full lineage graph with statistics
   */
  async getLineageGraph(tenantId?: string): Promise<{
    graph: DataLineageGraph;
    stats: {
      totalNodes: number;
      totalEdges: number;
      sourceCount: number;
      transformCount: number;
      sinkCount: number;
      datasetCount: number;
      modelCount: number;
    };
  }> {
    const tid = tenantId || getCurrentTenantId();
    const graph = await this.buildGraph(tid);

    const stats = {
      totalNodes: graph.nodes.length,
      totalEdges: graph.edges.length,
      sourceCount: graph.nodes.filter(n => n.type === 'source').length,
      transformCount: graph.nodes.filter(n => n.type === 'transform').length,
      sinkCount: graph.nodes.filter(n => n.type === 'sink').length,
      datasetCount: graph.nodes.filter(n => n.type === 'dataset').length,
      modelCount: graph.nodes.filter(n => n.type === 'model').length,
    };

    return { graph, stats };
  }

  // ==================== Private Helpers ====================

  private async buildGraph(tenantId: string, pipelineId?: string): Promise<DataLineageGraph> {
    const nodeFilter = pipelineId ? { pipelineId } : undefined;
    const nodes = await this.nodeRepo.findByTenant(tenantId, nodeFilter);
    const edges = await this.edgeRepo.findByTenant(tenantId);

    // Filter edges to only include those connecting nodes in the graph
    const nodeIds = new Set(nodes.map(n => n.id));
    const filteredEdges = edges.filter(e => nodeIds.has(e.fromNodeId) || nodeIds.has(e.toNodeId));

    return {
      tenantId,
      pipelineId,
      nodes: nodes.map(n => this.entityToNode(n)),
      edges: filteredEdges.map(e => this.entityToEdge(e)),
      generatedAt: new Date(),
    };
  }

  private entityToNode(entity: LineageNodeEntity): LineageNode {
    return {
      id: entity.id,
      name: entity.name,
      type: entity.type,
      description: entity.description ?? undefined,
      pipelineId: entity.pipelineId ?? undefined,
      stageId: entity.stageId ?? undefined,
      schema: entity.schema ?? undefined,
      metadata: entity.metadata ?? undefined,
    };
  }

  private entityToEdge(entity: LineageEdgeEntity): LineageEdge {
    return {
      id: entity.id,
      from: entity.fromNodeId,
      to: entity.toNodeId,
      relationship: entity.relationship,
      fieldMapping: entity.fieldMapping ?? undefined,
    };
  }
}
