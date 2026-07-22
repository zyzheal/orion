/**
 * DigitalTwinController - DEPRECATED
 *
 * Routes in digital-twin-routes.ts directly use DigitalTwinRepository (PostgreSQL).
 * This controller has no active methods.
 */

import { BaseController } from './BaseController';

export class DigitalTwinController extends BaseController {
  // DEPRECATED: Maps removed - routes use DigitalTwinRepository directly
  // private twins = new Map<string, DigitalTwin>();
  // private sandboxes = new Map<string, Sandbox>();
  // private trafficRecords = new Map<string, TrafficRecord[]>();
  // private snapshots = new Map<string, ...[]>();
}
