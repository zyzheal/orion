/**
 * FederationController - 多集群联邦 API 控制器
 *
 * NOTE: This controller is dead code. Federation routes are commented out
 * in routes.ts ("migrated to federation-svc"). All Maps and methods below
 * are never executed at runtime. Kept for reference during migration audit.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from './BaseController';
import { OrionError, ErrorCode } from '../../errors';

export class FederationController extends BaseController {
  // DEPRECATED: Maps removed - routes are commented out in routes.ts
  // private clusters = new Map<string, FederatedCluster>();
  // private jobs = new Map<string, CrossClusterJob>();

  // DEPRECATED: All methods below removed - routes are commented out in routes.ts
}
