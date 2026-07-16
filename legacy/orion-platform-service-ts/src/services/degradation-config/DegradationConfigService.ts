import { createLogger } from '../../utils/logger';
const logger = createLogger('DegradationConfigService');
import { DatabasePool } from '../database';
/**
 * DegradationConfigService - Business logic for AI Degradation Dynamic Configuration
 *
 * Implements dynamic degradation strategy configuration including:
 * - Runtime configuration updates without code changes
 * - Scenario-based degradation strategies
 * - Configuration import/export
 * - Audit logging for configuration changes
 *
 * Phase 2 P0 Service
 */

// ==================== Types ====================

export interface DegradationStrategy {
  strategy: 'rule-engine' | 'template' | 'cache' | 'manual' | 'default';
  fallback_strategies: string[];
}

export interface DegradationConfig {
  id: string;
  tenant_id: string | null;
  scenario: string;
  strategy: string;
  fallback_strategies: string[];
  rule_set: Record<string, unknown>;
  template_name: string | null;
  cache_ttl: number;
  notify_on_degradation: boolean;
  default_response: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface UpdateConfigInput {
  tenant_id?: string;
  scenario: string;
  strategy?: 'rule-engine' | 'template' | 'cache' | 'manual' | 'default';
  fallback_strategies?: string[];
  rule_set?: Record<string, unknown>;
  template_name?: string;
  cache_ttl?: number;
  notify_on_degradation?: boolean;
  default_response?: Record<string, unknown>;
}

export interface ConfigAuditLog {
  id: string;
  scenario: string;
  action: 'create' | 'update' | 'delete' | 'import' | 'export';
  old_config: Record<string, unknown> | null;
  new_config: Record<string, unknown> | null;
  created_by: string | null;
  created_at: Date;
}

export class DegradationConfigServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'DegradationConfigServiceError';
  }
}

// Default configurations for known scenarios
const DEFAULT_CONFIGS: UpdateConfigInput[] = [
  {
    scenario: 'risk-assessment',
    strategy: 'rule-engine',
    fallback_strategies: ['template', 'cache', 'default'],
    rule_set: {
      conditions: [
        { field: 'commit_size', operator: 'gt', value: 500, result: 'high-risk' },
        { field: 'test_coverage', operator: 'lt', value: 0.5, result: 'medium-risk' },
      ],
    },
    template_name: 'risk-assessment-default',
    cache_ttl: 300,
    notify_on_degradation: true,
    default_response: { risk_level: 'medium', confidence: 0.5 },
  },
  {
    scenario: 'test-selection',
    strategy: 'rule-engine',
    fallback_strategies: ['template', 'default'],
    rule_set: {
      conditions: [
        { field: 'change_type', operator: 'eq', value: 'test', result: 'run-all' },
        { field: 'change_type', operator: 'eq', value: 'docs', result: 'skip' },
      ],
    },
    template_name: 'test-selection-default',
    cache_ttl: 600,
    notify_on_degradation: true,
    default_response: { tests: 'all', reason: 'default-selection' },
  },
  {
    scenario: 'code-review',
    strategy: 'rule-engine',
    fallback_strategies: ['template', 'cache', 'manual'],
    rule_set: {
      conditions: [
        { field: 'language', operator: 'eq', value: 'typescript', template: 'ts-review' },
        { field: 'language', operator: 'eq', value: 'go', template: 'go-review' },
      ],
    },
    template_name: 'code-review-default',
    cache_ttl: 300,
    notify_on_degradation: true,
    default_response: { verdict: 'neutral', summary: 'Default review template' },
  },
];

// ==================== Repository ====================

export class DegradationConfigRepository {

  constructor(private pool: DatabasePool) {}

  async findByScenario(scenario: string): Promise<DegradationConfig | null> {
    const result = await this.pool.query(
      'SELECT * FROM degradation_configs WHERE scenario = $1',
      [scenario]
    );
    return result.rows[0] || null;
  }

  async listAll(): Promise<DegradationConfig[]> {
    const result = await this.pool.query(
      'SELECT * FROM degradation_configs ORDER BY scenario'
    );
    return result.rows;
  }

