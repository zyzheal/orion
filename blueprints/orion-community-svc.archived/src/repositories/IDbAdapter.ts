/**
 * Community Repository - PostgreSQL 数据访问层
 */

export interface IDbAdapter {
  query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
}
