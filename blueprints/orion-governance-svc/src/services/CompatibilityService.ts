import { Pool } from 'pg';
import type {
  CompatibilityResult,
  BreakingChange,
} from '../types/governance.js';

interface SchemaField {
  type: string;
  required?: boolean;
  properties?: Record<string, SchemaField>;
  items?: SchemaField;
}

export class CompatibilityService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async check(sourceContractId: string, targetContractId: string): Promise<CompatibilityResult> {
    const source = await this.fetchContract(sourceContractId);
    const target = await this.fetchContract(targetContractId);

    if (!source) {
      throw new Error(`Source contract ${sourceContractId} not found`);
    }
    if (!target) {
      throw new Error(`Target contract ${targetContractId} not found`);
    }

    if (source.apiName !== target.apiName) {
      return {
        compatible: true,
        breakingChanges: [],
        warnings: [
          `Contracts belong to different APIs: "${source.apiName}" vs "${target.apiName}". No compatibility comparison needed.`,
        ],
        recommendation: 'These contracts manage different APIs and do not require compatibility checks.',
      };
    }

    const breakingChanges: BreakingChange[] = [];
    const warnings: string[] = [];

    if (source.endpoint !== target.endpoint) {
      breakingChanges.push({
        field: 'endpoint',
        type: 'changed_type',
        description: `Endpoint changed from "${source.endpoint}" to "${target.endpoint}"`,
        severity: 'critical',
      });
    }

    if (source.method !== target.method) {
      breakingChanges.push({
        field: 'method',
        type: 'changed_type',
        description: `HTTP method changed from "${source.method}" to "${target.method}"`,
        severity: 'critical',
      });
    }

    if (source.authentication !== target.authentication) {
      breakingChanges.push({
        field: 'authentication',
        type: 'changed_authentication',
        description: `Authentication changed from "${source.authentication}" to "${target.authentication}"`,
        severity: 'major',
      });
    }

    if (source.rateLimit !== target.rateLimit) {
      warnings.push(
        `Rate limit changed from ${source.rateLimit ?? 'unlimited'} to ${target.rateLimit ?? 'unlimited'}`,
      );
    }

    const schemaChanges = this.compareSchemas(
      (source.schema as Record<string, SchemaField>) ?? {},
      (target.schema as Record<string, SchemaField>) ?? {},
    );
    breakingChanges.push(...schemaChanges.breaking);
    warnings.push(...schemaChanges.warnings);

    const hasCritical = breakingChanges.some((bc) => bc.severity === 'critical');
    const compatible = breakingChanges.length === 0;

    let recommendation = '';
    if (compatible) {
      recommendation = warnings.length > 0
        ? 'Backward compatible, but review the warnings before deploying.'
        : 'Fully backward compatible. Safe to deploy.';
    } else if (hasCritical) {
      recommendation = 'Critical breaking changes detected. Requires major version bump and migration plan.';
    } else {
      recommendation = 'Breaking changes detected. Requires minor version bump and client notification.';
    }

    return { compatible, breakingChanges, warnings, recommendation };
  }

  private async fetchContract(id: string): Promise<Record<string, unknown> | null> {
    const result = await this.pool.query('SELECT * FROM api_contracts WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0] as Record<string, unknown>;
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string,
      apiName: row.api_name as string,
      version: row.version as string,
      status: row.status as string,
      schema: (row.schema as Record<string, unknown>) ?? {},
      endpoint: row.endpoint as string,
      method: row.method as string,
      authentication: row.authentication as string,
      rateLimit: row.rate_limit as number | undefined,
      tags: row.tags as string[],
    };
  }

  private compareSchemas(
    source: Record<string, SchemaField>,
    target: Record<string, SchemaField>,
  ): { breaking: BreakingChange[]; warnings: string[] } {
    const breaking: BreakingChange[] = [];
    const warnings: string[] = [];

    for (const [key, value] of Object.entries(source)) {
      if (!(key in target)) {
        breaking.push({
          field: `schema.${key}`,
          type: 'removed_field',
          description: `Field "${key}" was removed`,
          severity: value.required ? 'critical' : 'major',
        });
      }
    }

    for (const [key, targetValue] of Object.entries(target)) {
      if (!(key in source)) {
        if (targetValue.required) {
          breaking.push({
            field: `schema.${key}`,
            type: 'added_required_field',
            description: `New required field "${key}" was added`,
            severity: 'major',
          });
        } else {
          warnings.push(`New optional field "${key}" was added`);
        }
      } else {
        const sourceValue = source[key];
        if (sourceValue.type !== targetValue.type) {
          breaking.push({
            field: `schema.${key}`,
            type: 'changed_type',
            description: `Field "${key}" type changed from "${sourceValue.type}" to "${targetValue.type}"`,
            severity: 'critical',
          });
        }
        if (!sourceValue.required && targetValue.required) {
          breaking.push({
            field: `schema.${key}`,
            type: 'added_required_field',
            description: `Field "${key}" became required`,
            severity: 'major',
          });
        }
        if (sourceValue.properties && targetValue.properties) {
          const nested = this.compareSchemas(sourceValue.properties, targetValue.properties);
          breaking.push(...nested.breaking);
          warnings.push(...nested.warnings);
        }
      }
    }

    return { breaking, warnings };
  }
}
