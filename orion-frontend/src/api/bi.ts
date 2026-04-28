/**
 * BI Dashboard API Service
 * Provides endpoints for executive, manager, and engineer dashboard data,
 * efficiency scoring, and data export functionality.
 */

import { api } from './client';
import type {
  ExecutiveDashboardData,
  ManagerDashboardData,
  EngineerDashboardData,
} from '../types/pages';

/**
 * Fetch executive dashboard overview data
 */
export function getExecutiveDashboard(params?: { days?: number }) {
  return api.get<ExecutiveDashboardData>('/v1/efficiency/dashboard', { params });
}

/**
 * Fetch manager dashboard team data
 */
export function getManagerDashboard(params?: { teamId?: string; days?: number }) {
  return api.get<ManagerDashboardData>('/v1/efficiency/dashboard', { params });
}

/**
 * Fetch engineer personal dashboard data
 */
export function getEngineerDashboard(engineerId: string, params?: { days?: number }) {
  return api.get<EngineerDashboardData>(`/v1/efficiency/dashboard`, {
    params: { ...params, engineerId },
  });
}

/**
 * Fetch efficiency score for an engineer
 */
export function getEfficiencyScore(engineerId: string, params?: { start?: string; end?: string }) {
  return api.get(`/v1/efficiency/score`, { params: { ...params, engineerId } });
}

/**
 * Export BI data for a given dataset
 */
export function exportBIData(data: {
  dataset: string;
  granularity: string;
  start: string;
  end: string;
}) {
  return api.post('/v1/efficiency/export', data);
}
