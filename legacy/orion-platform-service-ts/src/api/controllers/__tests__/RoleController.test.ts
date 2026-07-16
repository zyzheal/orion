/**
 * RoleController 单元测试 - 增强版
 */
import { RoleController } from '../RoleController';

function createMockReply() {
  const reply: any = {
    code: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
  return reply;
}

describe('RoleController', () => {
  let controller: RoleController;
  let mockService: any;

  beforeEach(() => {
    mockService = {
      listRoles: jest.fn(),
      getRole: jest.fn(),
      createRole: jest.fn(),
      deleteRole: jest.fn(),
      updateRole: jest.fn(),
    };
    controller = new RoleController(mockService);
  });

  describe('list', () => {
    it('should list roles for tenant', async () => {
      mockService.listRoles.mockResolvedValue([
        { id: 'r-1', name: 'admin' },
        { id: 'r-2', name: 'viewer' },
      ]);

      const request = { query: { tenantId: 't-1' } } as any;
      const reply = createMockReply();

      await controller.list(request, reply);

      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.any(Array),
        total: 2,
      }));
    });

    it('should return 400 for missing tenantId', async () => {
      const request = { query: {} } as any;
      const reply = createMockReply();

      await controller.list(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('tenantId'),
      }));
    });

    it('should return 500 on service error', async () => {
      mockService.listRoles.mockRejectedValue(new Error('db error'));

      const request = { query: { tenantId: 't-1' } } as any;
      const reply = createMockReply();

      await controller.list(request, reply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getDetail', () => {
    it('should return role by id', async () => {
      mockService.getRole.mockResolvedValue({ id: 'r-1', name: 'admin' });

      const request = { params: { id: 'r-1' } } as any;
      const reply = createMockReply();

      await controller.getDetail(request, reply);

      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ id: 'r-1' }),
      }));
    });

    it('should return 500 on service error', async () => {
      mockService.getRole.mockRejectedValue(new Error('not found'));

      const request = { params: { id: 'missing' } } as any;
      const reply = createMockReply();

      await controller.getDetail(request, reply);

      expect(reply.status).toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('should create role successfully', async () => {
      mockService.createRole.mockResolvedValue({ id: 'r-1', name: 'new-role' });

      const request = {
        body: { tenantId: 't-1', name: 'new-role' },
      } as any;
      const reply = createMockReply();

      await controller.create(request, reply);

      expect(reply.status).toHaveBeenCalledWith(201);
      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ id: 'r-1' }),
      }));
    });

    it('should return 400 for missing tenantId', async () => {
      const request = { body: { name: 'role' } } as any;
      const reply = createMockReply();

      await controller.create(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for missing name', async () => {
      const request = { body: { tenantId: 't-1' } } as any;
      const reply = createMockReply();

      await controller.create(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
    });
  });

  describe('delete', () => {
    it('should delete role successfully', async () => {
      mockService.deleteRole.mockResolvedValue(true);

      const request = { params: { id: 'r-1' } } as any;
      const reply = createMockReply();

      await controller.delete(request, reply);

      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: 'Role deleted',
      }));
    });

    it('should return 404 when role not found', async () => {
      mockService.deleteRole.mockResolvedValue(false);

      const request = { params: { id: 'missing' } } as any;
      const reply = createMockReply();

      await controller.delete(request, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
    });
  });

  describe('update', () => {
    it('should update role successfully', async () => {
      mockService.updateRole.mockResolvedValue({ id: 'r-1', name: 'updated-role' });

      const request = {
        params: { id: 'r-1' },
        body: { name: 'updated-role', description: 'Updated description' },
      } as any;
      const reply = createMockReply();

      await controller.update(request, reply);

      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        id: 'r-1',
        name: 'updated-role',
      }));
    });

    it('should return 500 on service error', async () => {
      mockService.updateRole.mockRejectedValue(new Error('update failed'));

      const request = { params: { id: 'r-1' }, body: {} } as any;
      const reply = createMockReply();

      await controller.update(request, reply);

      expect(reply.status).toHaveBeenCalled();
    });
  });
});
