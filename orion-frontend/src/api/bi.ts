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
  return api.get<ExecutiveDashboardData>(
    '/api/v1/ticketing/bi/dashboard/executive',
    { params }
  );
}

/**
 * Fetch manager dashboard team data
 */
export function getManagerDashboard(params?: { teamId?: string; days?: number }) {
  return api.get<ManagerDashboardData>(
    '/api/v1/ticketing/bi/dashboard/manager',
    { params }
  );
}

/**
 * Fetch engineer personal dashboard data
 */
export function getEngineerDashboard(engineerId: string, params?: { days?: number }) {
  return api.get<EngineerDashboardData>(
    `/api/v1/ticketing/bi/dashboard/engineer/${engineerId}`,
    { params }
  );
}

/**
 * Fetch efficiency score for an engineer
 */
export function getEfficiencyScore(
  engineerId: string,
  params?: { start?: string; end?: string }
) {
  return api.get(`/api/v1/ticketing/bi/score/${engineerId}`, { params });
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
  return api.post('/api/v1/ticketing/bi/export', data);
}
