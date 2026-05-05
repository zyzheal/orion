export interface SchemaField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';
  required?: boolean;
  format?: string;
  enum?: string[];
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
}

export interface DataSchema {
  name: string;
  fields: SchemaField[];
}

export interface TransformConfig {
  mappings?: MappingRule[];
  filters?: FilterRule[];
  aggregations?: AggregationRule[];
}

export interface MappingRule {
  sourceField: string;
  targetField: string;
  transform?: string;
}

export interface FilterRule {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains' | 'regex';
  value: unknown;
}

export interface AggregationRule {
  field: string;
  operation: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct';
  groupBy?: string[];
}

export interface ProcessedRecord {
  data: Record<string, unknown>;
  schema: string;
  processedAt: string;
  errors: string[];
  warnings: string[];
}

/**
 * DataProcessor — in-memory data processing utilities for the data pipeline.
 */
export class DataProcessor {
  private processedRecords: ProcessedRecord[] = [];

  /**
   * Process a single record against a schema, applying validation.
   */
  processRecord(
    record: Record<string, unknown>,
    schema: DataSchema,
  ): ProcessedRecord {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate
    const validationErrors = this.validateSchemaInternal(record, schema);
    errors.push(...validationErrors.errors);
    warnings.push(...validationErrors.warnings);

    const processed: ProcessedRecord = {
      data: { ...record },
      schema: schema.name,
      processedAt: new Date().toISOString(),
      errors,
      warnings,
    };

    this.processedRecords.push(processed);
    return processed;
  }

  /**
   * Validate data against a schema definition.
   * Returns { valid: boolean, errors: string[], warnings: string[] }
   */
  validateSchema(
    data: Record<string, unknown>,
    schema: DataSchema,
  ): { valid: boolean; errors: string[]; warnings: string[] } {
    const result = this.validateSchemaInternal(data, schema);
    return { valid: result.errors.length === 0, ...result };
  }

