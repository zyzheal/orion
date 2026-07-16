/**
 * Branch Policy Repository - PostgreSQL 数据访问层
 */

import { Pool } from 'pg';
import { BranchPolicy, ApprovalRule, MergeStrategy } from '../types/code-repo';

type DatabasePool = Pool | { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

export interface BranchPolicyCreateInput {
  repoId: string;
  branchPattern: string;
  preventForcePush?: boolean;
  preventDeletion?: boolean;
  mergeStrategy?: MergeStrategy;
  approvalRules?: ApprovalRule[];
  requiredChecks?: string[];
  requireCodeOwners?: boolean;
  linearHistory?: boolean;
  allowAdminOverride?: boolean;
}

export interface BranchPolicyUpdateInput {
  preventForcePush?: boolean;
  preventDeletion?: boolean;
  mergeStrategy?: MergeStrategy;
  approvalRules?: ApprovalRule[];
  requiredChecks?: string[];
  requireCodeOwners?: boolean;
  linearHistory?: boolean;
  allowAdminOverride?: boolean;
}

export class BranchPolicyRepository {
  constructor(private pool: DatabasePool) {}

  async findById(id: string): Promise<BranchPolicy | null> {
    const result = await this.pool.query('SELECT * FROM branch_policies WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async findByRepo(repoId: string): Promise<BranchPolicy[]> {
    const result = await this.pool.query(
      'SELECT * FROM branch_policies WHERE repo_id = $1 ORDER BY created_at DESC',
      [repoId]
    );
    return result.rows;
  }

  async create(input: BranchPolicyCreateInput): Promise<BranchPolicy> {
    const result = await this.pool.query(
      'INSERT INTO branch_policies DEFAULT VALUES RETURNING *'
    );
    return result.rows[0];
  }

  async update(id: string, input: BranchPolicyUpdateInput): Promise<BranchPolicy | null> {
    const result = await this.pool.query(
      'UPDATE branch_policies SET updated_at = NOW() WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM branch_policies WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }
}
