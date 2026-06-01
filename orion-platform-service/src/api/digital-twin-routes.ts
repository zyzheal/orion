/**
 * Digital Twin API Routes (Enhanced Phase 4)
 *
 * Routes under /v1/digital-twins
 * Enhanced with recording session management, replay controls, and sandbox lifecycle.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DigitalTwinController } from './controllers/DigitalTwinController';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { DatabasePool } from '../services/database';

interface DigitalTwinRoutesOptions {
  database?: DatabasePool;
}

export default async function digitalTwinRoutes(
  app: FastifyInstance,
  options: DigitalTwinRoutesOptions = {}
): Promise<void> {
  const controller = new DigitalTwinController();
  // POST /v1/digital-twins - Register twin
  app.post('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.registerTwin(request, reply);
  });

  // GET /v1/digital-twins - List twins
  app.get('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listTwins(request, reply);
  });

  // GET /v1/digital-twins/:id/state - Get twin state
  app.get('/:id/state', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getTwinState(request, reply);
  });

  // POST /v1/digital-twins/:id/snapshot - Create snapshot
  app.post('/:id/snapshot', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createSnapshot(request, reply);
  });

  // ==================== Sandbox Management ====================

  // POST /v1/digital-twins/sandbox - Create sandbox
  app.post('/sandbox', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createSandbox(request, reply);
  });

  // GET /v1/digital-twins/sandbox - List sandboxes
  app.get('/sandbox', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listSandboxes(request, reply);
  });

  // POST /v1/digital-twins/sandbox/:id/stop - Stop sandbox
  app.post('/sandbox/:id/stop', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.stopSandbox(request, reply);
  });

  // DELETE /v1/digital-twins/sandbox/:id - Destroy sandbox
  app.delete('/sandbox/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.destroySandbox(request, reply);
  });

  // GET /v1/digital-twins/sandbox/:id/health - Health check
  app.get('/sandbox/:id/health', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getSandboxHealth(request, reply);
  });

  // ==================== Traffic Recording ====================

  // POST /v1/digital-twins/:id/record - Record traffic (legacy)
  app.post('/:id/record', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.recordTraffic(request, reply);
  });

  // POST /v1/digital-twins/:id/recordings/start - Start recording session
  app.post('/:id/recordings/start', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.startRecording(request, reply);
  });

  // GET /v1/digital-twins/:id/recordings - List recording sessions
  app.get('/:id/recordings', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listRecordings(request, reply);
  });

  // POST /v1/digital-twins/recordings/:recordingId/stop - Stop recording session
  app.post('/recordings/:recordingId/stop', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.stopRecording(request, reply);
  });

  // POST /v1/digital-twins/recordings/:recordingId/pause - Pause recording session
  app.post('/recordings/:recordingId/pause', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.pauseRecording(request, reply);
  });

  // GET /v1/digital-twins/recordings/:recordingId - Get recording detail
  app.get('/recordings/:recordingId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getRecordingDetail(request, reply);
  });

  // GET /v1/digital-twins/recordings/:recordingId/records - Get recording records
  app.get('/recordings/:recordingId/records', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getRecordingRecords(request, reply);
  });

  // ==================== Traffic Replay ====================

  // POST /v1/digital-twins/:id/replay - Replay traffic (legacy)
  app.post('/:id/replay', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.replayTraffic(request, reply);
  });

  // POST /v1/digital-twins/:id/replay/start - Start replay session
  app.post('/:id/replay/start', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.startReplay(request, reply);
  });

  // GET /v1/digital-twins/:id/replay - List replay sessions
  app.get('/:id/replay', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listReplays(request, reply);
  });

  // GET /v1/digital-twins/replay/:replayId/status - Get replay status
  app.get('/replay/:replayId/status', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getReplayStatus(request, reply);
  });

  // GET /v1/digital-twins/replay/:replayId/report - Get replay report
  app.get('/replay/:replayId/report', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getReplayReport(request, reply);
  });

  // POST /v1/digital-twins/replay/:replayId/cancel - Cancel replay session
  app.post('/replay/:replayId/cancel', {
    onRequest: [authenticateUser, requirePermission({ resource: 'digital-twin', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.cancelReplay(request, reply);
  });
}
