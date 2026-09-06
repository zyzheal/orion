/**
 * Developer Portal — shared types.
 *
 * Central place for the tab key union and the playground response payload so
 * that pages, panels, columns and constants reference one definition.
 */

/** Keys of the five top-level portal tabs. */
export type TabKey = 'docs' | 'mock' | 'sdk' | 'subscriptions' | 'playground';

/** Body-type union used by playground requests. */
export type PlaygroundBodyType = 'json' | 'form' | 'raw' | 'none';

/** SDK language targets for code generation. */
export type SDKLanguage = 'typescript' | 'python' | 'go' | 'java' | 'csharp';

/** Payload returned by `executePlaygroundRequest`. */
export interface PlaygroundExecuteResult {
  request: unknown;
  response: {
    statusCode: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
    latencyMs: number;
  };
}

/** One entry of the per-request response history drawer. */
export interface PgHistoryEntry {
  id: string;
  statusCode: number;
  latencyMs: number;
  timestamp: string;
}
