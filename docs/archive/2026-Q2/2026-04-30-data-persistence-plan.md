# Sub-project F: Data Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate 3 services from in-memory Map storage to PostgreSQL Repository pattern.

**Architecture:** Create Repository classes + SQL migrations, modify services to use DB with in-memory fallback.

**Tech Stack:** TypeScript, PostgreSQL, Repository pattern (follow existing patterns in `src/repositories/`)

---

### Task 1: BranchPolicy Persistence

**Files:**
- Create: `src/repositories/BranchPolicyRepository.ts`
- Modify: `src/services/code-repo/BranchPolicyService.ts`
- Modify: `src/db/migrations/050_branch_policies.sql`

- [ ] **Step 1: Create SQL migration**

Create `src/db/migrations/050_branch_policies.sql`:

```sql
CREATE TABLE IF NOT EXISTS branch_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id VARCHAR(255) NOT NULL,
  branch_pattern VARCHAR(255) NOT NULL,
  prevent_force_push BOOLEAN DEFAULT false,
  prevent_deletion BOOLEAN DEFAULT true,
  merge_strategy VARCHAR(50) DEFAULT 'merge',
  require_code_owners BOOLEAN DEFAULT false,
  required_checks JSONB DEFAULT '[]',
  linear_history BOOLEAN DEFAULT false,
  allow_admin_override BOOLEAN DEFAULT false,
  approval_rules JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_branch_policies_repo ON branch_policies(repo_id);
CREATE INDEX IF NOT EXISTS idx_branch_policies_pattern ON branch_policies(branch_pattern);
```

- [ ] **Step 2: Create BranchPolicyRepository**

Create `src/repositories/BranchPolicyRepository.ts`:

