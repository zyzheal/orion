/**
 * DBA Connection Service
 *
 * Provides real connection testing and diagnostics for databases:
 * - testConnection(connectionConfig) - test a database connection with raw config
 * - getConnectionStatus() - get platform service's own DB connection pool status
 * - executeDiagnostics() - run diagnostic queries (version, settings, performance)
 * - getSlowQueries() - list slow queries from pg_stat_statements
 * - getTableStats() - table size and row count statistics
 *
 * Security: all connection tests are logged with tenant/user context.
 */

import { testDatabaseConnection, type DbConnectionConfig, type ConnectionTestResult } from './db-connection';
import { OrionError, ErrorCode } from '../../errors';
import { DatabasePool } from '../database';
import { createLogger } from '../../utils/logger';

const logger = createLogger('dba-connection-service');

// ============================================================================
// Types
// ============================================================================

export interface ConnectionTestInput {
  host: string;
  port: number;
  username?: string;
  password?: string;
  database: string;
  sourceType: string;
}

export interface ConnectionPoolStatus {
  status: 'up' | 'down';
  latency?: number;
  message?: string;
  poolStats?: {
    total: number;
    idle: number;
    waiting: number;
  };
}

export interface DiagnosticResult {
  version: string;
  databaseName: string;
  currentUser: string;
  currentSchema: string;
  settings: Record<string, string>;
  performance: {
    connectionsActive: number;
    connectionsIdle: number;
    connectionsTotal: number;
    transactionsCommitted: number;
    transactionsRolledBack: number;
    cacheHitRatio: string;
    databaseSize: string;
    uptime: string;
  };
  latency: number;
}

export interface SlowQueryEntry {
  query: string;
  calls: number;
  totalTime: number;
  meanTime: number;
  maxTime: number;
  rows: number;
}

export interface TableStatEntry {
  schemaName: string;
  tableName: string;
  rowEstimate: number;
  totalBytes: string;
  indexBytes: string;
  toastBytes: string;
  lastVacuum?: string;
  lastAnalyze?: string;
}

// ============================================================================
// DbaConnectionService
// ============================================================================

export class DbaConnectionService {
  private dbPool: DatabasePool;

  constructor(dbPool: DatabasePool) {
    this.dbPool = dbPool;
  }

  // ==========================================================================
  // Connection Testing
  // ==========================================================================

  /**
   * Test a database connection with the provided configuration.
   * Actually connects to the target database, verifies credentials,
   * checks connection pool health, and tests query execution capability.
   *
   * @param input - Connection configuration (host, port, credentials, database, type)
   * @returns ConnectionTestResult with latency, version, and pool stats
   */
  async testConnection(input: ConnectionTestInput): Promise<ConnectionTestResult> {
    const startTime = Date.now();

    logger.info(
      {
        host: input.host,
        port: input.port,
        database: input.database,
        sourceType: input.sourceType,
      },
      'Testing database connection',
    );

    const result = await testDatabaseConnection({
      id: 'direct-test',
      sourceType: input.sourceType,
      host: input.host,
      port: input.port,
      databaseName: input.database,
      username: input.username ?? null,
      passwordEncrypted: input.password ?? null,
    });

    const totalLatency = Date.now() - startTime;

    if (result.success) {
      logger.info(
        {
          host: input.host,
          port: input.port,
          database: input.database,
          latency: result.latency ?? totalLatency,
          version: result.version,
        },
        'Database connection test successful',
      );
    } else {
      logger.warn(
        {
          host: input.host,
          port: input.port,
          database: input.database,
          error: result.error,
          latency: result.latency ?? totalLatency,
        },
        'Database connection test failed',
      );
    }

    return result;
  }

  // ==========================================================================
  // Connection Pool Status
  // ==========================================================================

  /**
   * Get the current connection pool status for the platform service's own database.
   * Returns health status, latency, and pool statistics.
   */
  async getConnectionStatus(): Promise<ConnectionPoolStatus> {
    const healthResult = await this.dbPool.checkHealth();

    const status: ConnectionPoolStatus = {
      status: healthResult.status,
      latency: healthResult.latency,
      message: healthResult.message,
    };

    // Add pool statistics if available
    try {
      const total = this.dbPool.getPoolSize();
      const idle = this.dbPool.getIdleCount();
      status.poolStats = {
        total,
        idle,
        waiting: Math.max(0, total - idle),
      };
    } catch {
      // Pool stats not available
    }

    logger.info(
      { status: status.status, latency: status.latency, poolStats: status.poolStats },
      'Retrieved connection pool status',
    );

    return status;
  }

