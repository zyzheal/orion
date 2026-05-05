/**
 * Digital Twin API Routes (Enhanced Phase 4)
 *
 * Routes under /v1/digital-twins
 * Enhanced with recording session management, replay controls, and sandbox lifecycle.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DigitalTwinController } from './controllers/DigitalTwinController';

const controller = new DigitalTwinController();

export default async function digitalTwinRoutes(app: FastifyInstance): Promise<void> {
  // POST /v1/digital-twins - Register twin
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.registerTwin(request, reply);
  });

  // GET /v1/digital-twins - List twins
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listTwins(request, reply);
  });

  // GET /v1/digital-twins/:id/state - Get twin state
  app.get('/:id/state', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getTwinState(request, reply);
  });

  // POST /v1/digital-twins/:id/snapshot - Create snapshot
  app.post('/:id/snapshot', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createSnapshot(request, reply);
  });

  // ==================== Sandbox Management ====================

  // POST /v1/digital-twins/sandbox - Create sandbox
  app.post('/sandbox', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createSandbox(request, reply);
  });

  // GET /v1/digital-twins/sandbox - List sandboxes
  app.get('/sandbox', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listSandboxes(request, reply);
  });

  // POST /v1/digital-twins/sandbox/:id/stop - Stop sandbox
  app.post('/sandbox/:id/stop', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.stopSandbox(request, reply);
  });

  // DELETE /v1/digital-twins/sandbox/:id - Destroy sandbox
  app.delete('/sandbox/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.destroySandbox(request, reply);
  });

  // GET /v1/digital-twins/sandbox/:id/health - Health check
  app.get('/sandbox/:id/health', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getSandboxHealth(request, reply);
  });

  // ==================== Traffic Recording ====================

  // POST /v1/digital-twins/:id/record - Record traffic (legacy)
  app.post('/:id/record', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.recordTraffic(request, reply);
  });

  // POST /v1/digital-twins/:id/recordings/start - Start recording session
  app.post('/:id/recordings/start', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.startRecording(request, reply);
  });

  // GET /v1/digital-twins/:id/recordings - List recording sessions
  app.get('/:id/recordings', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listRecordings(request, reply);
  });

  // POST /v1/digital-twins/recordings/:recordingId/stop - Stop recording session
  app.post('/recordings/:recordingId/stop', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.stopRecording(request, reply);
  });

  // POST /v1/digital-twins/recordings/:recordingId/pause - Pause recording session
  app.post('/recordings/:recordingId/pause', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.pauseRecording(request, reply);
  });

  // GET /v1/digital-twins/recordings/:recordingId - Get recording detail
  app.get('/recordings/:recordingId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getRecordingDetail(request, reply);
  });

  // GET /v1/digital-twins/recordings/:recordingId/records - Get recording records
  app.get('/recordings/:recordingId/records', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getRecordingRecords(request, reply);
  });

  // ==================== Traffic Replay ====================

  // POST /v1/digital-twins/:id/replay - Replay traffic (legacy)
  app.post('/:id/replay', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.replayTraffic(request, reply);
  });

  // POST /v1/digital-twins/:id/replay/start - Start replay session
  app.post('/:id/replay/start', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.startReplay(request, reply);
  });

  // GET /v1/digital-twins/:id/replay - List replay sessions
  app.get('/:id/replay', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listReplays(request, reply);
  });

  // GET /v1/digital-twins/replay/:replayId/status - Get replay status
  app.get('/replay/:replayId/status', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getReplayStatus(request, reply);
  });

  // GET /v1/digital-twins/replay/:replayId/report - Get replay report
  app.get('/replay/:replayId/report', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getReplayReport(request, reply);
  });

  // POST /v1/digital-twins/replay/:replayId/cancel - Cancel replay session
  app.post('/replay/:replayId/cancel', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.cancelReplay(request, reply);
  });
}
