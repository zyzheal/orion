/**
 * NatsRegistry Repository
 *
 * PostgreSQL persistence for NATS service registry and discovery.
 */
import { BaseRepository } from '../db/base-repository';

// ==================== Service Instance ====================

export interface ServiceInstanceEntity {
  id: string;
  name: string;
  host: string;
  port: number;
  health_url: string | null;
  metadata: Record<string, any> | null;
  registered_at: Date;
  last_heartbeat: Date;
  status: string;
}

export class ServiceInstanceRepository extends BaseRepository<ServiceInstanceEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'service_instances');
  }

  async findByName(name: string): Promise<ServiceInstanceEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM service_instances WHERE name = $1 ORDER BY registered_at DESC`,
      [name],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByStatus(status: string): Promise<ServiceInstanceEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM service_instances WHERE status = $1 ORDER BY last_heartbeat DESC`,
      [status],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findHealthyByName(name: string): Promise<ServiceInstanceEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM service_instances WHERE name = $1 AND status = 'healthy' ORDER BY last_heartbeat DESC`,
      [name],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateHeartbeat(id: string): Promise<ServiceInstanceEntity | undefined> {
    const result = await this.db.query(
      `UPDATE service_instances SET last_heartbeat = NOW(), status = 'healthy', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async markUnhealthy(id: string): Promise<ServiceInstanceEntity | undefined> {
    const result = await this.db.query(
      `UPDATE service_instances SET status = 'unhealthy', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM service_instances WHERE id = $1`,
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  protected mapRowToEntity(row: any): ServiceInstanceEntity {
    return {
      id: row.id,
      name: row.name,
      host: row.host,
      port: row.port,
      health_url: row.health_url,
      metadata: row.metadata,
      registered_at: row.registered_at,
      last_heartbeat: row.last_heartbeat,
      status: row.status ?? 'unknown',
    };
  }
}
