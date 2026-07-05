/**
 * Database Connection Tester
 *
 * Provides real connection testing for multiple database types:
 * - PostgreSQL (via pg)
 * - Redis (via ioredis)
 * - MySQL (via mysql2, optional)
 * - MongoDB (via mongodb, optional)
 *
 * Returns: latency, version info, and pool stats where applicable
 *
 * Also provides direct SQL query execution with:
 * - SELECT-only restriction (DDL/DML blocked)
 * - Configurable timeout (default 30s)
 * - JSON-formatted result rows
 */

import * as pg from 'pg';
import Redis from 'ioredis';
import { decryptValue } from '../../utils/encryption';
import { createLogger } from '../../utils/logger';

const logger = createLogger('dba-connection');

// ============================================================================
// Types
// ============================================================================

export interface DbConnectionConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  database: string;
  sourceType: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latency?: number;        // Connection latency in ms
  version?: string;        // Database version
  poolStats?: {
    total: number;         // Total connections in pool
    idle: number;          // Idle connections
    waiting: number;       // Queued connection requests
  };
  error?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Decrypt password if it's encrypted, otherwise return as-is
 */
function resolvePassword(encryptedOrPlain: string | null | undefined): string | undefined {
  if (!encryptedOrPlain) return undefined;
  if (encryptedOrPlain.startsWith('ENC:AES256:')) {
    return decryptValue(encryptedOrPlain);
  }
  return encryptedOrPlain;
}

/**
 * Build a connection config with decrypted password
 */
function buildConfig(ds: {
  host: string;
  port: number;
  username: string | null;
  passwordEncrypted: string | null;
  databaseName: string;
  sourceType: string;
}): DbConnectionConfig {
  return {
    host: ds.host,
    port: ds.port,
    username: ds.username ?? undefined,
    password: resolvePassword(ds.passwordEncrypted),
    database: ds.databaseName,
    sourceType: ds.sourceType,
  };
}

// ============================================================================
// PostgreSQL
// ============================================================================

export async function testPostgresConnection(
  config: DbConnectionConfig
): Promise<ConnectionTestResult> {
  const startTime = Date.now();
  const pool = new pg.Pool({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    database: config.database,
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  });

  try {
    const client = await pool.connect();
    try {
      // Execute SELECT 1 to verify connectivity
      await client.query('SELECT 1');

      // Get database version
      const versionResult = await client.query('SELECT version()');
      const version = versionResult.rows[0]?.version || 'unknown';

      // Get current database and user
      const dbResult = await client.query('SELECT current_database(), current_user');
      const latency = Date.now() - startTime;

      // Collect pool stats
      const poolStats = {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
      };

      logger.info(
        { host: config.host, port: config.port, database: config.database, latency, version },
        'PostgreSQL connection test successful'
      );

      return {
        success: true,
        message: `Connected to ${config.host}:${config.port}/${config.database}`,
        latency,
        version: version.split(',')[0].trim(), // e.g. "PostgreSQL 15.4"
        poolStats,
      };
    } finally {
      client.release();
    }
  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ host: config.host, port: config.port, error: errorMessage }, 'PostgreSQL connection test failed');
    return {
      success: false,
      message: `Connection failed: ${errorMessage}`,
      latency,
      error: errorMessage,
    };
  } finally {
    await pool.end();
  }
}

// ============================================================================
// Redis
// ============================================================================

export async function testRedisConnection(
  config: DbConnectionConfig
): Promise<ConnectionTestResult> {
  const startTime = Date.now();
  const client = new Redis({
    host: config.host,
    port: config.port,
    password: config.password,
    db: 0,
    connectTimeout: 5000,
    lazyConnect: true,
  });

  try {
    await client.connect();

    // Execute PING to verify connectivity
    const pong = await client.ping();

    // Get Redis info for version
    const info = await client.info('server');
    const versionMatch = info.match(/redis_version:(\d+\.\d+\.\d+)/);
    const version = versionMatch ? `Redis ${versionMatch[1]}` : 'unknown';

    // Get pool stats (Redis client connection info)
    const poolStats = {
      total: client.status === 'ready' ? 1 : 0,
      idle: client.status === 'ready' ? 0 : 0,
      waiting: 0,
    };

    const latency = Date.now() - startTime;

    logger.info(
      { host: config.host, port: config.port, latency, version },
      'Redis connection test successful'
    );

    return {
      success: true,
      message: `Connected to Redis ${config.host}:${config.port}`,
      latency,
      version,
      poolStats,
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ host: config.host, port: config.port, error: errorMessage }, 'Redis connection test failed');
    return {
      success: false,
      message: `Connection failed: ${errorMessage}`,
      latency,
      error: errorMessage,
    };
  } finally {
    await client.quit();
  }
}

