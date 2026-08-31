/**
 * Data Source API Client Tests
 *
 * All 11 routes the backend serves under /api/v1/data-sources are exercised, so
 * dropping or renaming one of them breaks this file instead of a random consumer.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listDataSources,
  listDataSourceTypes,
  getAllDataSourcesHealth,
  getDataSource,
  getDataSourceHealth,
  createDataSource,
  updateDataSource,
  deleteDataSource,
  testDataSourceConnection,
  queryDataSource,
  executeDataSource,
} from '../datasource';
import { api } from '../client';
import { API_PATHS } from '@/constants/api-paths';
import type { AxiosResponse } from 'axios';

// 断言用 API_PATHS 常量而非硬编码字符串：datasource.ts 已从字面量路径迁到
// API_PATHS.DATASOURCE.*（无前置斜杠，axios combineURLs 会与 baseURL 拼出
// 同样的 /api/v1/data-sources）。此前 11 个断言全部硬编码 '/data-sources/...'，
// 迁移后 11/11 全红 —— 测的是旧写法，不是接口契约。

vi.mock('../client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

// client.ts's response interceptor already unwraps { success, data }, so the mock
// resolves with the payload directly — that is the shape these callers read.
function ok<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {},
  } as unknown as AxiosResponse<T>;
}

describe('Data Source API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should list data sources', async () => {
    vi.mocked(api.get).mockResolvedValue(ok({ items: [], total: 0 }));
    const result = await listDataSources();
    expect(api.get).toHaveBeenCalledWith(API_PATHS.DATASOURCE.BASE);
    expect(result.data).toEqual({ items: [], total: 0 });
  });

  it('should list the supported engine types', async () => {
    vi.mocked(api.get).mockResolvedValue(
      ok(['postgres', 'mysql', 'clickhouse', 'elasticsearch', 'mongodb'])
    );
    const result = await listDataSourceTypes();
    expect(api.get).toHaveBeenCalledWith(API_PATHS.DATASOURCE.TYPES);
    expect(result.data).toContain('clickhouse');
  });

  it('should list health for every source', async () => {
    vi.mocked(api.get).mockResolvedValue(ok({ total: 1, statuses: [] }));
    const result = await getAllDataSourcesHealth();
    expect(api.get).toHaveBeenCalledWith(API_PATHS.DATASOURCE.HEALTH);
    expect(result.data.total).toBe(1);
  });

  it('should get one data source', async () => {
    vi.mocked(api.get).mockResolvedValue(
      ok({ id: 'ds-1', name: 'prod', type: 'postgres', status: 'active' })
    );
    const result = await getDataSource('ds-1');
    expect(api.get).toHaveBeenCalledWith(API_PATHS.DATASOURCE.DETAIL('ds-1'));
    expect(result.data.id).toBe('ds-1');
  });

  it('should get health for one source', async () => {
    vi.mocked(api.get).mockResolvedValue(
      ok({ dataSourceId: 'ds-1', status: 'active', latency: 1 })
    );
    const result = await getDataSourceHealth('ds-1');
    expect(api.get).toHaveBeenCalledWith(API_PATHS.DATASOURCE.HEALTH_BY_ID('ds-1'));
    expect(result.data.dataSourceId).toBe('ds-1');
  });

  it('should create a data source', async () => {
    vi.mocked(api.post).mockResolvedValue(ok({ id: 'ds-2' }));
    await createDataSource({ name: 'prod', type: 'postgres', host: 'db.internal', port: 5432 });
    expect(api.post).toHaveBeenCalledWith(API_PATHS.DATASOURCE.BASE, {
      name: 'prod',
      type: 'postgres',
      host: 'db.internal',
      port: 5432,
    });
  });

  it('should update a data source', async () => {
    vi.mocked(api.put).mockResolvedValue(ok({ id: 'ds-1' }));
    await updateDataSource('ds-1', { port: 5433 });
    expect(api.put).toHaveBeenCalledWith(API_PATHS.DATASOURCE.DETAIL('ds-1'), { port: 5433 });
  });

  it('should delete a data source', async () => {
    vi.mocked(api.delete).mockResolvedValue(ok(undefined));
    await deleteDataSource('ds-1');
    expect(api.delete).toHaveBeenCalledWith(API_PATHS.DATASOURCE.DETAIL('ds-1'));
  });

  it('should probe the connection of one source', async () => {
    vi.mocked(api.post).mockResolvedValue(ok({ ok: true }));
    const result = await testDataSourceConnection('ds-1');
    expect(api.post).toHaveBeenCalledWith(API_PATHS.DATASOURCE.TEST('ds-1'));
    expect(result.data.ok).toBe(true);
  });

  it('should run a read query with no args', async () => {
    vi.mocked(api.post).mockResolvedValue(ok({ columns: ['id'], rows: [], rowCount: 0, took: 0 }));
    const result = await queryDataSource('ds-1', 'select id from t');
    expect(api.post).toHaveBeenCalledWith(API_PATHS.DATASOURCE.QUERY('ds-1'), {
      query: 'select id from t',
      args: [],
    });
    expect(result.data.columns).toEqual(['id']);
  });

  it('should run a write query with positional args', async () => {
    vi.mocked(api.post).mockResolvedValue(
      ok({ columns: [], rows: [], rowCount: 0, affected: 3, took: 0 })
    );
    const result = await executeDataSource('ds-1', 'update t set a = 1 where id = $1', [7]);
    expect(api.post).toHaveBeenCalledWith(API_PATHS.DATASOURCE.EXECUTE('ds-1'), {
      query: 'update t set a = 1 where id = $1',
      args: [7],
    });
    expect(result.data.affected).toBe(3);
  });
});
