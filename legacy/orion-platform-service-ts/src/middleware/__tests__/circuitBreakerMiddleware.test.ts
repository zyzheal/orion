/**
 * @file Tests for circuit breaker middleware
 * Verifies: fail-closed behavior when circuit breaker state check fails
 */

import { registerCircuitBreakerMiddleware } from '../circuitBreakerMiddleware';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// Mock circuit breaker service
const mockCircuitBreakerService = {
  getState: jest.fn(),
};

const createMockFastify = () => {
  const hooks: Array<{ name: string; fn: Function }> = [];
  const mockFastify = {
    addHook: (name: string, fn: Function) => {
      hooks.push({ name, fn });
    },
    log: {
      warn: jest.fn(),
      error: jest.fn(),
    },
  } as unknown as FastifyInstance;
  return { fastify: mockFastify, hooks };
};

const createMockRequest = (url: string, method: string = 'GET') =>
  ({ url, method, log: { warn: jest.fn(), error: jest.fn() } }) as unknown as FastifyRequest;

const createMockReply = () => {
  const sendMock = jest.fn();
  const reply: any = {
    code: jest.fn(() => ({ send: sendMock })),
    send: sendMock,
    header: jest.fn(),
  };
  return { reply, headers: {} as Record<string, string> };
};

describe('registerCircuitBreakerMiddleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset getState to a no-return default so resolvedValueOnce works cleanly
    mockCircuitBreakerService.getState.mockReset();
  });

  test('returns 503 when circuit breaker state check throws', async () => {
    const { fastify, hooks } = createMockFastify();
    mockCircuitBreakerService.getState.mockRejectedValueOnce(new Error('DB connection failed'));

    await registerCircuitBreakerMiddleware(fastify, {
      circuitBreakerService: mockCircuitBreakerService as any,
      targets: [{ pathPrefix: '/api/v1/github', targetKey: 'scm:github' }],
    });

    const preHandler = hooks.find(h => h.name === 'preHandler');
    expect(preHandler).toBeDefined();

    const req = createMockRequest('/api/v1/github/repos');
    const { reply } = createMockReply();

    await preHandler!.fn(req, reply);

    expect(reply.code).toHaveBeenCalledWith(503);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'CIRCUIT_CHECK_FAILED',
        }),
      })
    );
    expect(req.log.error).toHaveBeenCalled();
  });

  test('allows request through when no matching target', async () => {
    const { fastify, hooks } = createMockFastify();
    mockCircuitBreakerService.getState.mockResolvedValueOnce({ state: 'closed' });

    await registerCircuitBreakerMiddleware(fastify, {
      circuitBreakerService: mockCircuitBreakerService as any,
      targets: [{ pathPrefix: '/api/v1/github', targetKey: 'scm:github' }],
    });

    const preHandler = hooks.find(h => h.name === 'preHandler');
    const req = createMockRequest('/api/v1/other');
    const { reply } = createMockReply();

    await preHandler!.fn(req, reply);

    expect(reply.code).not.toHaveBeenCalled();
    expect(mockCircuitBreakerService.getState).not.toHaveBeenCalled();
  });

  test('returns 503 when circuit is open', async () => {
    const { fastify, hooks } = createMockFastify();
    mockCircuitBreakerService.getState.mockResolvedValueOnce({
      state: 'open',
      config: { recoveryTimeoutMs: 30000 },
    });

    await registerCircuitBreakerMiddleware(fastify, {
      circuitBreakerService: mockCircuitBreakerService as any,
      targets: [{ pathPrefix: '/api/v1/github', targetKey: 'scm:github' }],
    });

    const preHandler = hooks.find(h => h.name === 'preHandler');
    const req = createMockRequest('/api/v1/github/repos');
    const { reply } = createMockReply();

    await preHandler!.fn(req, reply);

    expect(reply.code).toHaveBeenCalledWith(503);
    expect(reply.header).toHaveBeenCalledWith('Retry-After', 30);
    expect(reply.header).toHaveBeenCalledWith('X-Circuit-Breaker-State', 'open');
  });
});