// ============================================================================
// MySQL (optional - requires mysql2 package)
// ============================================================================

export async function testMysqlConnection(
  config: DbConnectionConfig
): Promise<ConnectionTestResult> {
  const startTime = Date.now();

  try {
    // Dynamic require to avoid hard dependency
    const mysql = require('mysql2/promise');
    const connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      database: config.database,
      connectTimeout: 5000,
    });

    try {
      // Execute SELECT 1
      const [rows] = await connection.query('SELECT 1') as [any[], any];

      // Get database version
      const [versionRows] = await connection.query('SELECT VERSION() as version') as [any[], any];
      const version = versionRows[0]?.version || 'unknown';

      const latency = Date.now() - startTime;

      logger.info(
        { host: config.host, port: config.port, database: config.database, latency, version },
        'MySQL connection test successful'
      );

      return {
        success: true,
        message: `Connected to ${config.host}:${config.port}/${config.database}`,
        latency,
        version: `MySQL ${version.split('-')[0].trim()}`,
      };
    } finally {
      await connection.end();
    }
  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ host: config.host, port: config.port, error: errorMessage }, 'MySQL connection test failed');

    // Check if mysql2 is not installed
    if (error instanceof Error && error.message.includes('Cannot find module')) {
      return {
        success: false,
        message: 'MySQL driver (mysql2) not installed. Run: npm install mysql2',
        latency,
        error: 'MYSQL_DRIVER_NOT_INSTALLED',
      };
    }

    return {
      success: false,
      message: `Connection failed: ${errorMessage}`,
      latency,
      error: errorMessage,
    };
  }
}

// ============================================================================
// MongoDB (optional - requires mongodb package)
// ============================================================================

export async function testMongoConnection(
  config: DbConnectionConfig
): Promise<ConnectionTestResult> {
  const startTime = Date.now();

  try {
    // Dynamic require to avoid hard dependency
    const { MongoClient } = require('mongodb');
    const uri = config.username || config.password
      ? `mongodb://${encodeURIComponent(config.username || '')}:${encodeURIComponent(config.password || '')}@${config.host}:${config.port}/${config.database}`
      : `mongodb://${config.host}:${config.port}/${config.database}`;

    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });

    try {
      await client.connect();

      // Execute ping to verify connectivity
      await client.db('admin').command({ ping: 1 });

      // Get server info for version
      const serverInfo = await client.db().admin().serverInfo();
      const version = serverInfo.version || 'unknown';

      const latency = Date.now() - startTime;

      logger.info(
        { host: config.host, port: config.port, latency, version },
        'MongoDB connection test successful'
      );

      return {
        success: true,
        message: `Connected to MongoDB ${config.host}:${config.port}`,
        latency,
        version: `MongoDB ${version}`,
      };
    } finally {
      await client.close();
    }
  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ host: config.host, port: config.port, error: errorMessage }, 'MongoDB connection test failed');

    // Check if mongodb is not installed
    if (error instanceof Error && error.message.includes('Cannot find module')) {
      return {
        success: false,
        message: 'MongoDB driver not installed. Run: npm install mongodb',
        latency,
        error: 'MONGO_DRIVER_NOT_INSTALLED',
      };
    }

    return {
      success: false,
      message: `Connection failed: ${errorMessage}`,
      latency,
      error: errorMessage,
    };
  }
}

// ============================================================================
// Main dispatcher
// ============================================================================

export async function testDatabaseConnection(
  ds: {
    id: string;
    sourceType: string;
    host: string;
    port: number;
    databaseName: string;
    username: string | null;
    passwordEncrypted: string | null;
  }
): Promise<ConnectionTestResult> {
  const config = buildConfig(ds);
  const sourceType = config.sourceType.toLowerCase();

  switch (sourceType) {
    case 'postgresql':
    case 'postgres':
      return testPostgresConnection(config);

    case 'mysql':
      return testMysqlConnection(config);

    case 'redis':
      return testRedisConnection(config);

    case 'mongodb':
    case 'mongo':
      return testMongoConnection(config);

    default:
      return {
        success: false,
        message: `Unsupported database type: ${config.sourceType}. Supported: postgresql, mysql, redis, mongodb`,
        error: 'UNSUPPORTED_DATABASE_TYPE',
      };
  }
}

// ============================================================================
// Direct SQL Query Execution
// ============================================================================

/** Allowed read-only SQL keywords (case-insensitive first token check) */
export const READ_ONLY_KEYWORDS = ['SELECT', 'WITH', 'EXPLAIN', 'SHOW', 'DESCRIBE'];

