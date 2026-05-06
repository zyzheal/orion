/**
 * Module Manager API Client
 *
 * Backend routes: orion-platform-service/src/api/module-routes.ts
 * Base path: /api/v1/system/modules
 */

import { api } from './client';

// ============================================================================
// Types (match backend ModuleDescriptor and related types)
// ============================================================================

export type ModuleState = 'registered' | 'starting' | 'active' | 'stopping' | 'stopped' | 'failed';
export type ModuleLevel = 'core' | 'domain' | 'service' | 'feature';

export interface ModuleConfig {
  enabled: boolean;
  autoStart?: boolean;
  dependencies?: string[];
  priority?: number;
}

export interface ModuleDescriptor {
  id: string;
  name: string;
  description: string;
  level: ModuleLevel;
  domain?: string;
  state: ModuleState;
  config: ModuleConfig;
  routePrefix?: string;
  error?: string;
}

export interface DependencyValidationResult {
  valid: boolean;
  missingDependencies: string[];
  circularDependencies?: string[][];
}

export interface ModuleStatusResponse {
  modules: ModuleDescriptor[];
  total: number;
  active: number;
  failed: number;
}

export interface ValidationResponse {
  validation: DependencyValidationResult;
}

export interface StartupOrderResponse {
  order: string[];
}

export interface ModuleDetailResponse {
  module: ModuleDescriptor;
}

export interface ToggleModuleResponse {
  module: ModuleDescriptor;
}

// ============================================================================
// API Functions
// ============================================================================

/** List all modules with their status */
export async function getModules() {
  return api.get<ModuleDescriptor[]>('/v1/system/modules');
}

/** Get single module detail */
export async function getModule(id: string) {
  return api.get<ModuleDetailResponse>(`/v1/system/modules/${id}`);
}

/** Enable or disable a module */
export async function toggleModule(id: string, enabled: boolean) {
  return api.put<ToggleModuleResponse>(`/v1/system/modules/${id}/toggle`, { enabled });
}

/** Validate module dependencies */
export async function validateDependencies() {
  return api.get<ValidationResponse>('/v1/system/modules/validate');
}

/** Get module startup order (topological sort) */
export async function getStartupOrder() {
  return api.get<StartupOrderResponse>('/v1/system/modules/startup-order');
}