```typescript
import { DatabasePool } from '../services/database';
import { BranchPolicy, ApprovalRule, MergeStrategy } from '../services/code-repo/types';

export class BranchPolicyRepository {
  private pool: DatabasePool;
  constructor(pool: DatabasePool) { this.pool = pool; }

  async create(policy: {
    id: string;
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
  }): Promise<BranchPolicy> {
    const result = await this.pool.query(
      `INSERT INTO branch_policies (id, repo_id, branch_pattern, prevent_force_push, prevent_deletion, merge_strategy, approval_rules, required_checks, require_code_owners, linear_history, allow_admin_override)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
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

  async findById(id: string): Promise<BranchPolicy | null> {
    const row = (await this.pool.query('SELECT * FROM branch_policies WHERE id = $1', [id])).rows[0];
    return row ? this.rowToPolicy(row) : null;
  }

  async findByRepo(repoId: string): Promise<BranchPolicy[]> {
    const rows = (await this.pool.query('SELECT * FROM branch_policies WHERE repo_id = $1 ORDER BY created_at DESC', [repoId])).rows;
    return rows.map(r => this.rowToPolicy(r));
  }

  async findAll(): Promise<BranchPolicy[]> {
    const rows = (await this.pool.query('SELECT * FROM branch_policies ORDER BY created_at DESC')).rows;
    return rows.map(r => this.rowToPolicy(r));
  }

  async update(id: string, input: {
    preventForcePush?: boolean;
    preventDeletion?: boolean;
    mergeStrategy?: MergeStrategy;
    approvalRules?: ApprovalRule[];
    requiredChecks?: string[];
    requireCodeOwners?: boolean;
    linearHistory?: boolean;
    allowAdminOverride?: boolean;
  }): Promise<BranchPolicy | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    const add = (col: string, val: unknown) => { sets.push(`${col} = $${idx++}`); params.push(val); };
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

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM branch_policies WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

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
```

- [ ] **Step 3: Modify BranchPolicyService to use Repository**

In `BranchPolicyService.ts`:
1. Add constructor accepting optional `BranchPolicyRepository`
2. In `create()`, after memory storage, add: `if (this.repository) await this.repository.create(policy);`
3. In `findByRepo()`, add: `if (this.repository) return this.repository.findByRepo(repoId);`
4. In `findById()`, add: `if (this.repository) return this.repository.findById(id);`
5. In `update()`, add: `if (this.repository) await this.repository.update(id, input);`
6. In `delete()`, add: `if (this.repository) await this.repository.delete(id);`

- [ ] **Step 4: Run migration and type-check**

```bash
psql -d orion_platform -f src/db/migrations/050_branch_policies.sql
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/repositories/BranchPolicyRepository.ts src/services/code-repo/BranchPolicyService.ts src/db/migrations/050_branch_policies.sql
git commit -m "feat(branch-policy): add PostgreSQL persistence with in-memory fallback"
```

---

### Task 2: ConfigApproval Persistence

**Files:**
- Create: `src/repositories/ConfigApprovalRepository.ts`
- Modify: `src/services/config-mgmt/ConfigApprovalService.ts`
- Modify: `src/db/migrations/051_config_approvals.sql`

- [ ] **Step 1: Create SQL migration**

Create `src/db/migrations/051_config_approvals.sql`:

```sql
CREATE TABLE IF NOT EXISTS config_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key VARCHAR(255) NOT NULL,
  tenant_id VARCHAR(255) NOT NULL,
  change_type VARCHAR(50) NOT NULL,
  old_value JSONB,
  new_value JSONB,
  status VARCHAR(50) DEFAULT 'pending',
  requested_by VARCHAR(255),
  approved_by VARCHAR(255),
  rejected_by VARCHAR(255),
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_config_change_requests_tenant ON config_change_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_config_change_requests_status ON config_change_requests(status);
```

- [ ] **Step 2: Create ConfigApprovalRepository**

Create `src/repositories/ConfigApprovalRepository.ts` following the same pattern as BranchPolicyRepository, with methods: `create`, `findById`, `findByTenant`, `findByStatus`, `updateStatus`, `approve`, `reject`, `delete`.

- [ ] **Step 3: Modify ConfigApprovalService**

Read `ConfigApprovalService.ts`, identify all Map usages (`changeRequests`), and add Repository calls with in-memory fallback following the same pattern as Task 1.

- [ ] **Step 4: Run migration and type-check**

```bash
psql -d orion_platform -f src/db/migrations/051_config_approvals.sql
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/repositories/ConfigApprovalRepository.ts src/services/config-mgmt/ConfigApprovalService.ts src/db/migrations/051_config_approvals.sql
git commit -m "feat(config-approval): add PostgreSQL persistence with in-memory fallback"
```

---

### Task 3: CodeOwnership Persistence

**Files:**
- Create: `src/repositories/CodeOwnershipRepository.ts`
- Modify: `src/services/code-repo/CodeOwnershipService.ts`
- Modify: `src/db/migrations/052_code_ownership.sql`

- [ ] **Step 1: Create SQL migration**

Create `src/db/migrations/052_code_ownership.sql`:

```sql
CREATE TABLE IF NOT EXISTS code_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id VARCHAR(255) NOT NULL,
  path_pattern VARCHAR(500) NOT NULL,
  owners JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_code_owners_repo ON code_owners(repo_id);
CREATE INDEX IF NOT EXISTS idx_code_owners_pattern ON code_owners(path_pattern);
```

- [ ] **Step 2: Create CodeOwnershipRepository**

Create `src/repositories/CodeOwnershipRepository.ts` with methods: `create`, `findByRepo`, `findByPath`, `findAll`, `update`, `delete`.

- [ ] **Step 3: Modify CodeOwnershipService**

Add Repository calls with in-memory fallback following the same pattern.

- [ ] **Step 4: Run migration and type-check**

```bash
psql -d orion_platform -f src/db/migrations/052_code_ownership.sql
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/repositories/CodeOwnershipRepository.ts src/services/code-repo/CodeOwnershipService.ts src/db/migrations/052_code_ownership.sql
git commit -m "feat(code-ownership): add PostgreSQL persistence with in-memory fallback"
```
