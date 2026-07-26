import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app';

// Integration test scaffold

describe('Application', () => {
  it('should create app instance', async () => {
    const app = await createApp();
    expect(app).toBeDefined();
    await app.close();
  });

  it('should respond to GET /health', async () => {
    const app = await createApp();
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveProperty('status', 'ok');
    expect(body).toHaveProperty('uptime');
    await app.close();
  });

  it('should respond to GET /', async () => {
    const app = await createApp();
    const response = await app.inject({
      method: 'GET',
      url: '/',
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveProperty('name', 'orion-agent-svc');
    await app.close();
  });

  it.todo('should apply rate limiting');
  it.todo('should apply CORS headers');
});
