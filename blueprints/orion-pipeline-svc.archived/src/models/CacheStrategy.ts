/**
 * CacheStrategy domain models
 *
 * Provides cache strategy configuration for pipeline dependency caching
 */

export type CacheType = 'npm' | 'pip' | 'maven' | 'gradle' | 'custom';

export interface CacheStrategy {
  id: string;
  tenantId: string;
  name: string;
  type: CacheType;
  keyTemplate: string;
  paths: string[];
  restoreKeys?: string[];
  maxAge: number; // seconds
  enabled: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CacheStrategyCreateInput {
  tenantId: string;
  name: string;
  type: CacheType;
  keyTemplate: string;
  paths: string[];
  restoreKeys?: string[];
  maxAge: number;
  enabled?: boolean;
  createdBy?: string;
}

export interface CacheStrategyUpdateInput {
  name?: string;
  keyTemplate?: string;
  paths?: string[];
  restoreKeys?: string[];
  maxAge?: number;
  enabled?: boolean;
}

export interface CacheStrategyFilter {
  tenantId: string;
  type?: CacheType;
  enabled?: boolean;
  page?: number;
  limit?: number;
}

export interface CacheStats {
  strategyId: string;
  hits: number;
  misses: number;
  hitRate: number;
  sizeBytes: number;
  lastHitAt?: Date;
  lastWarmAt?: Date;
}

export interface CacheRecommendation {
  type: CacheType;
  keyTemplate: string;
  paths: string[];
  restoreKeys: string[];
  maxAge: number;
  reason: string;
}