/** Blocked DML keywords */
export const DML_KEYWORDS = ['INSERT', 'UPDATE', 'DELETE', 'MERGE', 'CALL'];

/** Blocked DDL keywords */
export const DDL_KEYWORDS = ['CREATE', 'ALTER', 'DROP', 'TRUNCATE', 'RENAME', 'GRANT', 'REVOKE', 'COMMIT', 'ROLLBACK', 'SAVEPOINT'];

export interface QueryExecutionResult {
  success: boolean;
  rows: any[];
  rowCount: number;
  fields?: { name: string; dataTypeID: number }[];
  latency: number;
  truncated?: boolean;
  error?: string;
  message?: string;
}

/**
 * Strip SQL comments (single-line -- and multi-line /* ... *​/) to extract the first statement keyword.
 */
export function extractFirstKeyword(sql: string): string {
  // Remove multi-line comments
  let cleaned = sql.replace(/\/\*[\s\S]*?\*\//g, '');
  // Remove single-line comments
  cleaned = cleaned.replace(/--.*$/gm, '');
  // Trim whitespace and take the first word
  return cleaned.trim().split(/\s+/)[0]?.toUpperCase() || '';
}

/**
 * Execute a read-only SQL query against a PostgreSQL data source.
 *
 * @param config - Database connection configuration (host, port, etc.)
 * @param sql    - The SQL query to execute (must be a SELECT / WITH / EXPLAIN / SHOW / DESCRIBE)
 * @param timeoutMs - Query timeout in milliseconds (default 30000 = 30s)
 * @param maxRows - Maximum number of rows to return (default 1000, prevents huge result sets)
 */
export async function executeQuery(
  config: DbConnectionConfig,
  sql: string,
  timeoutMs: number = 30000,
  maxRows: number = 1000,
): Promise<QueryExecutionResult> {
  const startTime = Date.now();

  // 1. Validate query is read-only
  const firstKeyword = extractFirstKeyword(sql);
  if (!firstKeyword) {
    return { success: false, rows: [], rowCount: 0, latency: 0, error: 'Empty SQL query' };
  }

  const isReadOnly = READ_ONLY_KEYWORDS.some(kw => firstKeyword === kw);
  if (!isReadOnly) {
    const matchedDML = DML_KEYWORDS.find(kw => firstKeyword === kw);
    const matchedDDL = DDL_KEYWORDS.find(kw => firstKeyword === kw);
    const restriction = matchedDML ? 'DML' : matchedDDL ? 'DDL' : 'Unknown';
    return {
      success: false,
      rows: [],
      rowCount: 0,
      latency: 0,
      error: `${restriction} operations are not allowed via direct query execution. Only SELECT/WITH/EXPLAIN/SHOW/DESCRIBE are permitted. Blocked keyword: ${firstKeyword}`,
    };
  }

  // 2. Execute via a short-lived pool
  const pool = new pg.Pool({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    database: config.database,
    max: 2,
    connectionTimeoutMillis: Math.min(timeoutMs, 10000),
    idleTimeoutMillis: 30000,
  });

  let client: pg.PoolClient | undefined;

  try {
    client = await pool.connect();

    // Apply statement timeout
    await client.query(`SET statement_timeout = ${timeoutMs}`);

    // Wrap in a subquery with LIMIT to cap results
    const limitedSql = `SELECT * FROM (${sql}) AS _sub LIMIT ${maxRows}`;
    let result;
    try {
      result = await client.query(limitedSql);
    } catch {
      // If wrapping fails (e.g. CTE without SELECT), try the original SQL with a limit hint
      result = await client.query(`${sql} LIMIT ${maxRows}`);
    }

    const latency = Date.now() - startTime;

    // Build field metadata
    const fields = result.fields?.map(f => ({ name: f.name, dataTypeID: f.dataTypeID }));

    // Determine if results were truncated
    const truncated = result.rows.length >= maxRows;

    logger.info(
      { host: config.host, database: config.database, latency, rowCount: result.rows.length, truncated },
      'Direct query execution successful',
    );

    return {
      success: true,
      rows: result.rows,
      rowCount: result.rows.length,
      fields,
      latency,
      truncated,
      message: truncated
        ? `Query returned ${result.rows.length} rows (truncated to ${maxRows}). Refine your query or add LIMIT/OFFSET.`
        : `Query returned ${result.rows.length} rows in ${latency}ms`,
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(
      { host: config.host, database: config.database, error: errorMessage, latency },
      'Direct query execution failed',
    );
    return {
      success: false,
      rows: [],
      rowCount: 0,
      latency,
      error: errorMessage,
    };
  } finally {
    if (client) client.release();
    await pool.end();
  }
}
