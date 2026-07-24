/**
 * Query Result Model
 *
 * Standardized result shape returned by all query execution methods.
 */

export interface QueryResult {
  /** Column names in order */
  columns: string[];
  /** Result rows (each row is a Record<string, any>) */
  rows: any[];
  /** Number of rows returned */
  rowCount: number;
  /** Execution time in milliseconds */
  executionTimeMs: number;
  /** Warnings from the database (e.g. truncation notices) */
  warnings: string[];
  /** Whether the result was truncated due to maxRows limit */
  truncated?: boolean;
}