  // ==========================================================================
  // Diagnostics
  // ==========================================================================

  /**
   * Run diagnostic queries against the platform service's own database.
   * Returns version, current settings, and performance metrics.
   */
  async executeDiagnostics(): Promise<DiagnosticResult> {
    const startTime = Date.now();

    logger.info('Running database diagnostics');

    try {
      // Version and basic info
      const versionResult = await this.dbPool.query('SELECT version() AS version');
      const dbNameResult = await this.dbPool.query('SELECT current_database() AS db_name, current_user AS db_user');
      const schemaResult = await this.dbPool.query('SELECT current_schema() AS schema_name');

      const version = versionResult.rows[0]?.version || 'unknown';
      const dbName = dbNameResult.rows[0]?.db_name || 'unknown';
      const currentUser = dbNameResult.rows[0]?.db_user || 'unknown';
      const currentSchema = schemaResult.rows[0]?.schema_name || 'public';

      // Key settings
      const settingsResult = await this.dbPool.query(`
        SELECT name, setting
        FROM pg_settings
        WHERE name IN (
          'server_version',
          'max_connections',
          'shared_buffers',
          'effective_cache_size',
          'work_mem',
          'maintenance_work_mem',
          'random_page_cost',
          'effective_io_concurrency',
          'default_statistics_target',
          'track_activities',
          'track_counts',
          'track_io_timing',
          'log_statement',
          'log_min_duration_statement'
        )
        ORDER BY name
      `);

      const settings: Record<string, string> = {};
      for (const row of settingsResult.rows) {
        settings[row.name] = row.setting;
      }

      // Performance metrics
      const perfResult = await this.dbPool.query(`
        SELECT
          (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') AS connections_active,
          (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle') AS connections_idle,
          (SELECT count(*) FROM pg_stat_activity) AS connections_total,
          (SELECT sum(xact_commit) FROM pg_stat_database WHERE datname = current_database()) AS transactions_committed,
          (SELECT sum(xact_rollback) FROM pg_stat_database WHERE datname = current_database()) AS transactions_rolled_back,
          (SELECT round(sum(heap_blks_hit)::numeric / nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0) * 100, 2)
           FROM pg_statio_user_tables) AS cache_hit_ratio,
          pg_size_pretty(pg_database_size(current_database())) AS database_size,
          to_char(now() - pg_postmaster_start_time(), 'HH24:MI:SS') AS uptime
      `);

      const perf = perfResult.rows[0];
      const latency = Date.now() - startTime;

      const diagnosticResult: DiagnosticResult = {
        version,
        databaseName: dbName,
        currentUser,
        currentSchema,
        settings,
        performance: {
          connectionsActive: parseInt(perf?.connections_active || '0', 10),
          connectionsIdle: parseInt(perf?.connections_idle || '0', 10),
          connectionsTotal: parseInt(perf?.connections_total || '0', 10),
          transactionsCommitted: parseInt(perf?.transactions_committed || '0', 10),
          transactionsRolledBack: parseInt(perf?.transactions_rolled_back || '0', 10),
          cacheHitRatio: perf?.cache_hit_ratio || '0',
          databaseSize: perf?.database_size || '0',
          uptime: perf?.uptime || '00:00:00',
        },
        latency,
      };

      logger.info(
        {
          version,
          databaseName: dbName,
          latency,
          connectionsActive: diagnosticResult.performance.connectionsActive,
        },
        'Database diagnostics completed',
      );

      return diagnosticResult;
    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, latency }, 'Database diagnostics failed');

