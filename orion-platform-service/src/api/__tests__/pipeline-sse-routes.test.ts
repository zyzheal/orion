/**
 * @file Tests for SSE publish endpoint authentication
 * Verifies: unauthenticated requests are rejected, authenticated requests succeed
 */

import { FastifyInstance } from 'fastify';
import { PipelineLogSSEService } from '../../services/pipeline/PipelineLogSSEService';
import { EventEmitter } from 'events';

async function buildSSEApp(): Promise<FastifyInstance> {
  const fastify = (await import('fastify')).default();
  const localBus = new EventEmitter();
  const sse = new PipelineLogSSEService(localBus);

  const registerPipelineSSERoutes = (await import('../pipeline-sse-routes')).default;
  await fastify.register(registerPipelineSSERoutes, { pipelineLogSSE: sse });

  return fastify;
}

describe('SSE publish endpoints auth', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.SSE_PUBLISH_SECRET = 'test-sse-secret';
    app = await buildSSEApp();
  });

  afterAll(async () => {
    await app.close();
    delete process.env.SSE_PUBLISH_SECRET;
  });

  test('POST /publish/log without auth returns 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/pipelines/sse/publish/log',
      payload: { pipelineId: '1', runId: '1', stageId: '1', logLine: 'test' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual(
      expect.objectContaining({ error: 'UNAUTHORIZED' })
    );
  });

  test('POST /publish/status without auth returns 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/pipelines/sse/publish/status',
      payload: { pipelineId: '1', runId: '1', status: 'running' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual(
      expect.objectContaining({ error: 'UNAUTHORIZED' })
    );
  });

  test('POST /publish/log with correct secret returns 200', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/pipelines/sse/publish/log',
      headers: { 'x-sse-secret': 'test-sse-secret' },
      payload: { pipelineId: '1', runId: '1', stageId: '1', logLine: 'test log' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(expect.objectContaining({ success: true }));
  });

  test('POST /publish/status with correct secret returns 200', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/pipelines/sse/publish/status',
      headers: { 'x-sse-secret': 'test-sse-secret' },
      payload: { pipelineId: '1', runId: '1', status: 'running' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(expect.objectContaining({ success: true }));
  });

  test('POST /publish/log with wrong secret returns 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/pipelines/sse/publish/log',
      headers: { 'x-sse-secret': 'wrong-secret' },
      payload: { pipelineId: '1', runId: '1', stageId: '1', logLine: 'test' },
    });
    expect(res.statusCode).toBe(401);
  });
});
