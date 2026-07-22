import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app.js';

describe('orion-monitor-svc', () => {
  it('health check returns ok', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    await app.close();
  });

  it('ready check returns ok', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/ready',
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it('create rule requires tenant header', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/monitoring/rules',
      payload: {
        name: 'test',
        ruleType: 'threshold',
        metricName: 'cpu',
        threshold: 80,
        comparison: 'gt',
      },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('create rule returns 201 with valid headers', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/monitoring/rules',
      headers: {
        'x-tenant-id': 't1',
        'x-project-id': 'p1',
        'x-user-id': 'u1',
      },
      payload: {
        name: 'high-cpu',
        ruleType: 'threshold',
        metricName: 'cpu_usage',
        threshold: 80,
        comparison: 'gt',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.name).toBe('high-cpu');
    expect(body.tenantId).toBe('t1');
    await app.close();
  });
});
