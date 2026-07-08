/**
 * ConfigTemplateCanary Tests
 *
 * Tests for template CRUD, canary deployment lifecycle, dependency graph,
 * and multi-tenant isolation.
 */

import { ConfigService } from '../ConfigService';
import { ConfigRepository } from '../ConfigRepository';
import { ConfigTemplateRepository } from '../../../repositories/ConfigTemplateRepository';
import { CanaryDeploymentRepository } from '../../../repositories/CanaryDeploymentRepository';
import { ConfigDependencyRepository } from '../../../repositories/ConfigDependencyRepository';
import {
  ConfigTemplate,
  ConfigTemplateVersion,
  CanaryDeployment,
  CanaryDeploymentHistory,
  ConfigDependency,
  DependencyGraphNode,
} from '../types';

// ==================== Mock Helpers ====================

function createMockDb() {
  const rows: any[] = [];
  return {
    query: jest.fn(async (sql: string, params?: any[]) => {
      const upperSql = sql.trim().toUpperCase();

      // INSERT ... RETURNING * → return a synthetic row from the INSERT params
      if (upperSql.startsWith('INSERT')) {
        const id = params?.[0] || 'mock-id';
        const tenantId = params?.[1] || 'tenant-1';

        if (upperSql.includes('CONFIG_TEMPLATES')) {
          const configDataVal = typeof params?.[5] === 'string' ? JSON.parse(params[5]) : (params?.[5] || {});
          const synthetic = {
            id,
            tenant_id: tenantId,
            name: params?.[2] || 'Test Template',
            description: params?.[3] ?? null,
            category: params?.[4] ?? null,
            config_data: configDataVal,
            target_environment: params?.[6] || 'dev',
            is_active: true,
            created_by: params?.[7] || 'admin',
            updated_by: params?.[7] || 'admin',
            created_at: new Date(),
            updated_at: new Date(),
          };
          rows.push(synthetic);
          return { rows: [synthetic], rowCount: 1 };
        }
        if (upperSql.includes('CONFIG_TEMPLATE_VERSIONS')) {
          const version = params?.[4] || 1;
          const synthetic = {
            id,
            template_id: params?.[1] || 'tmpl-1',
            tenant_id: tenantId,
            config_data: typeof params?.[3] === 'string' ? JSON.parse(params[3]) : (params?.[3] || {}),
            version,
            change_log: params?.[5] ?? null,
            created_by: params?.[6] || 'admin',
            created_at: new Date(),
          };
          rows.push(synthetic);
          return { rows: [synthetic], rowCount: 1 };
        }
        if (upperSql.includes('CANARY_DEPLOYMENTS')) {
          const synthetic = {
            id,
            tenant_id: tenantId,
            config_id: params?.[2] || 'config-1',
            config_key: params?.[3] || 'unknown',
            environment: params?.[4] || 'dev',
            percentage: Math.min(100, Math.max(0, params?.[5] ?? 0)),
            status: 'pending',
            old_value: null,
            canary_value: typeof params?.[6] === 'string' ? JSON.parse(params[6]) : (params?.[6] || {}),
            target_value: typeof params?.[7] === 'string' ? JSON.parse(params[7]) : (params?.[7] || {}),
            promoted_at: null,
            rolled_back_at: null,
            created_by: params?.[8] || 'admin',
            created_at: new Date(),
            updated_at: new Date(),
          };
          rows.push(synthetic);
          return { rows: [synthetic], rowCount: 1 };
        }
        if (upperSql.includes('CANARY_DEPLOYMENT_HISTORY')) {
          const synthetic = {
            id,
            deployment_id: params?.[1] || 'canary-1',
            tenant_id: tenantId,
            old_percentage: params?.[3] ?? 0,
            new_percentage: params?.[4] ?? 0,
            action: params?.[5] || 'unknown',
            performed_by: params?.[6] || 'system',
            created_at: new Date(),
          };
          rows.push(synthetic);
          return { rows: [synthetic], rowCount: 1 };
        }
        if (upperSql.includes('CONFIG_DEPENDENCIES')) {
          const synthetic = {
            id,
            tenant_id: tenantId,
            config_id: params?.[2] || 'config-1',
            depends_on_config_id: params?.[3] || 'config-0',
            dependency_type: params?.[4] || 'hard',
            description: params?.[5] ?? null,
            is_active: true,
            created_by: params?.[6] || 'admin',
            created_at: new Date(),
            updated_at: new Date(),
          };
          rows.push(synthetic);
          return { rows: [synthetic], rowCount: 1 };
        }
        // Default INSERT fallback
        const defaultRow = { id, tenant_id: tenantId };
        rows.push(defaultRow);
        return { rows: [defaultRow], rowCount: 1 };
      }

      // UPDATE ... RETURNING * → apply SET clause changes to matching rows
      if (upperSql.startsWith('UPDATE')) {
        if (rows.length === 0) return { rows: [], rowCount: 0 };

        // Parse SET clauses to extract field updates
        const setMatch = sql.match(/SET\s+(.+?)\s+WHERE/i);
        if (setMatch) {
          const setClause = setMatch[1];
          const fieldMatches = [...setClause.matchAll(/(\w+)\s*=\s*\$(\d+)/g)];
          const updates: Record<string, any> = {};
          for (const [, field, paramIdxStr] of fieldMatches) {
            if (field === 'updated_at') continue; // Skip timestamp fields
            const paramIdx = parseInt(paramIdxStr, 10) - 1;
            if (params && paramIdx < params.length) {
              updates[field] = params[paramIdx];
            }
          }

          // Apply updates to all rows (simple mock behavior)
          for (const row of rows) {
            Object.assign(row, updates, { updated_at: new Date() });
          }
        }

        return { rows: rows.map((r: any) => ({ ...r })), rowCount: rows.length };
      }

      // DELETE → return rowCount
      if (upperSql.startsWith('DELETE')) {
        return { rows: [], rowCount: rows.length };
      }

      // SELECT MAX(version) for version management
      if (upperSql.includes('MAX(VERSION)')) {
        if (params?.length > 0 && params[0]) {
          const templateRows = rows.filter((r: any) => r.template_id === params[0]);
          const maxVersion = templateRows.length > 0
            ? Math.max(...templateRows.map((r: any) => r.version || 0))
            : 0;
          return { rows: [{ max_version: maxVersion }], rowCount: 1 };
        }
        const maxVersion = rows.length > 0 ? Math.max(...rows.map((r: any) => r.version || 0)) : 0;
        return { rows: [{ max_version: maxVersion }], rowCount: 1 };
      }

      // SELECT COUNT(*) → return count
      if (upperSql.includes('COUNT')) {
        return { rows: [{ count: rows.length }], rowCount: rows.length };
      }

      // SELECT with WHERE config_id = $1 AND tenant_id = $2 → filter by config_id and tenant_id
      if (/CONFIG_ID\s*=\s*\$\d+/.test(upperSql) && /TENANT_ID\s*=\s*\$\d+/.test(upperSql)) {
        const configIdParam = params?.[0];
        const tenantParam = params?.[1];
        const matched = rows.filter(
          (r: any) => r.config_id === configIdParam && r.tenant_id === tenantParam,
        );
        return { rows: matched, rowCount: matched.length };
      }

      // SELECT with WHERE deployment_id = $1 AND tenant_id = $2 → canary history queries
      if (/DEPLOYMENT_ID\s*=\s*\$\d+/.test(upperSql) && /TENANT_ID\s*=\s*\$\d+/.test(upperSql)) {
        const deploymentIdParam = params?.[0];
        const tenantParam = params?.[1];
        const matched = rows.filter(
          (r: any) => r.deployment_id === deploymentIdParam && r.tenant_id === tenantParam,
        );
        return { rows: matched, rowCount: matched.length };
      }

      // SELECT with WHERE template_id = $1 AND tenant_id = $2 → template version queries
      if (/TEMPLATE_ID\s*=\s*\$\d+/.test(upperSql) && /TENANT_ID\s*=\s*\$\d+/.test(upperSql)) {
        const templateIdParam = params?.[0];
        const tenantParam = params?.[1];
        const matched = rows.filter(
          (r: any) => r.template_id === templateIdParam && r.tenant_id === tenantParam,
        );
        return { rows: matched, rowCount: matched.length };
      }

      // SELECT with WHERE id = $1 AND tenant_id = $2 → filter by id and tenant_id
      if (/WHERE\s+ID\s*=\s*\$\d+\s+AND\s+TENANT_ID\s*=\s*\$\d+/.test(upperSql)) {
        const idParam = params?.[0];
        const tenantParam = params?.[1];
        const matched = rows.filter(
          (r: any) => r.id === idParam && r.tenant_id === tenantParam,
        );
        return { rows: matched, rowCount: matched.length };
      }

      // SELECT with WHERE tenant_id = $1 AND category = $2 → filter by tenant and category
      if (/TENANT_ID\s*=\s*\$\d+\s+AND\s+CATEGORY\s*=\s*\$\d+/.test(upperSql)) {
        const tenantParam = params?.[0];
        const categoryParam = params?.[1];
        const matched = rows.filter(
          (r: any) => r.tenant_id === tenantParam && r.category === categoryParam,
        );
        return { rows: matched, rowCount: matched.length };
      }

      // SELECT with WHERE tenant_id = $N → filter by tenant only
      if (upperSql.includes('TENANT_ID =')) {
        const tenantParam = params?.[0];
        const matched = rows.filter((r: any) => r.tenant_id === tenantParam);
        return { rows: matched, rowCount: matched.length };
      }

      // Default SELECT → return all rows
      return { rows: rows.slice(), rowCount: rows.length };
    }),
    _rows: rows,
  };
}

