/**
 * Efficiency Service Routes Entry Point
 *
 * Central route registry for orion-efficiency-svc
 * Re-exports all efficiency-related routes under /api/v1/efficiency prefix
 *
 * Routes Overview:
 * - DORA Metrics: /dora/metrics, /dora/report, /dora/benchmarks
 * - ClickHouse: /clickhouse/status, /clickhouse/sync, /clickhouse/config
 * - Dashboard: /dashboard
 * - Reports: /reports/weekly/generate, /reports/weekly, /reports/weekly/history
 * - Score: /score
 * - Export: /export
 * - Teams: /teams, /compare
 * - Enhanced: /metrics, /trends, /team-performance
 *
 * Prefix: /api/v1/efficiency
 */

import { FastifyInstance } from 'fastify';
import { DatabasePool } from '../utils/database';
import efficiencyRoutes from './efficiency';
import efficiencyEnhancedRoutes from './efficiency-enhanced';

export interface EfficiencyRoutesOptions {
  database?: DatabasePool;
}

/**
 * Register all efficiency service routes
 * Combines both efficiency.ts and efficiency-enhanced.ts routes
 */
export async function registerEfficiencyRoutes(
  app: FastifyInstance,
  options: EfficiencyRoutesOptions = {}
): Promise<void> {
  // Register base efficiency routes (DORA, dashboard, reports, etc.)
  await app.register(efficiencyRoutes, { database: options.database });

  // Register enhanced efficiency routes (additional analytics)
  await app.register(efficiencyEnhancedRoutes);
}

export default registerEfficiencyRoutes;