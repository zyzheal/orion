import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DigitalTwinService } from '../services/DigitalTwinService';

const service = new DigitalTwinService();

export async function digitalTwinRoutes(fastify: FastifyInstance): Promise<void> {
  // Register twin
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.headers as { tenantId: string };
    const body = request.body as any;
    const twin = await service.registerTwin(tenantId, body);
    return reply.code(201).send(twin);
  });

  // List twins
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.headers as { tenantId: string };
    const twins = await service.listTwins({ tenantId });
    return twins;
  });

  // Get twin state
  fastify.get('/:id/state', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const state = await service.getTwinState(id);
    if (!state) return reply.code(404).send({ error: 'Twin not found' });
    return state;
  });

  // Create snapshot
  fastify.post('/:id/snapshot', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { tenantId } = request.headers as { tenantId: string };
    const snapshot = await service.createSnapshot(id, tenantId);
    return reply.code(201).send(snapshot);
  });

  // Create sandbox
  fastify.post('/sandbox', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.headers as { tenantId: string };
    const body = request.body as any;
    const sandbox = await service.createSandbox(tenantId, body);
    return reply.code(201).send(sandbox);
  });

  // List sandboxes
  fastify.get('/sandbox', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.headers as { tenantId: string };
    return service.listSandboxes(tenantId);
  });

  // Stop sandbox
  fastify.post('/sandbox/:id/stop', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { tenantId } = request.headers as { tenantId: string };
    return service.stopSandbox(id, tenantId);
  });

  // Destroy sandbox
  fastify.delete('/sandbox/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { tenantId } = request.headers as { tenantId: string };
    await service.destroySandbox(id, tenantId);
    return reply.code(204).send();
  });

  // Sandbox health
  fastify.get('/sandbox/:id/health', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    return service.getSandboxHealth(id);
  });

  // Record traffic
  fastify.post('/:id/record', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { tenantId } = request.headers as { tenantId: string };
    const body = request.body as any;
    const record = await service.recordTraffic(id, tenantId, body);
    return reply.code(201).send(record);
  });

  // Start recording session
  fastify.post('/:id/recordings/start', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { tenantId } = request.headers as { tenantId: string };
    const session = await service.startRecordingSession(id, tenantId);
    return reply.code(201).send(session);
  });

  // List recording sessions
  fastify.get('/:id/recordings', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    return service.listRecordingSessions(id);
  });

  // Stop recording session
  fastify.post('/recordings/:recordingId/stop', async (request: FastifyRequest, reply: FastifyReply) => {
    const { recordingId } = request.params as { recordingId: string };
    const { tenantId } = request.headers as { tenantId: string };
    return service.stopRecordingSession(recordingId, tenantId);
  });

  // Pause recording session
  fastify.post('/recordings/:recordingId/pause', async (request: FastifyRequest, reply: FastifyReply) => {
    const { recordingId } = request.params as { recordingId: string };
    const { tenantId } = request.headers as { tenantId: string };
    return service.pauseRecordingSession(recordingId, tenantId);
  });

  // Get recording detail
  fastify.get('/recordings/:recordingId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { recordingId } = request.params as { recordingId: string };
    const detail = await service.getRecordingDetail(recordingId);
    if (!detail) return reply.code(404).send({ error: 'Recording not found' });
    return detail;
  });

  // Get recording records
  fastify.get('/recordings/:recordingId/records', async (request: FastifyRequest, reply: FastifyReply) => {
    const { recordingId } = request.params as { recordingId: string };
    return service.getRecordingRecords(recordingId);
  });

  // Replay traffic
  fastify.post('/:id/replay', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { tenantId } = request.headers as { tenantId: string };
    const body = request.body as any;
    return service.replayTraffic(id, tenantId, body.records || []);
  });

  // Start replay session
  fastify.post('/:id/replay/start', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { tenantId } = request.headers as { tenantId: string };
    const body = request.body as any;
    const session = await service.startReplaySession(id, tenantId, body.recordingId, body.speedMultiplier);
    return reply.code(201).send(session);
  });

  // List replay sessions
  fastify.get('/:id/replay', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    return service.listReplaySessions(id);
  });

  // Get replay status
  fastify.get('/replay/:replayId/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const { replayId } = request.params as { replayId: string };
    const status = await service.getReplayStatus(replayId);
    if (!status) return reply.code(404).send({ error: 'Replay not found' });
    return status;
  });

  // Get replay report
  fastify.get('/replay/:replayId/report', async (request: FastifyRequest, reply: FastifyReply) => {
    const { replayId } = request.params as { replayId: string };
    const report = await service.getReplayReport(replayId);
    if (!report) return reply.code(404).send({ error: 'Report not found' });
    return report;
  });

  // Cancel replay
  fastify.post('/replay/:replayId/cancel', async (request: FastifyRequest, reply: FastifyReply) => {
    const { replayId } = request.params as { replayId: string };
    const { tenantId } = request.headers as { tenantId: string };
    return service.cancelReplay(replayId, tenantId);
  });
}
