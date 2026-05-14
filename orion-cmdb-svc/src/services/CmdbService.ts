/**
 * Orion CMDB Service
 * CMDB 核心服务 - 基于内存的实现
 */

import { v4 as uuidv4 } from 'uuid';
import {
  CmdbNode,
  CmdbApplication,
  CmdbTopology,
  CmdbReconciliation,
  CmdbNodeType,
  CmdbNodeStatus,
  ReconciliationStatus,
} from '../types/cmdb';

export class CmdbService {
  private nodes = new Map<string, CmdbNode>();
  private applications = new Map<string, CmdbApplication>();
  private topology = new Map<string, CmdbTopology[]>();
  private reconciliations = new Map<string, CmdbReconciliation>();

  async createNode(data: Omit<CmdbNode, 'id' | 'createdAt' | 'updatedAt'>): Promise<CmdbNode> {
    const node: CmdbNode = {
      ...data,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.nodes.set(node.id, node);
    return node;
  }

  async getNode(nodeId: string): Promise<CmdbNode | null> {
    return this.nodes.get(nodeId) || null;
  }

  async listNodes(filters: { type?: CmdbNodeType; status?: CmdbNodeStatus; applicationId?: string; environment?: string }): Promise<{ items: CmdbNode[]; total: number }> {
    let items = Array.from(this.nodes.values());

    if (filters.type) items = items.filter(n => n.type === filters.type);
    if (filters.status) items = items.filter(n => n.status === filters.status);
    if (filters.applicationId) items = items.filter(n => n.applicationId === filters.applicationId);
    if (filters.environment) items = items.filter(n => n.environment === filters.environment);

    return { items, total: items.length };
  }

  async updateNode(nodeId: string, updates: Partial<Omit<CmdbNode, 'id' | 'createdAt'>>): Promise<CmdbNode | null> {
    const existing = this.nodes.get(nodeId);
    if (!existing) return null;

    const updated: CmdbNode = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.nodes.set(nodeId, updated);
    return updated;
  }

  async deleteNode(nodeId: string): Promise<boolean> {
    const deleted = this.nodes.delete(nodeId);
    // Also remove topology entries for this node
    this.topology.delete(nodeId);
    return deleted;
  }

  async createApplication(data: Omit<CmdbApplication, 'id' | 'createdAt' | 'updatedAt'>): Promise<CmdbApplication> {
    const app: CmdbApplication = {
      ...data,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.applications.set(app.id, app);
    return app;
  }

  async getApplication(appId: string): Promise<CmdbApplication | null> {
    return this.applications.get(appId) || null;
  }

  async listApplications(): Promise<{ items: CmdbApplication[]; total: number }> {
    const items = Array.from(this.applications.values());
    return { items, total: items.length };
  }

  async getTopology(nodeId?: string): Promise<CmdbTopology[]> {
    if (nodeId) {
      return this.topology.get(nodeId) || [];
    }
    // Return all topology entries
    const all: CmdbTopology[] = [];
    for (const entries of this.topology.values()) {
      all.push(...entries);
    }
    // Auto-generate topology from node parent relationships
    for (const node of this.nodes.values()) {
      if (node.parentId) {
        all.push({
          id: `topo-${node.parentId}-${node.id}`,
          sourceNodeId: node.parentId,
          targetNodeId: node.id,
          relationType: 'manages',
          attributes: {},
          createdAt: node.createdAt,
        });
      }
    }
    return all;
  }

  async addTopologyEntry(sourceNodeId: string, targetNodeId: string, relationshipType: string): Promise<CmdbTopology> {
    const entry: CmdbTopology = {
      id: `topo-${sourceNodeId}-${targetNodeId}`,
      sourceNodeId,
      targetNodeId,
      relationType: relationshipType as CmdbTopology['relationType'],
      attributes: {},
      createdAt: new Date(),
    };
    if (!this.topology.has(sourceNodeId)) {
      this.topology.set(sourceNodeId, []);
    }
    this.topology.get(sourceNodeId)!.push(entry);
    return entry;
  }

  async reconcile(name: string, reconciliationType: 'k8s' | 'cloud' | 'manual'): Promise<CmdbReconciliation> {
    const diffs: any[] = [];
    // Compare registered nodes against expected state
    for (const node of this.nodes.values()) {
      if (node.status !== 'active') {
        diffs.push({ nodeId: node.id, expected: 'active', actual: node.status, severity: 'warning' });
      }
    }

    const result: CmdbReconciliation = {
      id: `recon-${Date.now()}`,
      name,
      reconciliationType,
      status: diffs.length > 0 ? ReconciliationStatus.DRIFT_DETECTED : ReconciliationStatus.SYNCED,
      diffs,
      reconciledCount: this.nodes.size - diffs.length,
      driftCount: diffs.length,
      executorId: 'system',
      createdAt: new Date(),
    };
    this.reconciliations.set(result.id, result);
    return result;
  }

  async getReconciliation(id: string): Promise<CmdbReconciliation | null> {
    return this.reconciliations.get(id) || null;
  }

  async publishEvent(nodeId: string, eventType: string, data: Record<string, unknown>): Promise<void> {
    // In production, publish to NATS event bus
    const node = this.nodes.get(nodeId);
    if (node) {
      // Event is logged/tracked for now
    }
  }
}