  private validateSchemaInternal(
    data: Record<string, unknown>,
    schema: DataSchema,
  ): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const field of schema.fields) {
      const value = data[field.name];

      // Required check
      if (field.required && (value === undefined || value === null)) {
        errors.push(`Field '${field.name}' is required but missing`);
        continue;
      }

      // Skip further validation if optional and missing
      if (value === undefined || value === null) continue;

      // Type check
      const typeValid = this.checkType(value, field.type);
      if (!typeValid) {
        errors.push(
          `Field '${field.name}' expected type '${field.type}' but got '${typeof value}'`,
        );
        continue;
      }

      // Enum check
      if (field.enum && !field.enum.includes(String(value))) {
        errors.push(
          `Field '${field.name}' value '${value}' not in allowed values: ${field.enum.join(', ')}`,
        );
      }

      // String constraints
      if (field.type === 'string' && typeof value === 'string') {
        if (field.minLength !== undefined && value.length < field.minLength) {
          warnings.push(
            `Field '${field.name}' length ${value.length} below minimum ${field.minLength}`,
          );
        }
        if (field.maxLength !== undefined && value.length > field.maxLength) {
          errors.push(
            `Field '${field.name}' length ${value.length} exceeds maximum ${field.maxLength}`,
          );
        }
        if (field.pattern) {
          const regex = new RegExp(field.pattern);
          if (!regex.test(value)) {
            errors.push(
              `Field '${field.name}' value '${value}' does not match pattern '${field.pattern}'`,
            );
          }
        }
      }

      // Number constraints
      if (field.type === 'number' && typeof value === 'number') {
        if (field.minimum !== undefined && value < field.minimum) {
          errors.push(
            `Field '${field.name}' value ${value} below minimum ${field.minimum}`,
          );
        }
        if (field.maximum !== undefined && value > field.maximum) {
          errors.push(
            `Field '${field.name}' value ${value} exceeds maximum ${field.maximum}`,
          );
        }
      }
    }

    return { errors, warnings };
  }

  private checkType(value: unknown, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'date':
        return typeof value === 'string' && !isNaN(Date.parse(value));
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      default:
        return true;
    }
  }

  /**
   * Transform data according to a transform configuration.
   * Applies mappings, filters, and aggregations in order.
   */
  transform(
    data: Record<string, unknown>[],
    transformConfig: TransformConfig,
  ): Record<string, unknown>[] {
    let result = [...data];

    // Apply filters
    if (transformConfig.filters && transformConfig.filters.length > 0) {
      result = result.filter((record) =>
        transformConfig.filters!.every((filter) => this.applyFilter(record, filter)),
      );
    }

    // Apply mappings
    if (transformConfig.mappings && transformConfig.mappings.length > 0) {
      result = result.map((record) => this.applyMappings(record, transformConfig.mappings!));
    }

    // Apply aggregations
    if (transformConfig.aggregations && transformConfig.aggregations.length > 0) {
      result = this.applyAggregations(result, transformConfig.aggregations);
    }

    return result;
  }

  private applyFilter(record: Record<string, unknown>, rule: FilterRule): boolean {
    const value = record[rule.field];
    if (value === undefined) return false;

    switch (rule.operator) {
      case 'eq':
        return value === rule.value;
      case 'neq':
        return value !== rule.value;
      case 'gt':
        return (value as number) > (rule.value as number);
      case 'gte':
        return (value as number) >= (rule.value as number);
      case 'lt':
        return (value as number) < (rule.value as number);
      case 'lte':
        return (value as number) <= (rule.value as number);
      case 'in':
        return Array.isArray(rule.value) && (rule.value as unknown[]).includes(value);
      case 'contains':
        return typeof value === 'string' && value.includes(String(rule.value));
      case 'regex':
        return typeof value === 'string' && new RegExp(String(rule.value)).test(value);
      default:
        return true;
    }
  }

  private applyMappings(
    record: Record<string, unknown>,
    mappings: MappingRule[],
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    // Copy unmapped fields
    const mappedSources = new Set(mappings.map((m) => m.sourceField));
    for (const [key, value] of Object.entries(record)) {
      if (!mappedSources.has(key)) {
        result[key] = value;
      }
    }

    // Apply mappings
    for (const mapping of mappings) {
      let value = record[mapping.sourceField];
      if (mapping.transform && value !== undefined) {
        value = this.applyTransform(String(value), mapping.transform);
      }
      result[mapping.targetField] = value;
    }

    return result;
  }

  private applyTransform(value: string, transform: string): string | number {
    switch (transform) {
      case 'uppercase':
        return value.toUpperCase();
      case 'lowercase':
        return value.toLowerCase();
      case 'trim':
        return value.trim();
      case 'toInt':
        return parseInt(value, 10);
      case 'toFloat':
        return parseFloat(value);
      case 'toString':
        return String(value);
      default:
        return value;
    }
  }

  private applyAggregations(
    data: Record<string, unknown>[],
    rules: AggregationRule[],
  ): Record<string, unknown>[] {
    if (data.length === 0) return [];

    const result: Record<string, unknown>[] = [];

    // Group by if specified
    const groupBy = rules[0]?.groupBy;
    const groups = new Map<string, Record<string, unknown>[]>();

    if (groupBy && groupBy.length > 0) {
      for (const record of data) {
        const key = groupBy.map((f) => String(record[f] ?? 'null')).join('|');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(record);
      }
    } else {
      groups.set('all', data);
    }

    for (const [, groupRecords] of Array.from(groups.entries())) {
      const aggregated: Record<string, unknown> = {};

      // Add groupBy keys
      if (groupBy) {
        for (const key of groupBy) {
          aggregated[key] = groupRecords[0]?.[key];
        }
      }

      for (const rule of rules) {
        const values = groupRecords
          .map((r) => r[rule.field])
          .filter((v) => v !== undefined && v !== null) as number[];

        switch (rule.operation) {
          case 'sum':
            aggregated[rule.field] = values.reduce((a, b) => a + b, 0);
            break;
          case 'avg':
            aggregated[rule.field] =
              values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
            break;
          case 'count':
            aggregated[rule.field] = values.length;
            break;
          case 'min':
            aggregated[rule.field] = values.length > 0 ? Math.min(...values) : 0;
            break;
          case 'max':
            aggregated[rule.field] = values.length > 0 ? Math.max(...values) : 0;
            break;
          case 'distinct':
            aggregated[rule.field] = new Set(values).size;
            break;
        }
      }

      result.push(aggregated);
    }

    return result;
  }

  /**
   * Get all processed records (for debugging/inspection).
   */
  getProcessedRecords(): ProcessedRecord[] {
    return [...this.processedRecords];
  }

  /**
   * Clear processed records.
   */
  clear(): void {
    this.processedRecords = [];
  }
}
