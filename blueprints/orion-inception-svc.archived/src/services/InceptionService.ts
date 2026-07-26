/**
 * Inception Service - Core SQL audit engine wrapper
 *
 * Connects to Inception via TCP protocol and exposes HTTP endpoints.
 * Inception uses MySQL-compatible protocol for SQL audit/parse/execute.
 */

import { createConnection, Socket } from 'net';
import { config } from '../config';
import type { SqlAuditResult, SqlParseRequest, SqlExecuteRequest, InceptionStatus, SqlError, SqlWarning } from '../types/inception';

// Whitelist for database names to prevent SQL injection via db parameter
const DB_NAME_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/;

// Dangerous SQL keywords that should be blocked at the db/sql level
const DANGEROUS_KEYWORDS = ['DROP DATABASE', 'DROP USER', 'GRANT ALL', 'CREATE USER'];

function validateDatabaseName(db: string): void {
  if (!DB_NAME_REGEX.test(db)) {
    throw new Error(`Invalid database name: ${db}. Only alphanumeric characters and underscores allowed.`);
  }
}

function checkDangerousSql(sql: string): void {
  // Normalize whitespace to prevent bypass via extra spaces/tabs/newlines
  const normalized = sql.toUpperCase().replace(/\s+/g, ' ').trim();
  for (const keyword of DANGEROUS_KEYWORDS) {
    if (normalized.includes(keyword)) {
      throw new Error(`Dangerous SQL operation detected: ${keyword}`);
    }
  }
  // Also check for comment-based obfuscation
  if (/\/\*.*drop\s+database/i.test(sql) || /;\s*drop\s+database/i.test(sql)) {
    throw new Error('Dangerous SQL operation detected: DROP DATABASE');
  }
}

/**
 * Build Inception connection command without exposing password in logs
 * Uses environment variable substitution at connection time only
 */
function buildInceptionCommand(options: { execute: number; extraFlags?: string }): string {
  const flags = options.extraFlags || '';
  return `/*--user=${config.inception.user};--password=__REDACTED__;--host=${config.inception.host};--port=${config.inception.port};--execute=${options.execute};${flags}*/`;
}

function buildInceptionAuthString(): string {
  return `/*--user=${config.inception.user};--password=${config.inception.password};--host=${config.inception.host};--port=${config.inception.port};`;
}

export class InceptionService {
  private connection: Socket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;

  /**
   * Check Inception TCP connection status
   */
  async checkStatus(): Promise<InceptionStatus> {
    const start = Date.now();
    return new Promise((resolve) => {
      const socket = createConnection({
        host: config.inception.host,
        port: config.inception.port,
        timeout: 5000,
      });

      socket.on('connect', () => {
        socket.destroy();
        resolve({
          connected: true,
          host: config.inception.host,
          port: config.inception.port,
          latency: Date.now() - start,
        });
      });

      socket.on('error', () => {
        resolve({
          connected: false,
          host: config.inception.host,
          port: config.inception.port,
        });
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({
          connected: false,
          host: config.inception.host,
          port: config.inception.port,
        });
      });
    });
  }

  /**
   * Audit SQL using Inception engine
   *
   * Inception uses MySQL protocol: we connect and send SQL via
   * the special inception command format.
   */
  async auditSql(request: SqlParseRequest): Promise<SqlAuditResult> {
    const sql = this.buildInceptionAuditSql(request.sql, request.db);
    const result = await this.executeInceptionQuery(sql);
    return this.parseInceptionResult(result);
  }

  /**
   * Execute SQL via Inception (with dry-run option)
   */
  async executeSql(request: SqlExecuteRequest): Promise<SqlAuditResult> {
    const sql = request.dryRun
      ? this.buildInceptionDryRunSql(request.sql, request.db)
      : this.buildInceptionExecSql(request.sql, request.db);

    const result = await this.executeInceptionQuery(sql);
    return this.parseInceptionResult(result);
  }

  /**
   * Parse and format SQL for readability
   */
  async formatSql(sql: string): Promise<{ formatted: string }> {
    // Basic formatting: normalize whitespace and add semicolons
    const formatted = sql
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\s*(,|;|=|<|>|\(|\))\s*/g, '$1 ')
      .replace(/(SELECT|FROM|WHERE|AND|OR|INSERT|UPDATE|DELETE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP|ORDER|HAVING|LIMIT)\b/gi, '\n$1')
      .trim();
    return { formatted };
  }

  /**
   * Build Inception audit SQL command
   */
  private buildInceptionAuditSql(sql: string, db: string): string {
    validateDatabaseName(db);
    checkDangerousSql(sql);
    const escapedSql = sql.replace(/'/g, "''");
    return `/*--user=${config.inception.user};--password=${config.inception.password};--host=${config.inception.host};--port=${config.inception.port};--execute=1;--enable-check=1;*/
inception_magic_start;
use ${db};
${sql}
inception_magic_commit;`;
  }

  /**
   * Build Inception dry-run SQL command
   */
  private buildInceptionDryRunSql(sql: string, db: string): string {
    validateDatabaseName(db);
    return `/*--user=${config.inception.user};--password=${config.inception.password};--host=${config.inception.host};--port=${config.inception.port};--execute=1;--enable-check=1;--dry-run=1;*/
inception_magic_start;
use ${db};
${sql}
inception_magic_commit;`;
  }

  /**
   * Build Inception exec SQL command
   */
  private buildInceptionExecSql(sql: string, db: string): string {
    validateDatabaseName(db);
    checkDangerousSql(sql);
    return `/*--user=${config.inception.user};--password=${config.inception.password};--host=${config.inception.host};--port=${config.inception.port};--execute=1;--enable-osc=1;*/
inception_magic_start;
use ${db};
${sql}
inception_magic_commit;`;
  }

  /**
   * Execute query against Inception via TCP
   */
  private executeInceptionQuery(sql: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = createConnection({
        host: config.inception.host,
        port: config.inception.port,
      });

      let data = '';
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          socket.destroy();
          reject(new Error('Inception query timeout'));
        }
      }, config.inception.timeout);

      socket.on('data', (chunk) => {
        data += chunk.toString();
      });

      socket.on('end', () => {
        resolved = true;
        clearTimeout(timeout);
        resolve(data);
      });

      socket.on('error', (err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          reject(err);
        }
      });

      // Send the inception command
      socket.write(sql + '\n');
    });
  }

  /**
   * Parse Inception result into structured format
   */
  private parseInceptionResult(raw: string): SqlAuditResult {
    const errors: SqlError[] = [];
    const warnings: SqlWarning[] = [];

    // Parse Inception result format
    // Each line contains: ID | Stage | Error Level | Error Message
    const lines = raw.split('\n').filter(Boolean);

    for (const line of lines) {
      const parts = line.split('|').map((p) => p.trim());
      if (parts.length >= 4) {
        const level = parseInt(parts[2], 10);
        if (isNaN(level)) continue;

        if (level === 2) {
          errors.push({
            level,
            stage: parts[1],
            error: parts[3],
          });
        } else if (level === 1) {
          warnings.push({
            level,
            stage: parts[1],
            warning: parts[3],
          });
        }
      }
    }

    return {
      success: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Cleanup connection on shutdown
   */
  async shutdown(): Promise<void> {
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
    }
    if (this.connection) {
      this.connection.destroy();
      this.connection = null;
    }
  }
}
