/**
 * Data Source API Client
 *
 * ARCH-0.9, frontend half. The backend module
 * (orion-platform-svc-go/internal/datasource/) already serves 11 guarded routes
 * under /api/v1/data-sources, but no frontend client existed, so every consumer
 * hand-rolled its own fetch. This file is the single typed entry point for all of
 * them: one definition of the payload, one place to notice a field rename.
 *
 * Contract notes read off the Go handler, not guessed:
 *
 * - The `{ success, data }` envelope is unwrapped by the response interceptor in
 *   client.ts, so each function below resolves with the payload itself.
 * - `password` is write-only. The Go model carries `json:"-"` on both Password
 *   and PasswordEnc, so no response can ever contain a credential: send it on
 *   register/update, never expect it back. (ARCH-0.11 targets the other module,
 *   database-devops, where Password is still echoed with omitempty.)
 * - `connMaxLifetime` is a Go time.Duration, which JSON-encodes as an integer
 *   number of nanoseconds.
 * - `List` / `HealthAll` read `c.GetString("tenant_id")` and answer 401
 *   "tenant_id required" when it is empty, so this client only behaves correctly
 *   once PERM-8 phase 2 (strict auth.Auth on /api/v1) lands. Until then callers
 *   must be prepared for the tenant-scoped endpoints to reject them.
 */

import { api } from './client';
import { API_PATHS } from '@/constants/api-paths';

/** Engine types the backend can connect to (GET /data-sources/types). */
export type DataSourceType = 'postgres' | 'mysql' | 'clickhouse' | 'elasticsearch' | 'mongodb';

/** Connection state reported by the backend. */
export type DataSourceStatus = 'active' | 'inactive' | 'error' | 'connecting';

/** A managed data source as the backend returns it. */
export interface DataSource {
  id: string;
  name: string;
  type: DataSourceType;
  host: string;
  port: number;
  database: string;
  username: string;
  sslMode?: string;
  authSource?: string;
  maxOpenConns?: number;
  maxIdleConns?: number;
  /** Nanoseconds (Go time.Duration). */
  connMaxLifetime?: number;
  status: DataSourceStatus;
  lastChecked?: string;
  error?: string;
  tags?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  tenantId: string;
}

/** Payload for creating or partially updating a data source.
 *
 * Every field is optional because PUT /:id only mutates the fields the caller
 * supplies — the handler checks each one individually rather than replacing the
 * row. On create the backend rejects a missing name, type or host with 400.
 */
export interface DataSourceInput {
  name?: string;
  type?: DataSourceType;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  /** Write-only; never returned by the backend. */
  password?: string;
  sslMode?: string;
  authSource?: string;
  maxOpenConns?: number;
  maxIdleConns?: number;
  /** Nanoseconds (Go time.Duration). */
  connMaxLifetime?: number;
  tags?: Record<string, string>;
}

/** Result of a query or execute call. */
export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  affected?: number;
  /** Nanoseconds (Go time.Duration). */
  took: number;
}

/** Health of one data source. */
export interface DataSourceHealth {
  dataSourceId: string;
  status: DataSourceStatus;
  /** Nanoseconds (Go time.Duration). */
  latency: number;
  error?: string;
  checkedAt: string;
}

/** Body of GET /data-sources. */
export interface DataSourceListResponse {
  items: DataSource[];
  total: number;
}

/** Body of GET /data-sources/health. */
export interface DataSourceHealthAllResponse {
  total: number;
  statuses: DataSourceHealth[];
}

/** Positional arguments for a prepared statement. */
export type QueryArgs = unknown[];

/** GET /data-sources — every source for the caller's tenant. Guard: datasource:read */
export async function listDataSources() {
  return api.get<DataSourceListResponse>(API_PATHS.DATASOURCE.BASE);
}

/** GET /data-sources/types — engine types the service can connect to. Guard: datasource:read */
export async function listDataSourceTypes() {
  return api.get<DataSourceType[]>(API_PATHS.DATASOURCE.TYPES);
}

/** GET /data-sources/health — health of every registered source. Guard: datasource:read */
export async function getAllDataSourcesHealth() {
  return api.get<DataSourceHealthAllResponse>(API_PATHS.DATASOURCE.HEALTH);
}

/** GET /data-sources/:id — one source by ID. Guard: datasource:read */
export async function getDataSource(id: string) {
  return api.get<DataSource>(API_PATHS.DATASOURCE.DETAIL(id));
}

/** GET /data-sources/:id/health — health of one source. Guard: datasource:read */
export async function getDataSourceHealth(id: string) {
  return api.get<DataSourceHealth>(API_PATHS.DATASOURCE.HEALTH_BY_ID(id));
}

/** POST /data-sources — persist and open the connection pool. Guard: datasource:write */
export async function createDataSource(input: DataSourceInput) {
  return api.post<DataSource>(API_PATHS.DATASOURCE.BASE, input);
}

/** PUT /data-sources/:id — mutate mutable fields only; the pool is not reopened,
 * so a reconnect is an unregister + re-register. Guard: datasource:write */
export async function updateDataSource(id: string, input: DataSourceInput) {
  return api.put<DataSource>(API_PATHS.DATASOURCE.DETAIL(id), input);
}

/** DELETE /data-sources/:id — close the pool and remove the row. Guard: datasource:delete */
export async function deleteDataSource(id: string) {
  return api.delete<void>(API_PATHS.DATASOURCE.DETAIL(id));
}

/** POST /data-sources/:id/test — reachability probe against the live pool. Guard: datasource:write */
export async function testDataSourceConnection(id: string) {
  return api.post<{ ok: boolean }>(API_PATHS.DATASOURCE.TEST(id));
}

/** POST /data-sources/:id/query — read query, returns rows. Guard: datasource:execute */
export async function queryDataSource(id: string, query: string, args: QueryArgs = []) {
  return api.post<QueryResult>(API_PATHS.DATASOURCE.QUERY(id), { query, args });
}

/** POST /data-sources/:id/execute — write query, returns affected counts. Guard: datasource:execute */
export async function executeDataSource(id: string, query: string, args: QueryArgs = []) {
  return api.post<QueryResult>(API_PATHS.DATASOURCE.EXECUTE(id), { query, args });
}
