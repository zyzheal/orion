/**
 * BranchPolicyRepository - PostgreSQL persistence for branch policies
 *
 * Part of Sub-project F: Data Persistence (Task 1)
 * Maps branch_policies table rows to BranchPolicy domain objects.
 */

import { DatabasePool } from '../services/database';
import { BranchPolicy, MergeStrategy } from '../services/code-repo/types';

export interface CreateBranchPolicyInput {
  id: string;
  repoId: string;
  branchPattern: string;
  preventForcePush?: boolean;
  preventDeletion?: boolean;
  mergeStrategy?: MergeStrategy;
  approvalRules?: Array<{
    id?: string;
    name: string;
    requiredApprovals: number;
    approvers: string[];
    allowAuthorApproval?: boolean;
    requiredRoles?: string[];
  }>;
  requiredChecks?: string[];
  requireCodeOwners?: boolean;
  linearHistory?: boolean;
  allowAdminOverride?: boolean;
}

export interface UpdateBranchPolicyInput {
  preventForcePush?: boolean;
  preventDeletion?: boolean;
  mergeStrategy?: MergeStrategy;
  approvalRules?: Array<{
    id?: string;
    name: string;
    requiredApprovals: number;
    approvers: string[];
    allowAuthorApproval?: boolean;
    requiredRoles?: string[];
  }>;
  requiredChecks?: string[];
  requireCodeOwners?: boolean;
  linearHistory?: boolean;
  allowAdminOverride?: boolean;
}

export class BranchPolicyRepository {
  private pool: DatabasePool;

  constructor(pool: DatabasePool) {
    this.pool = pool;
  }

  /**
   * Insert a new branch policy into the database.
   */
  async create(policy: CreateBranchPolicyInput): Promise<BranchPolicy> {
    const result = await this.pool.query(
      `INSERT INTO branch_policies (
        id, repo_id, branch_pattern, prevent_force_push, prevent_deletion,
        merge_strategy, approval_rules, required_checks, require_code_owners,
        linear_history, allow_admin_override
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        policy.id,
        policy.repoId,
        policy.branchPattern,
        policy.preventForcePush ?? false,
        policy.preventDeletion ?? true,
        policy.mergeStrategy ?? 'merge',
        JSON.stringify(policy.approvalRules ?? []),
        JSON.stringify(policy.requiredChecks ?? []),
        policy.requireCodeOwners ?? false,
        policy.linearHistory ?? false,
        policy.allowAdminOverride ?? false,
      ]
    );
    return this.rowToPolicy(result.rows[0]);
  }

  /**
   * Find a branch policy by its ID.
   */
  async findById(id: string): Promise<BranchPolicy | null> {
    const row = (await this.pool.query(
      'SELECT * FROM branch_policies WHERE id = $1',
      [id]
    )).rows[0];
    return row ? this.rowToPolicy(row) : null;
  }

  /**
   * Find all policies for a given repository.
   */
  async findByRepo(repoId: string): Promise<BranchPolicy[]> {
    const rows = (await this.pool.query(
      'SELECT * FROM branch_policies WHERE repo_id = $1 ORDER BY created_at DESC',
      [repoId]
    )).rows;
    return rows.map(r => this.rowToPolicy(r));
  }

  /**
   * Find all policies across all repositories.
   */
  async findAll(): Promise<BranchPolicy[]> {
    const rows = (await this.pool.query(
      'SELECT * FROM branch_policies ORDER BY created_at DESC'
    )).rows;
    return rows.map(r => this.rowToPolicy(r));
  }

  /**
   * Update a branch policy by ID with partial input.
   */
  async update(id: string, input: UpdateBranchPolicyInput): Promise<BranchPolicy | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    const add = (col: string, val: unknown) => {
      sets.push(`${col} = $${idx++}`);
      params.push(val);
    };

    if (input.preventForcePush !== undefined) add('prevent_force_push', input.preventForcePush);
    if (input.preventDeletion !== undefined) add('prevent_deletion', input.preventDeletion);
    if (input.mergeStrategy !== undefined) add('merge_strategy', input.mergeStrategy);
    if (input.approvalRules !== undefined) add('approval_rules', JSON.stringify(input.approvalRules));
    if (input.requiredChecks !== undefined) add('required_checks', JSON.stringify(input.requiredChecks));
    if (input.requireCodeOwners !== undefined) add('require_code_owners', input.requireCodeOwners);
    if (input.linearHistory !== undefined) add('linear_history', input.linearHistory);
    if (input.allowAdminOverride !== undefined) add('allow_admin_override', input.allowAdminOverride);

    if (sets.length === 0) return this.findById(id);

    sets.push('updated_at = NOW()');
    params.push(id);

    const result = await this.pool.query(
      `UPDATE branch_policies SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );
    return result.rows[0] ? this.rowToPolicy(result.rows[0]) : null;
  }

  /**
   * Delete a branch policy by ID.
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM branch_policies WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Map a database row to a BranchPolicy domain object.
   */
  private rowToPolicy(row: any): BranchPolicy {
    return {
      id: row.id,
      repoId: row.repo_id,
      branchPattern: row.branch_pattern,
      preventForcePush: row.prevent_force_push,
      preventDeletion: row.prevent_deletion,
      mergeStrategy: row.merge_strategy as MergeStrategy,
      approvalRules: row.approval_rules || [],
      requiredChecks: row.required_checks || [],
      requireCodeOwners: row.require_code_owners,
      linearHistory: row.linear_history,
      allowAdminOverride: row.allow_admin_override,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    } as BranchPolicy;
  }
}
