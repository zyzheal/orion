import { BaseRepository } from '../db/base-repository';

export interface ChatOpsCommandHandlerEntity {
  id: string;
  tenantId: string | null;
  commandName: string;
  handlerType: string;
  serviceName: string | null;
  methodName: string | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class ChatOpsCommandHandlerRepository extends BaseRepository<ChatOpsCommandHandlerEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'chatops_command_handlers');
  }

  async findByCommandName(commandName: string, tenantId?: string): Promise<ChatOpsCommandHandlerEntity | undefined> {
    let query = `SELECT * FROM chatops_command_handlers WHERE command_name = $1`;
    const params: unknown[] = [commandName];
    if (tenantId) {
      query += ` AND (tenant_id = $2 OR tenant_id IS NULL)`;
      params.push(tenantId);
    }
    query += ` LIMIT 1`;
    const result = await this.db.query(query, params);
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findEnabled(tenantId?: string): Promise<ChatOpsCommandHandlerEntity[]> {
    let query = `SELECT * FROM chatops_command_handlers WHERE enabled = true`;
    const params: unknown[] = [];
    if (tenantId) {
      query += ` AND (tenant_id = $1 OR tenant_id IS NULL)`;
      params.push(tenantId);
    }
    query += ` ORDER BY command_name ASC`;
    const result = await this.db.query(query, params);
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async upsertByCommandName(
    commandName: string,
    data: { handlerType: string; serviceName?: string; methodName?: string; tenantId?: string },
  ): Promise<ChatOpsCommandHandlerEntity> {
    const result = await this.db.query(
      `INSERT INTO chatops_command_handlers (id, tenant_id, command_name, handler_type, service_name, method_name)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5)
       ON CONFLICT (command_name, tenant_id) DO UPDATE SET
         handler_type = EXCLUDED.handler_type,
         service_name = EXCLUDED.service_name,
         method_name = EXCLUDED.method_name,
         updated_at = NOW()
       RETURNING *`,
      [data.tenantId ?? null, commandName, data.handlerType, data.serviceName ?? null, data.methodName ?? null],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async disableByCommandName(commandName: string, tenantId?: string): Promise<void> {
    let query = `UPDATE chatops_command_handlers SET enabled = false, updated_at = NOW() WHERE command_name = $1`;
    const params: unknown[] = [commandName];
    if (tenantId) {
      query += ` AND (tenant_id = $2 OR tenant_id IS NULL)`;
      params.push(tenantId);
    }
    await this.db.query(query, params);
  }

  protected mapRowToEntity(row: any): ChatOpsCommandHandlerEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      commandName: row.command_name,
      handlerType: row.handler_type,
      serviceName: row.service_name,
      methodName: row.method_name,
      enabled: row.enabled,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
