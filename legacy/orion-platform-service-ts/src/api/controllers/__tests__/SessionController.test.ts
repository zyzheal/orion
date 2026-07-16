/**
 * SessionController 单元测试 - 增强版
 */
import { SessionController } from '../SessionController';

function createMockReply() {
  const reply: any = {
    code: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
  return reply;
}

describe('SessionController', () => {
  let controller: SessionController;
  let mockService: any;

  beforeEach(() => {
    mockService = {
      createSession: jest.fn(),
      verifyToken: jest.fn(),
      revokeSession: jest.fn(),
      cleanup: jest.fn(),
      listByUser: jest.fn(),
      refreshToken: jest.fn(),
    };
    controller = new SessionController(mockService);
  });

  describe('create', () => {
    it('should create session successfully', async () => {
      mockService.createSession.mockResolvedValue({
        session: { id: 's-1', user_id: 'u-1', tenant_id: 't-1', expires_at: '', created_at: '' },
        token: 'jwt-token-123',
      });

      const request = { body: { userId: 'u-1', tenantId: 't-1' } } as any;
      const reply = createMockReply();

      await controller.create(request, reply);

      expect(reply.status).toHaveBeenCalledWith(201);
      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          sessionId: 's-1',
          token: 'jwt-token-123',
        }),
      }));
    });

    it('should use custom expiresInHours', async () => {
      mockService.createSession.mockResolvedValue({
        session: { id: 's-1', user_id: 'u-1', tenant_id: 't-1', expires_at: '', created_at: '' },
        token: 'jwt-token',
      });

      const request = { body: { userId: 'u-1', tenantId: 't-1', expiresInHours: '48' } } as any;
      const reply = createMockReply();

      await controller.create(request, reply);

      expect(mockService.createSession).toHaveBeenCalledWith('u-1', 't-1', 48);
    });

    it('should return 400 for missing userId', async () => {
      const request = { body: { tenantId: 't-1' } } as any;
      const reply = createMockReply();

      await controller.create(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('required'),
      }));
    });

    it('should return 400 for missing tenantId', async () => {
      const request = { body: { userId: 'u-1' } } as any;
      const reply = createMockReply();

      await controller.create(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
    });

    it('should return 500 on service error', async () => {
      mockService.createSession.mockRejectedValue(new Error('db error'));

      const request = { body: { userId: 'u-1', tenantId: 't-1' } } as any;
      const reply = createMockReply();

      await controller.create(request, reply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });
  });

  describe('verify', () => {
    it('should verify token successfully', async () => {
      mockService.verifyToken.mockResolvedValue({
        id: 's-1', user_id: 'u-1', tenant_id: 't-1', expires_at: '',
      });

      const request = { body: { token: 'jwt-token' } } as any;
      const reply = createMockReply();

      await controller.verify(request, reply);

      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ sessionId: 's-1' }),
      }));
    });

    it('should return 400 for missing token', async () => {
      const request = { body: {} } as any;
      const reply = createMockReply();

      await controller.verify(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
    });

    it('should return 401 for invalid token', async () => {
      mockService.verifyToken.mockResolvedValue(null);

      const request = { body: { token: 'invalid' } } as any;
      const reply = createMockReply();

      await controller.verify(request, reply);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('Invalid'),
      }));
    });
  });

  describe('revoke', () => {
    it('should revoke session successfully', async () => {
      mockService.revokeSession.mockResolvedValue(true);

      const request = { params: { token: 'jwt-token' } } as any;
      const reply = createMockReply();

      await controller.revoke(request, reply);

      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: 'Session revoked',
      }));
    });

    it('should return 404 when session not found', async () => {
      mockService.revokeSession.mockResolvedValue(false);

      const request = { params: { token: 'invalid' } } as any;
      const reply = createMockReply();

      await controller.revoke(request, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
    });
  });

  describe('cleanup', () => {
    it('should cleanup expired sessions', async () => {
      mockService.cleanup.mockResolvedValue(5);

      const request = {} as any;
      const reply = createMockReply();

      await controller.cleanup(request, reply);

      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: { cleanedSessions: 5 },
        message: '5 expired sessions removed',
      }));
    });
  });

  describe('listByUser', () => {
    it('should list user sessions', async () => {
      mockService.listByUser.mockResolvedValue([
        { id: 's-1', user_id: 'u-1', tenant_id: 't-1', expires_at: '', created_at: '' },
      ]);

      const request = { params: { userId: 'u-1' }, query: {} } as any;
      const reply = createMockReply();

      await controller.listByUser(request, reply);

      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({ sessionId: 's-1' }),
        ]),
      }));
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      mockService.refreshToken.mockResolvedValue({
        id: 's-1', expires_at: new Date().toISOString(),
      });

      const request = {
        params: { token: 'old-token' },
        body: {},
      } as any;
      const reply = createMockReply();

      await controller.refreshToken(request, reply);

      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ sessionId: 's-1' }),
      }));
    });

    it('should return 404 when session not found', async () => {
      mockService.refreshToken.mockResolvedValue(null);

      const request = { params: { token: 'invalid' }, body: {} } as any;
      const reply = createMockReply();

      await controller.refreshToken(request, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
    });
  });
});
