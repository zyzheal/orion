/**
 * Orion CMDB Service
 * CMDB 核心服务 - PostgreSQL 实现
 */

import { Pool } from 'pg';
import { CmdbRepository } from '../repositories/CmdbRepository';
import {
  CmdbNode,
  CmdbApplication,
  CmdbTopology,
  CmdbReconciliation,
  CmdbNodeType,
  CmdbNodeStatus,
  ReconciliationStatus,
  type CmdbNodeFilters,
} from '../types/cmdb';
import { v4 as uuidv4 } from 'uuid';

export class CmdbService {
  private repo: CmdbRepository;

  constructor(pool: Pool) {
    this.repo = new CmdbRepository(pool);
  }

  // ========== 配置节点 ==========

  async createNode(data: Omit<CmdbNode, 'id' | 'createdAt' | 'updatedAt'>): Promise<CmdbNode> {
    return this.repo.createNode(data);
  }

  async getNode(nodeId: string): Promise<CmdbNode | null> {
    return this.repo.getNode(nodeId);
  }

  async listNodes(filters: CmdbNodeFilters = {}): Promise<{ items: CmdbNode[]; total: number }> {
    return this.repo.listNodes(filters);
  }

  async updateNode(nodeId: string, updates: Partial<Omit<CmdbNode, 'id' | 'createdAt' | 'updatedAt'>>): Promise<CmdbNode | null> {
    return this.repo.updateNode(nodeId, updates);
  }

  async deleteNode(nodeId: string): Promise<boolean> {
    return this.repo.deleteNode(nodeId);
  }

  // ========== 应用管理 ==========

  async createApplication(data: Omit<CmdbApplication, 'id' | 'createdAt' | 'updatedAt'>): Promise<CmdbApplication> {
    return this.repo.createApplication(data);
  }

  async getApplication(appId: string): Promise<CmdbApplication | null> {
    return this.repo.getApplication(appId);
  }

  async listApplications(): Promise<{ items: CmdbApplication[]; total: number }> {
    return this.repo.listApplications();
  }

  // ========== 拓扑管理 ==========

  async getTopology(nodeId?: string): Promise<CmdbTopology[]> {
    return this.repo.getTopology(nodeId);
  }

  async addTopologyEntry(sourceNodeId: string, targetNodeId: string, relationshipType: string): Promise<CmdbTopology> {
    return this.repo.addTopologyEntry(sourceNodeId, targetNodeId, relationshipType);
  }

  // ========== 对账管理 ==========

  async reconcile(name: string, reconciliationType: 'k8s' | 'cloud' | 'manual'): Promise<CmdbReconciliation> {
    const nodes = await this.repo.listNodes();
    const diffs: any[] = [];

    for (const node of nodes.items) {
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
      reconciledCount: nodes.total - diffs.length,
      driftCount: diffs.length,
      executorId: 'system',
      createdAt: new Date(),
    };

    await this.repo.saveReconciliation(result);
    return result;
  }

  async getReconciliation(id: string): Promise<CmdbReconciliation | null> {
    return this.repo.getReconciliation(id);
  }

  // ========== 事件 ==========

  async publishEvent(nodeId: string, eventType: string, data: Record<string, unknown>): Promise<void> {
    await this.repo.publishEvent(nodeId, eventType, data);
  }
}
