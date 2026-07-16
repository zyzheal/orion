/**
 * SkillController 单元测试 - 增强版
 */
import { SkillController } from '../SkillController';

function createMockReply() {
  const reply: any = {
    code: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
  return reply;
}

describe('SkillController', () => {
  let controller: SkillController;
  let mockService: any;

  beforeEach(() => {
    mockService = {
      listSkills: jest.fn(),
      getSkill: jest.fn(),
      createSkill: jest.fn(),
      updateSkill: jest.fn(),
      deleteSkill: jest.fn(),
      listVersions: jest.fn(),
      addVersion: jest.fn(),
      install: jest.fn(),
      uninstall: jest.fn(),
      rate: jest.fn(),
      listInstances: jest.fn(),
      createInstance: jest.fn(),
      updateInstance: jest.fn(),
      deleteInstance: jest.fn(),
      executeSkill: jest.fn(),
      listExecutions: jest.fn(),
      listAllExecutions: jest.fn(),
      submitForReview: jest.fn(),
      approveSkill: jest.fn(),
      rejectSkill: jest.fn(),
      archiveSkill: jest.fn(),
      pendingReview: jest.fn(),
      getAuditLog: jest.fn(),
      getAllAuditLogs: jest.fn(),
    };
    controller = new SkillController(mockService);
  });

  describe('list', () => {
    it('should list skills with pagination', async () => {
      mockService.listSkills.mockResolvedValue({
        data: [{ id: 'sk-1', name: 'test-skill' }],
        total: 1, page: 1, totalPages: 1,
      });

      const request = { query: { page: '1', perPage: '20' } } as any;
      const reply = createMockReply();

      await controller.list(request, reply);

      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.any(Array),
        total: 1,
      }));
    });

    it('should handle tags filter', async () => {
      mockService.listSkills.mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 0 });

      const request = { query: { tags: 'dev,ops' } } as any;
      const reply = createMockReply();

      await controller.list(request, reply);

      expect(mockService.listSkills).toHaveBeenCalledWith(expect.objectContaining({
        tags: ['dev', 'ops'],
      }));
    });

    it('should return 500 on service error', async () => {
      mockService.listSkills.mockRejectedValue(new Error('db error'));

      const request = { query: {} } as any;
      const reply = createMockReply();

      await controller.list(request, reply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getDetail', () => {
    it('should return skill by id', async () => {
      mockService.getSkill.mockResolvedValue({ id: 'sk-1', name: 'test-skill' });

      const request = { params: { id: 'sk-1' } } as any;
      const reply = createMockReply();

      await controller.getDetail(request, reply);

      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ id: 'sk-1' }),
      }));
    });

    it('should return 500 on service error', async () => {
      mockService.getSkill.mockRejectedValue(new Error('not found'));

      const request = { params: { id: 'missing' } } as any;
      const reply = createMockReply();

      await controller.getDetail(request, reply);

      expect(reply.status).toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('should create skill successfully', async () => {
      mockService.createSkill.mockResolvedValue({ id: 'sk-1', name: 'new-skill' });

      const request = {
        body: {
          name: 'new-skill', version: '1.0.0', description: 'desc',
          category: 'automation', author: 'user-1',
        },
      } as any;
      const reply = createMockReply();

      await controller.create(request, reply);

      expect(reply.status).toHaveBeenCalledWith(201);
      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ id: 'sk-1' }),
      }));
    });

    it('should return 400 for missing required fields', async () => {
      const request = { body: { name: 'skill' } } as any;
      const reply = createMockReply();

      await controller.create(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('required'),
      }));
    });
  });

  describe('update', () => {
    it('should update skill successfully', async () => {
      mockService.updateSkill.mockResolvedValue({ id: 'sk-1', name: 'updated' });

      const request = {
        params: { id: 'sk-1' },
        body: { description: 'updated description' },
      } as any;
      const reply = createMockReply();

      await controller.update(request, reply);

      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ id: 'sk-1' }),
      }));
    });
  });

  describe('delete', () => {
    it('should delete skill successfully', async () => {
      mockService.uninstallSkill = jest.fn().mockResolvedValue(true);

      const request = { params: { id: 'sk-1' } } as any;
      const reply = createMockReply();

      await controller.delete(request, reply);

      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: 'Skill deleted',
      }));
    });

    it('should return 404 when skill not found', async () => {
      mockService.uninstallSkill = jest.fn().mockResolvedValue(false);

      const request = { params: { id: 'missing' } } as any;
      const reply = createMockReply();

      await controller.delete(request, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
    });
  });

  describe('install', () => {
    it('should install skill', async () => {
      mockService.install.mockResolvedValue({ id: 'inst-1' });

      const request = {
        params: { id: 'sk-1' },
        body: { tenantId: 't-1', userId: 'u-1' },
      } as any;
      const reply = createMockReply();

      await controller.install(request, reply);

      expect(reply.send).toHaveBeenCalled();
    });
  });

  describe('rate', () => {
    it('should rate skill', async () => {
      mockService.rate.mockResolvedValue({ id: 'sk-1', rating: 4.5 });

      const request = {
        params: { id: 'sk-1' },
        body: { userId: 'u-1', rating: 5, review: 'Great!' },
      } as any;
      const reply = createMockReply();

      await controller.rate(request, reply);

      expect(reply.send).toHaveBeenCalled();
    });
  });

  describe('executeSkill', () => {
    it('should execute skill', async () => {
      mockService.executeSkill.mockResolvedValue({ id: 'exec-1', status: 'running' });

      const request = {
        params: { id: 'sk-1' },
        body: { input: {} },
      } as any;
      const reply = createMockReply();

      await controller.executeSkill(request, reply);

      expect(reply.send).toHaveBeenCalled();
    });
  });
});
