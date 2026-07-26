/**
 * Shared PostgreSQL connection pool for orion-dba-svc
 */

export interface IDbAdapter {
  query(text: string, params?: unknown[]): Promise<{ rows: any[]; rowCount: number | null }>;
  connect(): Promise<void>;
  close(): Promise<void>;
}

export class DatabasePool implements IDbAdapter {
  private pool: import('pg').Pool;

  constructor(config: import('pg').PoolConfig) {
    this.pool = new (require('pg').Pool)(config);
  }

  async connect(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  async query(text: string, params?: unknown[]): Promise<{ rows: any[]; rowCount: number | null }> {
    return this.pool.query(text, params);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
