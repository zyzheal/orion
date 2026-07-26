/**
 * Database Service - PostgreSQL Connection Pool
 *
 * Provides a shared database connection pool for repositories.
 * This is the simplified version for the ChatOps service.
 */

import { EventEmitter } from 'events';
import * as pg from 'pg';

const { Pool } = pg;

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  poolSize?: number;
  connectionTimeout?: number;
  idleTimeout?: number;
}

export interface QueryResult {
  rows: any[];
  rowCount: number;
  fields: { name: string; dataTypeID: number }[];
}

export class DatabasePool extends EventEmitter {
  private config: DatabaseConfig;
  private pool: pg.Pool | null = null;
  private isConnected: boolean = false;
  private isInitializing: boolean = false;

  constructor(config: DatabaseConfig) {
    super();
    this.config = config;
  }

  async connect(): Promise<void> {
    if (this.isConnected || this.isInitializing) {
      return;
    }

    this.isInitializing = true;

    try {
      this.pool = new Pool({
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
        password: this.config.password,
        database: this.config.database,
        max: this.config.poolSize || 10,
        connectionTimeoutMillis: this.config.connectionTimeout || 5000,
        idleTimeoutMillis: this.config.idleTimeout || 10000,
      });

      this.pool.on('error', (err) => {
        console.error('Unexpected pool error:', err);
        this.emit('error', err);
      });

      const client = await this.pool.connect();
      try {
        await client.query('SELECT 1');
      } finally {
        client.release();
      }

      this.isConnected = true;
      this.emit('connect');
    } catch (error) {
      this.emit('error', error);
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  async getConnection(): Promise<pg.PoolClient> {
    if (!this.isConnected || !this.pool) {
      throw new Error('Database not connected');
    }
    return this.pool.connect();
  }

  async query(sql: string, params?: any[]): Promise<QueryResult> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    const result = await this.pool.query(sql, params);
    return {
      rows: result.rows,
      rowCount: result.rowCount ?? 0,
      fields: result.fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
    };
  }

  async transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    const client = await this.pool.connect();
    let transactionStarted = false;

    try {
      await client.query('BEGIN');
      transactionStarted = true;
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      if (transactionStarted) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          console.error('Transaction rollback failed:', rollbackError);
        }
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async checkHealth(): Promise<{ status: 'up' | 'down'; latency?: number; message?: string }> {
    const startTime = Date.now();

    try {
      if (!this.isConnected || !this.pool) {
        return { status: 'down', message: 'Not connected' };
      }

      await this.pool.query('SELECT 1');
      const latency = Date.now() - startTime;

      return { status: 'up', latency };
    } catch (error) {
      return {
        status: 'down',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async close(): Promise<void> {
    if (!this.pool) {
      return;
    }

    await this.pool.end();
    this.isConnected = false;
    this.emit('close');
  }

  isHealthy(): boolean {
    return this.isConnected;
  }

  getPoolSize(): number {
    return this.pool?.totalCount ?? 0;
  }

  getIdleCount(): number {
    return this.pool?.idleCount ?? 0;
  }
}