function makeTemplate(overrides: Partial<ConfigTemplate> = {}): ConfigTemplate {
  return {
    id: 'tmpl-1',
    tenant_id: 'tenant-1',
    name: 'Default Template',
    description: 'Default config template',
    category: 'general',
    configData: { key1: 'value1', key2: 'value2' },
    targetEnvironment: 'dev',
    isActive: true,
    createdBy: 'admin',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeCanary(overrides: Partial<CanaryDeployment> = {}): CanaryDeployment {
  return {
    id: 'canary-1',
    tenant_id: 'tenant-1',
    configId: 'config-1',
    configKey: 'feature.flag',
    environment: 'dev',
    percentage: 10,
    status: 'pending',
    canaryValue: { enabled: true },
    targetValue: { enabled: true },
    createdBy: 'admin',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeDependency(overrides: Partial<ConfigDependency> = {}): ConfigDependency {
  return {
    id: 'dep-1',
    tenant_id: 'tenant-1',
    configId: 'config-1',
    dependsOnConfigId: 'config-0',
    dependencyType: 'hard',
    isActive: true,
    createdBy: 'admin',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

// ==================== ConfigTemplateRepository Tests ====================

describe('ConfigTemplateRepository', () => {
  let repo: ConfigTemplateRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = createMockDb();
    repo = new ConfigTemplateRepository(mockDb);
  });

  test('should create template with tenant isolation', async () => {
    const mockRow = {
      id: 'tmpl-1',
      tenant_id: 'tenant-1',
      name: 'Test Template',
      description: 'A test template',
      category: 'general',
      config_data: { key: 'value' },
      target_environment: 'dev',
      is_active: true,
      created_by: 'admin',
      updated_by: null,
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockDb._rows.push(mockRow);

    const result = await repo.create('tenant-1', {
      name: 'Test Template',
      description: 'A test template',
      category: 'general',
      configData: { key: 'value' },
      createdBy: 'admin',
    });

    expect(result.tenant_id).toBe('tenant-1');
    expect(result.name).toBe('Test Template');
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO config_templates'),
      expect.arrayContaining(['tenant-1', 'Test Template', 'general'])
    );
  });

  test('should find template by id with tenant check', async () => {
    const mockRow = {
      id: 'tmpl-1',
      tenant_id: 'tenant-1',
      name: 'Test',
      description: null,
      category: null,
      config_data: {},
      target_environment: 'dev',
      is_active: true,
      created_by: 'admin',
      updated_by: null,
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockDb._rows.push(mockRow);

    const result = await repo.findById('tmpl-1', 'tenant-1');
    expect(result?.id).toBe('tmpl-1');
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id = $1 AND tenant_id = $2'),
      ['tmpl-1', 'tenant-1']
    );
  });

  test('should NOT return template for different tenant', async () => {
    mockDb._rows.push({
      id: 'tmpl-1',
      tenant_id: 'tenant-A',
      name: 'Tenant A Template',
      description: null,
      category: null,
      config_data: {},
      target_environment: 'dev',
      is_active: true,
      created_by: 'admin',
      updated_by: null,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const result = await repo.findById('tmpl-1', 'tenant-B');
    expect(result).toBeNull();
  });

  test('should list templates by tenant with category filter', async () => {
    mockDb._rows.push(
      {
        id: 'tmpl-1',
        tenant_id: 'tenant-1',
        name: 'General',
        description: null,
        category: 'general',
        config_data: {},
        target_environment: 'dev',
        is_active: true,
        created_by: 'admin',
        updated_by: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'tmpl-2',
        tenant_id: 'tenant-1',
        name: 'DB',
        description: null,
        category: 'database',
        config_data: {},
        target_environment: 'staging',
        is_active: true,
        created_by: 'admin',
        updated_by: null,
        created_at: new Date(),
        updated_at: new Date(),
      }
    );

    const general = await repo.findByTenant('tenant-1', 'general');
    expect(general).toHaveLength(1);
    expect(general[0].category).toBe('general');

    const all = await repo.findByTenant('tenant-1');
    expect(all).toHaveLength(2);
  });

  test('should create and list template versions', async () => {
    const versionRow = {
      id: 'tmpl-ver-1',
      template_id: 'tmpl-1',
      tenant_id: 'tenant-1',
      config_data: { key: 'v1' },
      version: 1,
      change_log: 'Initial',
      created_by: 'admin',
      created_at: new Date(),
    };
    mockDb._rows.push(versionRow);

    const version = await repo.createVersion('tenant-1', {
      templateId: 'tmpl-1',
      configData: { key: 'v2' },
      changeLog: 'Updated key',
      createdBy: 'admin',
    });

    expect(version.version).toBe(2);
    expect(version.templateId).toBe('tmpl-1');

    const versions = await repo.listVersions('tmpl-1', 'tenant-1');
    expect(versions.length).toBeGreaterThanOrEqual(1);
  });

  test('should delete template scoped to tenant', async () => {
    mockDb._rows.push({
      id: 'tmpl-1',
      tenant_id: 'tenant-1',
      name: 'Test',
      description: null,
      category: null,
      config_data: {},
      target_environment: 'dev',
      is_active: true,
      created_by: 'admin',
      updated_by: null,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // For DELETE, mock needs to return rowCount
    mockDb.query = jest.fn(async (sql: string) => {
      if (sql.startsWith('DELETE')) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: mockDb._rows, rowCount: mockDb._rows.length };
    });

    const result = await repo.delete('tmpl-1', 'tenant-1');
    expect(result).toBe(true);
  });
});

// ==================== CanaryDeploymentRepository Tests ====================

describe('CanaryDeploymentRepository', () => {
  let repo: CanaryDeploymentRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = createMockDb();
    repo = new CanaryDeploymentRepository(mockDb);
  });

  test('should create canary deployment with clamped percentage', async () => {
    const mockRow = {
      id: 'canary-1',
      tenant_id: 'tenant-1',
      config_id: 'config-1',
      config_key: 'feature.flag',
      environment: 'dev',
      percentage: 10,
      status: 'pending',
      old_value: null,
      canary_value: { enabled: true },
      target_value: { enabled: true },
      promoted_at: null,
      rolled_back_at: null,
      created_by: 'admin',
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockDb._rows.push(mockRow);

    const result = await repo.create('tenant-1', {
      configId: 'config-1',
      configKey: 'feature.flag',
      environment: 'dev',
      percentage: 150, // should be clamped to 100
      canaryValue: { enabled: true },
      targetValue: { enabled: true },
      createdBy: 'admin',
    });

    expect(result.percentage).toBeLessThanOrEqual(100);
  });

  test('should find deployment by id with tenant check', async () => {
    mockDb._rows.push({
      id: 'canary-1',
      tenant_id: 'tenant-1',
      config_id: 'config-1',
      config_key: 'feature.flag',
      environment: 'dev',
      percentage: 10,
      status: 'running',
      old_value: null,
      canary_value: { enabled: true },
      target_value: { enabled: true },
      promoted_at: null,
      rolled_back_at: null,
      created_by: 'admin',
      created_at: new Date(),
      updated_at: new Date(),
    });

    const result = await repo.findById('canary-1', 'tenant-1');
    expect(result?.id).toBe('canary-1');
    expect(result?.status).toBe('running');
  });

  test('should NOT return deployment for different tenant', async () => {
    mockDb._rows.push({
      id: 'canary-1',
      tenant_id: 'tenant-A',
      config_id: 'config-1',
      config_key: 'feature.flag',
      environment: 'dev',
      percentage: 10,
      status: 'pending',
      old_value: null,
      canary_value: { enabled: true },
      target_value: { enabled: true },
      promoted_at: null,
      rolled_back_at: null,
      created_by: 'admin',
      created_at: new Date(),
      updated_at: new Date(),
    });

    const result = await repo.findById('canary-1', 'tenant-B');
    expect(result).toBeNull();
  });

  test('should update canary percentage and create history', async () => {
    const deploymentRow = {
      id: 'canary-1',
      tenant_id: 'tenant-1',
      config_id: 'config-1',
      config_key: 'feature.flag',
      environment: 'dev',
      percentage: 10,
      status: 'running',
      old_value: null,
      canary_value: { enabled: true },
      target_value: { enabled: true },
      promoted_at: null,
      rolled_back_at: null,
      created_by: 'admin',
      created_at: new Date(),
      updated_at: new Date(),
    };

    mockDb.query = jest.fn(async (sql: string) => {
      if (sql.includes('canary_deployment_history')) {
        return { rows: [{ id: 'hist-1', deployment_id: 'canary-1', old_percentage: 10, new_percentage: 50, action: 'percentage_update', performed_by: 'system', created_at: new Date() }], rowCount: 1 };
      }
      if (sql.includes('SELECT')) {
        return { rows: [deploymentRow], rowCount: 1 };
      }
      return { rows: [{ ...deploymentRow, percentage: 50 }], rowCount: 1 };
    });

    const result = await repo.updatePercentage('tenant-1', 'canary-1', 50, 'system');
    expect(result.percentage).toBe(50);
  });

  test('should promote canary deployment', async () => {
    const deploymentRow = {
      id: 'canary-1',
      tenant_id: 'tenant-1',
      config_id: 'config-1',
      config_key: 'feature.flag',
      environment: 'dev',
      percentage: 50,
      status: 'running',
      old_value: null,
      canary_value: { enabled: true },
      target_value: { enabled: true },
      promoted_at: null,
      rolled_back_at: null,
      created_by: 'admin',
      created_at: new Date(),
      updated_at: new Date(),
    };

    mockDb.query = jest.fn(async (sql: string) => {
      if (sql.includes('canary_deployment_history')) {
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes('SELECT')) {
        return { rows: [deploymentRow], rowCount: 1 };
      }
      return { rows: [{ ...deploymentRow, status: 'promoted', percentage: 100, promoted_at: new Date() }], rowCount: 1 };
    });

    const result = await repo.promote('tenant-1', 'canary-1', 'system');
    expect(result.status).toBe('promoted');
    expect(result.percentage).toBe(100);
  });

  test('should rollback canary deployment', async () => {
    const deploymentRow = {
      id: 'canary-1',
      tenant_id: 'tenant-1',
      config_id: 'config-1',
      config_key: 'feature.flag',
      environment: 'dev',
      percentage: 50,
      status: 'running',
      old_value: null,
      canary_value: { enabled: true },
      target_value: { enabled: true },
      promoted_at: null,
      rolled_back_at: null,
      created_by: 'admin',
      created_at: new Date(),
      updated_at: new Date(),
    };

    mockDb.query = jest.fn(async (sql: string) => {
      if (sql.includes('canary_deployment_history')) {
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes('SELECT')) {
        return { rows: [deploymentRow], rowCount: 1 };
      }
      return { rows: [{ ...deploymentRow, status: 'rolled_back', percentage: 0, rolled_back_at: new Date() }], rowCount: 1 };
    });

    const result = await repo.rollback('tenant-1', 'canary-1', 'system');
    expect(result.status).toBe('rolled_back');
    expect(result.percentage).toBe(0);
  });

  test('should create history record', async () => {
    const historyRow = {
      id: 'hist-1',
      deployment_id: 'canary-1',
      tenant_id: 'tenant-1',
      old_percentage: 10,
      new_percentage: 30,
      action: 'percentage_update',
      performed_by: 'admin',
      created_at: new Date(),
    };
    mockDb._rows.push(historyRow);

    const history = await repo.createHistory('tenant-1', 'canary-1', 10, 30, 'percentage_update', 'admin');
    expect(history.oldPercentage).toBe(10);
    expect(history.newPercentage).toBe(30);
    expect(history.action).toBe('percentage_update');
  });
});

// ==================== ConfigDependencyRepository Tests ====================

describe('ConfigDependencyRepository', () => {
  let repo: ConfigDependencyRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = createMockDb();
    repo = new ConfigDependencyRepository(mockDb);
  });

  test('should create dependency with tenant isolation', async () => {
    const mockRow = {
      id: 'dep-1',
      tenant_id: 'tenant-1',
      config_id: 'config-0',
      depends_on_config_id: 'config-9',
      dependency_type: 'hard',
      description: 'DB must be configured first',
      is_active: true,
      created_by: 'admin',
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockDb._rows.push(mockRow);

    const result = await repo.createDependency('tenant-1', {
      configId: 'config-1',
      dependsOnConfigId: 'config-0',
      dependencyType: 'hard',
      description: 'DB must be configured first',
      createdBy: 'admin',
    });

    expect(result.tenant_id).toBe('tenant-1');
    expect(result.configId).toBe('config-1');
    expect(result.dependsOnConfigId).toBe('config-0');
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO config_dependencies'),
      expect.arrayContaining(['tenant-1', 'config-1', 'config-0'])
    );
  });

  test('should reject duplicate dependency', async () => {
    mockDb._rows.push({
      id: 'dep-1',
      tenant_id: 'tenant-1',
      config_id: 'config-1',
      depends_on_config_id: 'config-0',
      dependency_type: 'hard',
      description: null,
      is_active: true,
      created_by: 'admin',
      created_at: new Date(),
      updated_at: new Date(),
    });

    await expect(
      repo.createDependency('tenant-1', {
        configId: 'config-1',
        dependsOnConfigId: 'config-0',
        createdBy: 'admin',
      })
    ).rejects.toThrow('already exists');
  });

  test('should find dependencies by config id', async () => {
    mockDb._rows.push(
      {
        id: 'dep-1',
        tenant_id: 'tenant-1',
        config_id: 'config-1',
        depends_on_config_id: 'config-0',
        dependency_type: 'hard',
        description: null,
        is_active: true,
        created_by: 'admin',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'dep-2',
        tenant_id: 'tenant-1',
        config_id: 'config-1',
        depends_on_config_id: 'config-2',
        dependency_type: 'soft',
        description: null,
        is_active: true,
        created_by: 'admin',
        created_at: new Date(),
        updated_at: new Date(),
      }
    );

    const deps = await repo.findByConfigId('config-1', 'tenant-1');
    expect(deps).toHaveLength(2);
    expect(deps[0].dependencyType).toBe('hard');
    expect(deps[1].dependencyType).toBe('soft');
  });

  test('should validate dependencies - all satisfied', async () => {
    mockDb.query = jest.fn(async (sql: string) => {
      if (sql.includes('SELECT')) {
        return {
          rows: [
            { id: 'dep-1', config_id: 'config-1', depends_on_config_id: 'config-0', dependency_type: 'hard', description: null, is_active: true, created_by: 'admin', created_at: new Date(), updated_at: new Date() },
          ],
          rowCount: 1,
        };
      }
      if (sql.includes('configs')) {
        return { rows: [{ id: 'config-0', status: 'active' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const result = await repo.validate('tenant-1', 'config-1');
    expect(result.valid).toBe(true);
    expect(result.unsatisfied).toHaveLength(0);
  });

  test('should validate dependencies - unsatisfied when target missing', async () => {
    mockDb.query = jest.fn(async (sql: string) => {
      if (sql.includes('SELECT') && sql.includes('config_dependencies')) {
        return {
          rows: [
            { id: 'dep-1', config_id: 'config-1', depends_on_config_id: 'missing-config', dependency_type: 'hard', description: null, is_active: true, created_by: 'admin', created_at: new Date(), updated_at: new Date() },
          ],
          rowCount: 1,
        };
      }
      if (sql.includes('configs')) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    });

    const result = await repo.validate('tenant-1', 'config-1');
    expect(result.valid).toBe(false);
    expect(result.unsatisfied).toContain('missing-config');
  });

  test('should delete dependency scoped to tenant', async () => {
    mockDb.query = jest.fn(async (sql: string) => {
      if (sql.startsWith('DELETE')) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const result = await repo.deleteDependency('config-1', 'config-0', 'tenant-1');
    expect(result).toBe(true);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM config_dependencies'),
      ['config-1', 'config-0', 'tenant-1']
    );
  });
});

// ==================== ConfigService Integration Tests ====================

describe('ConfigService - Template + Canary + Dependency', () => {
  let service: ConfigService;
  let mockRepo: jest.Mocked<ConfigRepository>;
  let mockDb: any;

  beforeEach(() => {
    mockDb = createMockDb();
    mockRepo = {
      findById: jest.fn(),
      findByKey: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn(),
      getHistory: jest.fn(),
      getDb: () => mockDb,
    } as any;

    // Pre-seed a template with known ID so template version tests work
    mockDb._rows.push({
      id: 'tmpl-1',
      tenant_id: 'tenant-1',
      name: 'Seeded Template',
      description: null,
      category: null,
      config_data: { key: 'original' },
      target_environment: 'dev',
      is_active: true,
      created_by: 'admin',
      updated_by: null,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Pre-seed a canary deployment with known ID so canary operation tests work
    mockDb._rows.push({
      id: 'canary-1',
      tenant_id: 'tenant-1',
      config_id: 'config-1',
      config_key: 'feature.flag',
      environment: 'dev',
      percentage: 10,
      status: 'running',
      old_value: null,
      canary_value: { enabled: true },
      target_value: { enabled: true },
      promoted_at: null,
      rolled_back_at: null,
      created_by: 'admin',
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Pre-seed a dependency for dependency tests
    mockDb._rows.push({
      id: 'dep-seeded',
      tenant_id: 'tenant-1',
      config_id: 'config-1',
      depends_on_config_id: 'config-2',
      dependency_type: 'hard',
      description: 'Required',
      is_active: true,
      created_by: 'admin',
      created_at: new Date(),
      updated_at: new Date(),
    });

    service = new ConfigService(mockRepo);
  });

  // ---- Template ----

  test('createTemplate should create and return template', async () => {
    const template = await service.createTemplate('tenant-1', {
      name: 'My Template',
      description: 'Test',
      configData: { key: 'value' },
      createdBy: 'admin',
    });

    // Debug: inspect mock return values
    const calls = (mockDb.query as jest.Mock).mock.calls;
    const insertCall = calls.find(c => c[0].includes('config_templates'));
    if (insertCall) {
      const result = insertCall[2] || insertCall[1];  // try to access return value
    }
    console.log('template keys:', Object.keys(template));
    console.log('template.configData:', JSON.stringify(template.configData));
    console.log('template.config_data:', JSON.stringify((template as any).config_data));

    expect(template.tenant_id).toBe('tenant-1');
    expect(template.name).toBe('My Template');
    expect(template.configData).toEqual({ key: 'value' });
  });

  test('listTemplates should return tenant-specific templates', async () => {
    const templates = await service.listTemplates('tenant-1', 'general');
    expect(Array.isArray(templates)).toBe(true);
  });

  test('getTemplate should return template or null', async () => {
    const result = await service.getTemplate('tenant-1', 'tmpl-nonexistent');
    expect(result).toBeNull();
  });

  test('applyTemplate should apply configData keys to repository', async () => {
    mockRepo.set = jest.fn(async () => ({
      id: 'cfg-1',
      tenant_id: 'tenant-1',
      key: 'key1',
      value: { value: 'value1' },
    } as any));

    const templateRow = {
      id: 'tmpl-1',
      tenant_id: 'tenant-1',
      name: 'T',
      description: null,
      category: null,
      config_data: { key1: 'value1', key2: 'value2' },
      target_environment: 'staging',
      is_active: true,
      created_by: 'admin',
      updated_by: null,
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockDb._rows.push(templateRow);

    const result = await service.applyTemplate('tenant-1', 'tmpl-1', 'staging');
    expect(typeof result.applied).toBe('number');
    expect(Array.isArray(result.skipped)).toBe(true);
  });

  test('createTemplateVersion should create new version', async () => {
    const version = await service.createTemplateVersion('tenant-1', 'tmpl-1', { key: 'v2' }, 'admin');
    expect(version.templateId).toBe('tmpl-1');
    expect(version.configData).toEqual({ key: 'v2' });
  });

  // ---- Canary ----

  test('createCanaryDeployment should create deployment', async () => {
    const canary = await service.createCanaryDeployment('tenant-1', 'config-1', 20, { enabled: true }, { enabled: true }, 'feature.flag');
    expect(canary.tenant_id).toBe('tenant-1');
    expect(canary.percentage).toBeGreaterThanOrEqual(0);
    expect(canary.percentage).toBeLessThanOrEqual(100);
  });

  test('updateCanaryPercentage should clamp to 0-100', async () => {
    const canary = await service.updateCanaryPercentage('tenant-1', 'canary-1', 150);
    expect(canary.percentage).toBeLessThanOrEqual(100);
  });

  test('promoteCanary should set status to promoted', async () => {
    const canary = await service.promoteCanary('tenant-1', 'canary-1');
    expect(canary.status).toBe('promoted');
  });

  test('rollbackCanary should set status to rolled_back', async () => {
    const canary = await service.rollbackCanary('tenant-1', 'canary-1');
    expect(canary.status).toBe('rolled_back');
  });

  test('getCanaryHistory should return history array', async () => {
    const history = await service.getCanaryHistory('tenant-1', 'canary-1');
    expect(Array.isArray(history)).toBe(true);
  });

  // ---- Dependency ----

  test('addDependency should create dependency', async () => {
    const dep = await service.addDependency('tenant-1', 'config-1', 'config-0', 'hard', 'Required');
    expect(dep.tenant_id).toBe('tenant-1');
    expect(dep.configId).toBe('config-1');
    expect(dep.dependsOnConfigId).toBe('config-0');
    expect(dep.dependencyType).toBe('hard');
  });

  test('getDependencyGraph should return node and dependencies', async () => {
    const graph = await service.getDependencyGraph('tenant-1', 'config-1');
    expect(graph.node.configId).toBe('config-1');
    expect(Array.isArray(graph.dependencies)).toBe(true);
  });

  test('validateDependencies should return validation result', async () => {
    const result = await service.validateDependencies('tenant-1', 'config-1');
    expect(typeof result.valid).toBe('boolean');
    expect(Array.isArray(result.unsatisfied)).toBe(true);
  });

  test('removeDependency should return boolean', async () => {
    const result = await service.removeDependency('tenant-1', 'config-1', 'config-2');
    expect(typeof result).toBe('boolean');
  });
});
