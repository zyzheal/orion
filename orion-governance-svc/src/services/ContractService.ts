import { Pool, type QueryResultRow } from 'pg';
import type {
  ApiContract,
  CreateContractInput,
  UpdateContractInput,
  PaginationParams,
  PaginatedResult,
  ContractStatus,
  HttpMethod,
  AuthType,
  ContractValidationResult,
} from '../types/governance.js';

export class ContractService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async create(input: CreateContractInput): Promise<ApiContract> {
    const result = await this.pool.query(
      `INSERT INTO api_contracts
        (name, description, api_name, version, schema, endpoint, method, authentication, rate_limit, tags, owner_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        input.name,
        input.description,
        input.apiName,
        input.version,
        JSON.stringify(input.schema),
        input.endpoint,
        input.method,
        input.authentication,
        input.rateLimit || null,
        input.tags,
        input.ownerId,
      ],
    );
    return this.rowToContract(result.rows[0]);
  }

  async findById(id: string): Promise<ApiContract | null> {
    const result = await this.pool.query('SELECT * FROM api_contracts WHERE id = $1', [id]);
    return result.rows.length > 0 ? this.rowToContract(result.rows[0]) : null;
  }

  async findByApiName(apiName: string): Promise<ApiContract[]> {
    const result = await this.pool.query(
      'SELECT * FROM api_contracts WHERE api_name = $1 ORDER BY created_at DESC',
      [apiName],
    );
    return result.rows.map((row) => this.rowToContract(row));
  }

  async findAll(params: PaginationParams, filters?: { status?: ContractStatus; ownerId?: string }): Promise<PaginatedResult<ApiContract>> {
    const offset = (params.page - 1) * params.limit;
    const whereClauses: string[] = [];
    const queryParams: unknown[] = [];
    let paramIndex = 1;

    if (filters?.status) {
      whereClauses.push(`status = $${paramIndex}`);
      queryParams.push(filters.status);
      paramIndex++;
    }
    if (filters?.ownerId) {
      whereClauses.push(`owner_id = $${paramIndex}`);
      queryParams.push(filters.ownerId);
      paramIndex++;
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countResult = await this.pool.query(
      `SELECT COUNT(*) as total FROM api_contracts ${whereSql}`,
      queryParams,
    );
    const total = Number.parseInt(countResult.rows[0].total, 10);

    const dataResult = await this.pool.query(
      `SELECT * FROM api_contracts ${whereSql} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, params.limit, offset],
    );

    return {
      data: dataResult.rows.map((row) => this.rowToContract(row)),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async update(id: string, input: UpdateContractInput): Promise<ApiContract | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) {
        if (key === 'schema') {
          fields.push(`${key} = $${paramIndex}`);
          values.push(JSON.stringify(value));
        } else {
          fields.push(`${this.camelToSnake(key)} = $${paramIndex}`);
          values.push(value);
        }
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push('updated_at = NOW()');
    values.push(id);

    const result = await this.pool.query(
      `UPDATE api_contracts SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );
    return result.rows.length > 0 ? this.rowToContract(result.rows[0]) : null;
  }

  async updateStatus(id: string, status: ContractStatus): Promise<ApiContract | null> {
    const result = await this.pool.query(
      `UPDATE api_contracts SET status = $1, deprecated_at = CASE WHEN $1 = 'deprecated' THEN NOW() ELSE NULL END, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id],
    );
    return result.rows.length > 0 ? this.rowToContract(result.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM api_contracts WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async validate(id: string): Promise<ContractValidationResult> {
    const contract = await this.findById(id);
    const errors: ContractValidationResult['errors'] = [];
    const warnings: ContractValidationResult['warnings'] = [];

    if (!contract) {
      return { valid: false, errors: [{ field: 'id', message: 'Contract not found', code: 'NOT_FOUND' }], warnings: [] };
    }

    if (!contract.name || contract.name.length < 3) {
      errors.push({ field: 'name', message: 'Contract name must be at least 3 characters', code: 'NAME_TOO_SHORT' });
    }

    if (!contract.endpoint || !contract.endpoint.startsWith('/')) {
      errors.push({ field: 'endpoint', message: 'Endpoint must start with /', code: 'INVALID_ENDPOINT' });
    }

    const validMethods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
    if (!validMethods.includes(contract.method)) {
      errors.push({ field: 'method', message: `Invalid HTTP method: ${contract.method}`, code: 'INVALID_METHOD' });
    }

    if (contract.schema && typeof contract.schema !== 'object') {
      errors.push({ field: 'schema', message: 'Schema must be a valid JSON object', code: 'INVALID_SCHEMA' });
    }

    const validAuth: AuthType[] = ['none', 'api_key', 'oauth2', 'jwt', 'mtls'];
    if (!validAuth.includes(contract.authentication)) {
      errors.push({ field: 'authentication', message: `Invalid auth type: ${contract.authentication}`, code: 'INVALID_AUTH' });
    }

    if (contract.tags.length === 0) {
      warnings.push({ field: 'tags', message: 'No tags specified. Consider adding tags for better organization.' });
    }

    if (!contract.description) {
      warnings.push({ field: 'description', message: 'No description provided.' });
    }

    if (contract.status === 'draft' && contract.authentication === 'none') {
      warnings.push({ field: 'authentication', message: 'Contract has no authentication. Consider adding authentication for production APIs.' });
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  private rowToContract(row: QueryResultRow): ApiContract {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      name: r.name as string,
      description: r.description as string,
      apiName: r.api_name as string,
      version: r.version as string,
      status: r.status as ContractStatus,
      schema: (r.schema as Record<string, unknown>) ?? {},
      endpoint: r.endpoint as string,
      method: r.method as HttpMethod,
      authentication: r.authentication as AuthType,
      rateLimit: (r.rate_limit as number) ?? undefined,
      tags: (r.tags as string[]) ?? [],
      ownerId: r.owner_id as string,
      createdAt: (r.created_at as Date).toISOString(),
      updatedAt: (r.updated_at as Date).toISOString(),
      deprecatedAt: r.deprecated_at ? (r.deprecated_at as Date).toISOString() : undefined,
    };
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }
}
