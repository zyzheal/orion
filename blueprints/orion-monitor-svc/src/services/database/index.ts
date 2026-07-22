/**
 * Database service stub.
 */

export interface DatabasePool {
  query: (text: string, values?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }>;
}
