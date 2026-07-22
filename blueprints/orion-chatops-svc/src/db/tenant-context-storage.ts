/**
 * Tenant Context Storage - AsyncLocalStorage stub for ChatOps service
 *
 * Simplified version without RLS integration for development.
 */

import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContextStore {
  dbClient: { query: (text: string, params?: any[]) => Promise<any> };
  tenantId: number;
  isSystemTenant?: boolean;
}

export const tenantContextStorage = new AsyncLocalStorage<TenantContextStore>();

export const SYSTEM_TENANT_ID = '__system__' as unknown as number;