  async create(input: UpdateConfigInput): Promise<DegradationConfig> {
    const result = await this.pool.query(
      `INSERT INTO degradation_configs 
        (tenant_id, scenario, strategy, fallback_strategies, rule_set, template_name, cache_ttl, notify_on_degradation, default_response)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        input.tenant_id || null,
        input.scenario,
        input.strategy || 'rule-engine',
        input.fallback_strategies || [],
        JSON.stringify(input.rule_set || {}),
        input.template_name || null,
        input.cache_ttl || 300,
        input.notify_on_degradation ?? true,
        JSON.stringify(input.default_response || {}),
      ]
    );
    return result.rows[0];
  }

  async update(scenario: string, input: UpdateConfigInput): Promise<DegradationConfig | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.strategy) {
      fields.push(`strategy = $${paramIndex}`);
      values.push(input.strategy);
      paramIndex++;
    }
    if (input.fallback_strategies) {
      fields.push(`fallback_strategies = $${paramIndex}`);
      values.push(input.fallback_strategies);
      paramIndex++;
    }
    if (input.rule_set) {
      fields.push(`rule_set = $${paramIndex}`);
      values.push(JSON.stringify(input.rule_set));
      paramIndex++;
    }
    if (input.template_name) {
      fields.push(`template_name = $${paramIndex}`);
      values.push(input.template_name);
      paramIndex++;
    }
    if (input.cache_ttl) {
      fields.push(`cache_ttl = $${paramIndex}`);
      values.push(input.cache_ttl);
      paramIndex++;
    }
    if (input.notify_on_degradation !== undefined) {
      fields.push(`notify_on_degradation = $${paramIndex}`);
      values.push(input.notify_on_degradation);
      paramIndex++;
    }
    if (input.default_response) {
      fields.push(`default_response = $${paramIndex}`);
      values.push(JSON.stringify(input.default_response));
      paramIndex++;
    }

    if (fields.length === 0) return this.findByScenario(scenario);

    fields.push(`updated_at = now()`);
    values.push(scenario);

    const result = await this.pool.query(
      `UPDATE degradation_configs SET ${fields.join(', ')} WHERE scenario = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async delete(scenario: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM degradation_configs WHERE scenario = $1',
      [scenario]
    );
    return result.rowCount > 0;
  }

  async createAuditLog(
    scenario: string,
    action: string,
    oldConfig: Record<string, unknown> | null,
    newConfig: Record<string, unknown> | null,
    createdBy?: string
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO degradation_config_audit 
        (scenario, action, old_config, new_config, created_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [scenario, action, JSON.stringify(oldConfig), JSON.stringify(newConfig), createdBy || null]
    );
  }
}

// ==================== Service ====================

export class DegradationConfigService {
  private repository: DegradationConfigRepository;
  
  private initialized: boolean = false;

  constructor(private pool: DatabasePool) {
    this.repository = new DegradationConfigRepository(this.pool);
  }

  /**
   * Initialize default configurations
   */
  async initializeDefaults(): Promise<void> {
    if (this.initialized) return;

    for (const config of DEFAULT_CONFIGS) {
      try {
        const existing = await this.repository.findByScenario(config.scenario);
        if (!existing) {
          await this.repository.create(config);
        }
      } catch (err) {
        logger.error(`Failed to initialize config for ${config.scenario}:`, err);
      }
    }
    this.initialized = true;
  }

  /**
   * Get configuration for a scenario
   */
  async getConfig(scenario: string): Promise<DegradationConfig> {
    const config = await this.repository.findByScenario(scenario);
    if (!config) {
      throw new DegradationConfigServiceError(
        `Configuration not found for scenario: ${scenario}`,
        'CONFIG_NOT_FOUND'
      );
    }
    return config;
  }

  /**
   * Get all configurations
   */
  async listConfigs(): Promise<{ data: DegradationConfig[] }> {
    const configs = await this.repository.listAll();
    return { data: configs };
  }

