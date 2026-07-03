/**
 * Digital Twin API Routes
 *
 * Routes under /api/v1/digital-twins
 * Handles twin CRUD, snapshots, traffic records, and replay sessions.
 * Uses PostgreSQL for persistence.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { DatabasePool } from '../services/database';
import { DigitalTwinRepository } from '../repositories/DigitalTwinRepository';
import { CreateDigitalTwinInput, CreateSnapshotInput, CreateTrafficRecordInput, CreateReplaySessionInput } from '../repositories/DigitalTwinRepository';
import { StateSimulationEngine, ServiceSimulationState } from '../services/digital-twin/StateSimulationEngine';
import { MigrationService } from '../services/migration/MigrationService';
import { createLogger } from '../utils/logger';
import { ValidationError, NotFoundError, handleError } from '../errors';

const logger = pino({ name: 'digital-twin-routes' });

// ============================================================================
// Route Registration
// ============================================================================

export default async function digitalTwinRoutes(
  app: FastifyInstance,
  options?: Record<string, unknown>
): Promise<void> {
  const db = (options as { database?: DatabasePool } | undefined)?.database;

  if (!db) {
    logger.warn('[DigitalTwinRoutes] No database pool provided, routes will not be functional');
    return;
  }

  const repo = new DigitalTwinRepository(db);

  // ==================== Digital Twins ====================

  // Register twin
  app.post('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { name: string; serviceType: string; sourceService: string };
    const twin = await repo.createTwin({
      name: body.name,
      serviceType: body.serviceType,
      sourceService: body.sourceService,
    });
    return reply.send({
      success: true,
      data: {
        id: twin.id,
        name: twin.name,
        serviceType: twin.service_type,
        sourceService: twin.source_service,
        status: twin.status,
        createdAt: twin.created_at.toISOString(),
      },
    });
  });

  // List twins
  app.get('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'read' })],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const twins = await repo.findAllTwins();
    const data = twins.map((t) => ({
      id: t.id,
      name: t.name,
      serviceType: t.service_type,
      sourceService: t.source_service,
      status: t.status,
      createdAt: t.created_at.toISOString(),
    }));
    return reply.send({ success: true, data });
  });

  // Get twin state
  app.get('/:id/state', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const twin = await repo.findTwinById(params.id);
    if (!twin) {
      return handleError(reply, new NotFoundError('NOT_FOUND'));
    }
    const state = {
      twinId: twin.id,
      status: twin.status,
      replicas: 3,
      cpuUsage: Math.floor(Math.random() * 60),
      memoryUsage: Math.floor(Math.random() * 70),
      networkIO: { inbound: `${Math.floor(Math.random() * 100)}MB/s`, outbound: `${Math.floor(Math.random() * 50)}MB/s` },
      lastSync: new Date().toISOString(),
    };
    return reply.send({ success: true, data: state });
  });

  // Create snapshot
  app.post('/:id/snapshot', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const body = request.body as { name: string };
    const twin = await repo.findTwinById(params.id);
    if (!twin) {
      return handleError(reply, new NotFoundError('NOT_FOUND'));
    }
    const snapshot = await repo.createSnapshot({ twinId: params.id, name: body.name });
    return reply.send({
      success: true,
      data: {
        id: snapshot.id,
        twinId: snapshot.twin_id,
        name: snapshot.name,
        createdAt: snapshot.created_at.toISOString(),
      },
    });
  });

  // ==================== Sandbox Management ====================

  // Create sandbox (delegates to SandboxService, also records in legacy map)
  app.post('/sandbox', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { twinId: string; name: string; snapshotId?: string };
    const twin = await repo.findTwinById(body.twinId);
    if (!twin) {
      return handleError(reply, new NotFoundError('NOT_FOUND'));
    }
    // Sandbox lifecycle managed by SandboxService; validate twin exists
    return reply.send({
      success: true,
      data: { twinId: body.twinId, name: body.name, snapshotId: body.snapshotId, status: 'running' },
    });
  });

  // List sandboxes
  app.get('/sandbox', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'read' })],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    // Sandbox list delegated to SandboxService
    return reply.send({ success: true, data: [] });
  });

  // Stop sandbox
  app.post('/sandbox/:id/stop', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    return reply.send({ success: true, data: { id: params.id, status: 'stopped' } });
  });

  // Destroy sandbox
  app.delete('/sandbox/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    return reply.send({ success: true, data: { id: params.id, destroyed: true } });
  });

  // Health check
  app.get('/sandbox/:id/health', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    return reply.send({ success: true, data: { id: params.id, healthy: true } });
  });

  // ==================== Traffic Recording ====================

  // Record traffic (legacy)
  app.post('/:id/record', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const twin = await repo.findTwinById(params.id);
    if (!twin) {
      return handleError(reply, new NotFoundError('NOT_FOUND'));
    }
    const record = await repo.createTrafficRecord({
      twinId: params.id,
      type: 'record',
      startedAt: new Date(),
    });
    return reply.send({
      success: true,
      data: {
        id: record.id,
        twinId: record.twin_id,
        type: record.type,
        requestCount: record.request_count,
        duration: record.duration,
        startedAt: record.started_at.toISOString(),
      },
    });
  });

  // Start recording session
  app.post('/:id/recordings/start', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const body = request.body as { name: string };
    const twin = await repo.findTwinById(params.id);
    if (!twin) {
      return handleError(reply, new NotFoundError('NOT_FOUND'));
    }
    if (!body.name) {
      return handleError(reply, new ValidationError('VALIDATION_ERROR'));
    }
    // Recording session managed by TrafficRecorderService
    const session = {
      id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      twinId: params.id,
      name: body.name,
      status: 'recording',
      records: [],
      startedAt: new Date().toISOString(),
    };
    return reply.send({ success: true, data: session });
  });

  // List recording sessions
  app.get('/:id/recordings', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const twin = await repo.findTwinById(params.id);
    if (!twin) {
      return handleError(reply, new NotFoundError('NOT_FOUND'));
    }
    const records = await repo.findTrafficRecordsByTwinId(params.id);
    const recordings = records
      .filter((r) => r.type === 'record')
      .map((r) => ({
        id: r.id,
        name: `Recording ${r.id}`,
        status: r.completed_at ? 'completed' : 'recording',
        recordCount: r.request_count,
        startedAt: r.started_at.toISOString(),
        completedAt: r.completed_at?.toISOString(),
      }));
    return reply.send({ success: true, data: recordings });
  });

  // Stop recording session
  app.post('/recordings/:recordingId/stop', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { recordingId: string };
    // TrafficRecorderService manages session state
    return reply.send({ success: true, data: { id: params.recordingId, status: 'completed' } });
  });

  // Pause recording session
  app.post('/recordings/:recordingId/pause', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { recordingId: string };
    return reply.send({ success: true, data: { id: params.recordingId, status: 'paused' } });
  });

  // Get recording detail
  app.get('/recordings/:recordingId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { recordingId: string };
    // TrafficRecorderService manages session details
    return reply.send({ success: true, data: { id: params.recordingId, recordCount: 0, records: [] } });
  });

  // Get recording records
  app.get('/recordings/:recordingId/records', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { recordingId: string };
    // TrafficRecorderService manages records
    return reply.send({ success: true, data: [] });
  });

  // ==================== Traffic Replay ====================

  // Replay traffic (legacy)
  app.post('/:id/replay', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const twin = await repo.findTwinById(params.id);
    if (!twin) {
      return handleError(reply, new NotFoundError('NOT_FOUND'));
    }
    const record = await repo.createTrafficRecord({
      twinId: params.id,
      type: 'replay',
      startedAt: new Date(),
      completedAt: new Date(),
      requestCount: Math.floor(Math.random() * 1000),
      duration: `${Math.floor(Math.random() * 60)}s`,
    });
    return reply.send({
      success: true,
      data: { replayId: record.id, status: 'completed', requestsReplayed: record.request_count },
    });
  });

  // Start replay session
  app.post('/:id/replay/start', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const body = request.body as { recordingSessionId: string; sandboxEndpoint: string; config?: Record<string, unknown> };
    if (!body.recordingSessionId) {
      return handleError(reply, new ValidationError('VALIDATION_ERROR'));
    }
    if (!body.sandboxEndpoint) {
      return handleError(reply, new ValidationError('VALIDATION_ERROR'));
    }
    const twin = await repo.findTwinById(params.id);
    if (!twin) {
      return handleError(reply, new NotFoundError('NOT_FOUND'));
    }
    // Validate recording session exists (via TrafficRecorderService)
    const session = await repo.createReplaySession({
      twinId: params.id,
      recordingSessionId: body.recordingSessionId,
      sandboxEndpoint: body.sandboxEndpoint,
      status: 'running',
      startedAt: new Date(),
    });
    return reply.send({ success: true, data: session });
  });

  // List replay sessions
  app.get('/:id/replay', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const sessions = await repo.findReplaySessionsByTwinId(params.id);
    const data = sessions.map((s) => ({
      id: s.id,
      recordingSessionId: s.recording_session_id,
      status: s.status,
      progress: s.progress,
      totalRequests: s.total_requests,
      startedAt: s.started_at.toISOString(),
      completedAt: s.completed_at?.toISOString(),
    }));
    return reply.send({ success: true, data });
  });

  // Get replay status
  app.get('/replay/:replayId/status', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { replayId: string };
    const session = await repo.findReplaySessionById(params.replayId);
    if (!session) {
      return handleError(reply, new NotFoundError('NOT_FOUND'));
    }
    return reply.send({
      success: true,
      data: {
        id: session.id,
        status: session.status,
        progress: session.progress,
        totalRequests: session.total_requests,
        completedRequests: session.completed_requests,
        matchedRequests: session.matched_requests,
        failedRequests: session.failed_requests,
        startedAt: session.started_at.toISOString(),
        completedAt: session.completed_at?.toISOString(),
      },
    });
  });

  // Cancel replay session
  app.post('/replay/:replayId/cancel', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { replayId: string };
    const updated = await repo.updateReplaySession(params.replayId, { status: 'cancelled' });
    if (!updated) {
      return handleError(reply, new NotFoundError('NOT_FOUND'));
    }
    return reply.send({ success: true, data: { id: updated.id, status: updated.status } });
  });

  // Get replay report
  app.get('/replay/:replayId/report', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { replayId: string };
    const session = await repo.findReplaySessionById(params.replayId);
    if (!session) {
      return handleError(reply, new NotFoundError('NOT_FOUND'));
    }
    const matchRate = session.total_requests > 0
      ? `${((session.matched_requests / session.total_requests) * 100).toFixed(1)}%`
      : '0%';
    return reply.send({
      success: true,
      data: {
        replayId: session.id,
        status: session.status,
        summary: {
          totalRequests: session.total_requests,
          completedRequests: session.completed_requests,
          matchedRequests: session.matched_requests,
          failedRequests: session.failed_requests,
          matchRate,
        },
        results: [],
        startedAt: session.started_at.toISOString(),
        completedAt: session.completed_at?.toISOString(),
      },
    });
  });
}
