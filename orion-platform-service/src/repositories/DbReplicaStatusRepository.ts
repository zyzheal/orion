import { BaseRepository } from '../db/base-repository';

export interface DbReplicaStatusEntity {
  id: string;
  host: string;
  port: number;
  ioRunning: boolean;
  sqlRunning: boolean;
  secondsBehindMaster: number;
  lastError: string | null;
  lastIoError: string | null;
  lastSqlError: string | null;
  relayMasterLogFile: string;
  execMasterLogPos: number;
  readMasterLogPos: number;
  retrievedGtidSet: string | null;
  executedGtidSet: string | null;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class DbReplicaStatusRepository extends BaseRepository<DbReplicaStatusEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'db_replica_statuses');
  }

  async findByHost(host: string, port: number, tenantId?: string): Promise<DbReplicaStatusEntity | undefined> {
    let query = `SELECT * FROM db_replica_statuses WHERE host = $1 AND port = $2`;
    const params: any[] = [host, port];
    if (tenantId) {
      query += ` AND tenant_id = $3`;
      params.push(tenantId);
    }
    const result = await this.db.query(query, params);
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findAllReplicas(tenantId?: string): Promise<DbReplicaStatusEntity[]> {
    let query = `SELECT * FROM db_replica_statuses WHERE 1=1`;
    const params: any[] = [];
    if (tenantId) {
      query += ` AND tenant_id = $1`;
      params.push(tenantId);
    }
    query += ` ORDER BY host, port`;
    const result = await this.db.query(query, params);
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async upsertStatus(data: {
    host: string;
    port: number;
    ioRunning: boolean;
    sqlRunning: boolean;
    secondsBehindMaster: number;
    lastError?: string;
    lastIoError?: string;
    lastSqlError?: string;
    relayMasterLogFile: string;
    execMasterLogPos: number;
    readMasterLogPos: number;
    retrievedGtidSet?: string;
    executedGtidSet?: string;
    tenantId?: string;
  }): Promise<DbReplicaStatusEntity | null> {
    const existing = await this.findByHost(data.host, data.port, data.tenantId);
    if (existing) {
      return this.update(existing.id, {
        io_running: data.ioRunning,
        sql_running: data.sqlRunning,
        seconds_behind_master: data.secondsBehindMaster,
        last_error: data.lastError || null,
        last_io_error: data.lastIoError || null,
        last_sql_error: data.lastSqlError || null,
        relay_master_log_file: data.relayMasterLogFile,
        exec_master_log_pos: data.execMasterLogPos,
        read_master_log_pos: data.readMasterLogPos,
        retrieved_gtid_set: data.retrievedGtidSet || null,
        executed_gtid_set: data.executedGtidSet || null,
        updated_at: new Date(),
      });
    }
    return this.create({
      id: `rs-${data.host}-${data.port}-${Date.now()}`,
      host: data.host,
      port: data.port,
      io_running: data.ioRunning,
      sql_running: data.sqlRunning,
      seconds_behind_master: data.secondsBehindMaster,
      last_error: data.lastError || null,
      last_io_error: data.lastIoError || null,
      last_sql_error: data.lastSqlError || null,
      relay_master_log_file: data.relayMasterLogFile,
      exec_master_log_pos: data.execMasterLogPos,
      read_master_log_pos: data.readMasterLogPos,
      retrieved_gtid_set: data.retrievedGtidSet || null,
      executed_gtid_set: data.executedGtidSet || null,
      tenant_id: data.tenantId || null,
    });
  }

  async deleteAll(): Promise<void> {
    await this.db.query(`DELETE FROM db_replica_statuses`);
  }

  protected mapRowToEntity(row: any): DbReplicaStatusEntity {
    return {
      id: row.id,
      host: row.host,
      port: parseInt(row.port, 10),
      ioRunning: row.io_running,
      sqlRunning: row.sql_running,
      secondsBehindMaster: parseInt(row.seconds_behind_master, 10),
      lastError: row.last_error,
      lastIoError: row.last_io_error,
      lastSqlError: row.last_sql_error,
      relayMasterLogFile: row.relay_master_log_file,
      execMasterLogPos: parseInt(row.exec_master_log_pos, 10),
      readMasterLogPos: parseInt(row.read_master_log_pos, 10),
      retrievedGtidSet: row.retrieved_gtid_set,
      executedGtidSet: row.executed_gtid_set,
      tenantId: row.tenant_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
