import { FastifyRequest, FastifyReply } from 'fastify';
import { Pool } from 'pg';

export class ApiGovernanceController {
  constructor(private pool: Pool) {}

  async createContract(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as any;
    const result = await this.pool.query(
      'INSERT INTO api_contracts (name, version, description, schema, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [body.name, body.version, body.description, JSON.stringify(body.schema), body.status || 'draft']
    );
    return reply.status(201).send(result.rows[0]);
  }

  async listContracts(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as { status?: string; api_name?: string };
    let sql = 'SELECT * FROM api_contracts WHERE 1=1';
    const params: any[] = [];
    let idx = 1;
    if (query.status) { sql += ` AND status = $${idx++}`; params.push(query.status); }
    if (query.api_name) { sql += ` AND name = $${idx++}`; params.push(query.api_name); }
    sql += ' ORDER BY created_at DESC';
    const result = await this.pool.query(sql, params);
    return reply.send(result.rows);
  }

  async getContract(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { id: string };
    const result = await this.pool.query('SELECT * FROM api_contracts WHERE id = $1', [params.id]);
    if (result.rows.length === 0) return reply.status(404).send({ error: 'Contract not found' });
    return reply.send(result.rows[0]);
  }

  async updateContract(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { id: string };
    const body = request.body as any;
    const result = await this.pool.query(
      "UPDATE api_contracts SET name = COALESCE($1, name), version = COALESCE($2, version), description = COALESCE($3, description), schema = COALESCE($4::jsonb, schema), status = COALESCE($5, status), updated_at = NOW() WHERE id = $6 RETURNING *",
      [body.name, body.version, body.description, body.schema ? JSON.stringify(body.schema) : null, body.status, params.id]
    );
    if (result.rows.length === 0) return reply.status(404).send({ error: 'Contract not found' });
    return reply.send(result.rows[0]);
  }

  async deleteContract(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { id: string };
    const result = await this.pool.query('DELETE FROM api_contracts WHERE id = $1', [params.id]);
    if (result.rowCount === 0) return reply.status(404).send({ error: 'Contract not found' });
    return reply.status(204).send();
  }

  async createVersion(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as any;
    const result = await this.pool.query(
      'INSERT INTO api_versions (contract_id, version, changelog, schema) VALUES ($1, $2, $3, $4) RETURNING *',
      [body.contractId, body.version, body.changelog, JSON.stringify(body.schema)]
    );
    return reply.status(201).send(result.rows[0]);
  }

  async listVersions(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as { contract_id?: string };
    let sql = 'SELECT * FROM api_versions WHERE 1=1';
    const params: any[] = [];
    if (query.contract_id) {
      sql += ' AND contract_id = $1';
      params.push(query.contract_id);
    }
    sql += ' ORDER BY created_at DESC';
    const result = await this.pool.query(sql, params);
    return reply.send(result.rows);
  }

  async createDeprecation(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as any;
    const result = await this.pool.query(
      'INSERT INTO api_deprecations (contract_id, version, reason, deprecation_date, sunset_date) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [body.contractId, body.version, body.reason, body.deprecationDate, body.sunsetDate]
    );
    return reply.status(201).send(result.rows[0]);
  }

  async listDeprecations(_request: FastifyRequest, reply: FastifyReply) {
    const result = await this.pool.query('SELECT * FROM api_deprecations ORDER BY deprecation_date DESC');
    return reply.send(result.rows);
  }

  async checkCompatibility(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as any;
    // Simple compatibility check - compare schemas
    const oldSchema = body.oldSchema || {};
    const newSchema = body.newSchema || {};
    const breaking: string[] = [];
    const oldEndpoints = new Set(Object.keys(oldSchema));
    const newEndpoints = new Set(Object.keys(newSchema));

    for (const ep of oldEndpoints) {
      if (!newEndpoints.has(ep)) breaking.push(`Endpoint removed: ${ep}`);
    }
    for (const ep of newEndpoints) {
      if (!oldEndpoints.has(ep)) breaking.push(`Endpoint added: ${ep}`);
    }

    return reply.send({ compatible: breaking.length === 0, breakingChanges: breaking });
  }

  async validateContract(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { id: string };
    const result = await this.pool.query('SELECT * FROM api_contracts WHERE id = $1', [params.id]);
    if (result.rows.length === 0) return reply.status(404).send({ error: 'Contract not found' });
    const contract = result.rows[0];
    const schema = contract.schema;
    const valid = schema && typeof schema === 'object';
    return reply.send({ valid, contractId: params.id, errors: valid ? [] : ['Missing or invalid schema'] });
  }
}
