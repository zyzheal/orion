/**
 * 数据库连接池服务
 *
 * 提供真实的 PostgreSQL 连接管理，使用 pg Pool
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

  /**
   * 初始化真实 PostgreSQL 连接池
   */
  async connect(): Promise<void> {
    if (this.isConnected || this.isInitializing) {
      return;
    }

    this.isInitializing = true;
    console.log('[] Initializing connection pool...');

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
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
      });

      this.pool.on('error', (err) => {
        console.error('[] Unexpected pool error:', err);
        this.emit('error', err);
      });

      // Verify connection with a test query
      const client = await this.pool.connect();
      try {
        await client.query('SELECT 1');
      } finally {
        client.release();
      }

      this.isConnected = true;
      this.emit('connect');
      console.log(`[] Connected to database ${this.config.database} at ${this.config.host}:${this.config.port}`);
    } catch (error) {
      this.emit('error', error);
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * 获取连接
   */
  async getConnection(): Promise<pg.PoolClient> {
    if (!this.isConnected || !this.pool) {
      throw new Error('Database not connected');
    }

    return this.pool.connect();
  }

  /**
   * 执行查询
   */
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

  /**
   * 执行事务
   */
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
      // Only ROLLBACK if BEGIN succeeded — otherwise the connection isn't in a transaction
      if (transactionStarted) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          console.error('[] Transaction rollback failed:', rollbackError);
        }
      }
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 检查连接健康
   */
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

  /**
   * 关闭连接池
   */
  async close(): Promise<void> {
    if (!this.pool) {
      return;
    }

    console.log('[] Closing connection pool...');

    await this.pool.end();
    this.isConnected = false;

    this.emit('close');
    console.log('[] Connection pool closed');
  }

  /**
   * 检查连接状态
   */
  isHealthy(): boolean {
    return this.isConnected;
  }

  /**
   * 获取池大小
   */
  getPoolSize(): number {
    return this.pool?.totalCount ?? 0;
  }

  /**
   * 获取空闲连接数
   */
  getIdleCount(): number {
    return this.pool?.idleCount ?? 0;
  }
}
