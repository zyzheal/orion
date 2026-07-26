/**
 * Inception Service - Type Definitions
 */

export interface SqlAuditResult {
  success: boolean;
  errors: SqlError[];
  warnings: SqlWarning[];
  affectedRows?: number;
  execTime?: number;
}

export interface SqlError {
  level: number;
  stage: string;
  error: string;
}

export interface SqlWarning {
  level: number;
  stage: string;
  warning: string;
}

export interface SqlParseRequest {
  sql: string;
  db: string;
  tenantId: string;
}

export interface SqlExecuteRequest {
  sql: string;
  db: string;
  tenantId: string;
  dryRun?: boolean;
}

export interface InceptionStatus {
  connected: boolean;
  host: string;
  port: number;
  latency?: number;
}