  /**
   * Update configuration for a scenario
   */
  async updateConfig(
    scenario: string,
    input: UpdateConfigInput,
    userId?: string
  ): Promise<DegradationConfig> {
    const oldConfig = await this.repository.findByScenario(scenario);

    let newConfig: DegradationConfig | null;
    if (!oldConfig) {
      newConfig = await this.repository.create({ ...input, scenario });
    } else {
      newConfig = await this.repository.update(scenario, input);
    }

    if (!newConfig) {
      throw new DegradationConfigServiceError(
        'Failed to update configuration',
        'UPDATE_FAILED'
      );
    }

    // Create audit log
    await this.repository.createAuditLog(
      scenario,
      oldConfig ? 'update' : 'create',
      oldConfig ? { ...oldConfig } as Record<string, unknown> : null,
      { ...newConfig } as Record<string, unknown>,
      userId
    );

    return newConfig;
  }

  /**
   * Delete configuration for a scenario
   */
  async deleteConfig(scenario: string, userId?: string): Promise<{ success: boolean }> {
    const oldConfig = await this.repository.findByScenario(scenario);

    if (!oldConfig) {
      return { success: false };
    }

    const deleted = await this.repository.delete(scenario);

    if (deleted) {
      await this.repository.createAuditLog(
        scenario,
        'delete',
        { ...oldConfig } as Record<string, unknown>,
        null,
        userId
      );
    }

    return { success: deleted };
  }

  /**
   * Import configurations from JSON array
   */
  async importConfigs(
    configs: UpdateConfigInput[],
    userId?: string
  ): Promise<{ imported: number; failed: number; errors: string[] }> {
    let imported = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const config of configs) {
      try {
        if (!config.scenario) {
          errors.push('Missing scenario field');
          failed++;
          continue;
        }

        await this.updateConfig(config.scenario, config, userId);
        imported++;
      } catch (err) {
        errors.push(`${config.scenario}: ${(err as Error).message}`);
        failed++;
      }
    }

    // Create audit log for import action
    await this.pool.query(
      `INSERT INTO degradation_config_audit 
        (scenario, action, old_config, new_config, created_by)
       VALUES ('all', 'import', null, $1, $2)`,
      [JSON.stringify({ imported, failed }), userId || null]
    );

    return { imported, failed, errors };
  }

  /**
   * Export configurations as JSON
   */
  async exportConfigs(): Promise<{ configs: DegradationConfig[] }> {
    const configs = await this.repository.listAll();

    // Create audit log for export action
    await this.pool.query(
      `INSERT INTO degradation_config_audit 
        (scenario, action, old_config, new_config, created_by)
       VALUES ('all', 'export', null, $1, null)`,
      [JSON.stringify({ count: configs.length })]
    );

    return { configs };
  }

  /**
   * Get audit history
   */
  async getAuditHistory(
    scenario?: string,
    limit: number = 50
  ): Promise<ConfigAuditLog[]> {
    let query = 'SELECT * FROM degradation_config_audit';
    const params: any[] = [];

    if (scenario) {
      query += ' WHERE scenario = $1';
      params.push(scenario);
    }

    query += ` ORDER BY created_at DESC LIMIT ${limit}`;

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  /**
   * Validate configuration before update
   */
  async validateConfig(input: UpdateConfigInput): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Validate strategy
    const validStrategies = ['rule-engine', 'template', 'cache', 'manual', 'default'];
    if (input.strategy && !validStrategies.includes(input.strategy)) {
      errors.push(`Invalid strategy: ${input.strategy}`);
    }

    // Validate fallback strategies
    if (input.fallback_strategies) {
      for (const fallback of input.fallback_strategies) {
        if (!validStrategies.includes(fallback)) {
          errors.push(`Invalid fallback strategy: ${fallback}`);
        }
      }
    }

    // Validate cache_ttl
    if (input.cache_ttl && (input.cache_ttl < 0 || input.cache_ttl > 86400)) {
      errors.push('cache_ttl must be between 0 and 86400 seconds');
    }

    // Validate scenario name format
    if (input.scenario && !/^[a-z0-9-]+$/.test(input.scenario)) {
      errors.push('scenario must be lowercase alphanumeric with hyphens');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Get active degradation strategy for a scenario
   */
  async getActiveStrategy(scenario: string): Promise<{
    primary: string;
    fallbacks: string[];
    config: DegradationConfig;
  }> {
    const config = await this.getConfig(scenario);
    return {
      primary: config.strategy,
      fallbacks: config.fallback_strategies,
      config,
    };
  }
}