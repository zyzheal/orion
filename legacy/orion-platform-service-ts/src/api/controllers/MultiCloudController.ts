/**
 * MultiCloudController - 多云管理 API 控制器
 *
 * NOTE: This controller is deprecated. Routes in multi-cloud-routes.ts
 * directly use MultiCloudManagerService / MultiCloudRepository (PostgreSQL).
 * The Maps below were in-memory storage that is no longer executed.
 * Kept for reference during migration audit.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from './BaseController';
import { OrionError } from '../../errors';

export class MultiCloudController extends BaseController {
  // DEPRECATED: Maps removed - routes use MultiCloudManagerService directly
  // private cloudAccounts = new Map<string, CloudAccount>();
  // private resources = new Map<string, CloudResource>();

  // DEPRECATED: All methods below removed - routes use MultiCloudManagerService directly
}