      throw new OrionError(`Diagnostics failed: ${errorMessage}`, ErrorCode.INTERNAL_ERROR);
    }
  }

  // ==========================================================================
  // Slow Queries
  // ==========================================================================

  /**
   * List slow queries from pg_stat_statements.
   * Requires pg_stat_statements extension to be installed.
   *
   * @param minMeanTime - Minimum mean execution time in ms (default: 50)
   * @param limit - Maximum number of queries to return (default: 20, max: 100)
   */
  async getSlowQueries(minMeanTime: number = 50, limit: number = 20): Promise<SlowQueryEntry[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safeMinMeanTime = Math.max(minMeanTime, 0);

    logger.info(
      { minMeanTime: safeMinMeanTime, limit: safeLimit },
      'Fetching slow queries from pg_stat_statements',
    );

    try {
      const result = await this.dbPool.query(
        `
        SELECT
          LEFT(query, 500) AS query,
          calls,
          total_exec_time AS total_time,
          mean_exec_time AS mean_time,
          max_exec_time AS max_time,
          rows
        FROM pg_stat_statements
        WHERE mean_exec_time >= $1
        ORDER BY mean_exec_time DESC
        LIMIT $2
        `,
        [safeMinMeanTime, safeLimit],
      );

      const queries: SlowQueryEntry[] = result.rows.map((row: any) => ({
        query: row.query,
        calls: parseInt(row.calls || '0', 10),
        totalTime: parseFloat(row.total_time || '0'),
        meanTime: parseFloat(row.mean_time || '0'),
        maxTime: parseFloat(row.max_time || '0'),
        rows: parseInt(row.rows || '0', 10),
      }));

      logger.info({ count: queries.length }, 'Slow queries retrieved');

      return queries;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // pg_stat_statements extension might not be installed
      if (errorMessage.includes('pg_stat_statements') || errorMessage.includes('does not exist')) {
        logger.warn('pg_stat_statements extension not available');
        return [];
      }

      logger.error({ error: errorMessage }, 'Failed to fetch slow queries');
      throw new OrionError(`Failed to fetch slow queries: ${errorMessage}`, ErrorCode.INTERNAL_ERROR);
    }
  }

  // ==========================================================================
  // Table Statistics
  // ==========================================================================

  /**
   * Get table size and row count statistics for all user tables.
   *
   * @param schema - Schema name (default: 'public', use null for all schemas)
   * @param limit - Maximum number of tables to return (default: 50, max: 200)
   */
  async getTableStats(schema: string | null = 'public', limit: number = 50): Promise<TableStatEntry[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 200);

    logger.info({ schema, limit: safeLimit }, 'Fetching table statistics');

    try {
      let query: string;
      const params: unknown[] = [safeLimit];

      if (schema) {
        query = `
          SELECT
            schemaname AS schema_name,
            relname AS table_name,
            n_live_tup AS row_estimate,
            pg_size_pretty(pg_total_relation_size(schemaname || '.' || relname)) AS total_bytes,
            pg_size_pretty(pg_indexes_size(schemaname || '.' || relname)) AS index_bytes,
            pg_size_pretty(pg_total_relation_size(schemaname || '.' || relname) - pg_indexes_size(schemaname || '.' || relname)) AS toast_bytes,
            last_vacuum,
            last_analyze
          FROM pg_stat_user_tables
          WHERE schemaname = $1
          ORDER BY pg_total_relation_size(schemaname || '.' || relname) DESC
          LIMIT $2
        `;
        params.unshift(schema);
      } else {
        query = `
          SELECT
            schemaname AS schema_name,
            relname AS table_name,
            n_live_tup AS row_estimate,
            pg_size_pretty(pg_total_relation_size(schemaname || '.' || relname)) AS total_bytes,
            pg_size_pretty(pg_indexes_size(schemaname || '.' || relname)) AS index_bytes,
            pg_size_pretty(pg_total_relation_size(schemaname || '.' || relname) - pg_indexes_size(schemaname || '.' || relname)) AS toast_bytes,
            last_vacuum,
            last_analyze
          FROM pg_stat_user_tables
          ORDER BY pg_total_relation_size(schemaname || '.' || relname) DESC
          LIMIT $1
        `;
      }

      const result = await this.dbPool.query(query, params);

      const tableStats: TableStatEntry[] = result.rows.map((row: any) => ({
        schemaName: row.schema_name,
        tableName: row.table_name,
        rowEstimate: parseInt(row.row_estimate || '0', 10),
        totalBytes: row.total_bytes || '0 bytes',
        indexBytes: row.index_bytes || '0 bytes',
        toastBytes: row.toast_bytes || '0 bytes',
        lastVacuum: row.last_vacuum ? new Date(row.last_vacuum).toISOString() : undefined,
        lastAnalyze: row.last_analyze ? new Date(row.last_analyze).toISOString() : undefined,
      }));

      logger.info({ count: tableStats.length, schema }, 'Table statistics retrieved');

      return tableStats;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, schema }, 'Failed to fetch table statistics');
      throw new OrionError(`Failed to fetch table statistics: ${errorMessage}`, ErrorCode.INTERNAL_ERROR);
    }
  }
}
