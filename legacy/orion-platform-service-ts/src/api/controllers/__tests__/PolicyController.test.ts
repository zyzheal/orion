/**
 * PolicyController 单元测试 - 增强版
 */
import { PolicyController } from '../PolicyController';

function createMockReply() {
  const reply: any = {
    code: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
  return reply;
}

describe('PolicyController', () => {
  let controller: PolicyController;
  let mockPolicyService: any;

  beforeEach(() => {
    mockPolicyService = {
      listPolicies: jest.fn(),
      getPolicy: jest.fn(),
      createPolicy: jest.fn(),
      updatePolicy: jest.fn(),
      deletePolicy: jest.fn(),
      evaluate: jest.fn(),
      getEvaluationHistory: jest.fn(),
    };
    controller = new PolicyController(mockPolicyService);
  });

  describe('listPolicies', () => {
    it('should list policies', async () => {
      mockPolicyService.listPolicies.mockResolvedValue({
        policies: [{ id: 'pol-1', name: 'test-policy' }],
        total: 1,
      });

      const request = { query: { tenantId: 't-1' } } as any;
      const reply = createMockReply();

      await controller.listPolicies(request, reply);

      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.any(Array),
        total: 1,
      }));
    });

    it('should return 500 on service error', async () => {
      mockPolicyService.listPolicies.mockRejectedValue(new Error('db error'));

      const request = { query: {} } as any;
      const reply = createMockReply();

      await controller.listPolicies(request, reply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getPolicy', () => {
    it('should return policy by id', async () => {
      mockPolicyService.getPolicy.mockResolvedValue({ id: 'pol-1', name: 'test-policy' });

      const request = { params: { id: 'pol-1' } } as any;
      const reply = createMockReply();

      await controller.getPolicy(request, reply);

      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ id: 'pol-1' }),
      }));
    });

    it('should return 404 when policy not found', async () => {
      mockPolicyService.getPolicy.mockRejectedValue(new Error('Policy not found: missing'));

      const request = { params: { id: 'missing' } } as any;
      const reply = createMockReply();

      await controller.getPolicy(request, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
    });
  });

  describe('createPolicy', () => {
    it('should create policy successfully', async () => {
      mockPolicyService.createPolicy.mockResolvedValue({ id: 'pol-1', name: 'new-policy' });

      const request = {
        body: { name: 'new-policy', category: 'security', regoPath: '/policies/test.rego' },
      } as any;
      const reply = createMockReply();

      await controller.createPolicy(request, reply);

      expect(reply.status).toHaveBeenCalledWith(201);
      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ id: 'pol-1' }),
      }));
    });

    it('should return 400 for missing required fields', async () => {
      const request = { body: { name: 'policy' } } as any;
      const reply = createMockReply();

      await controller.createPolicy(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('required'),
      }));
    });
  });

  describe('updatePolicy', () => {
    it('should update policy successfully', async () => {
      mockPolicyService.updatePolicy.mockResolvedValue({ id: 'pol-1', name: 'updated' });

      const request = {
        params: { id: 'pol-1' },
        body: { description: 'updated' },
      } as any;
      const reply = createMockReply();

      await controller.updatePolicy(request, reply);

      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ id: 'pol-1' }),
      }));
    });
  });

  describe('deletePolicy', () => {
    it('should delete policy successfully', async () => {
      mockPolicyService.deletePolicy.mockResolvedValue(true);

      const request = { params: { id: 'pol-1' } } as any;
      const reply = createMockReply();

      await controller.deletePolicy(request, reply);

      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: 'Policy deleted',
      }));
    });

    it('should return 404 when policy not found', async () => {
      mockPolicyService.deletePolicy.mockResolvedValue(false);

      const request = { params: { id: 'missing' } } as any;
      const reply = createMockReply();

      await controller.deletePolicy(request, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
    });
  });

  describe('evaluatePolicy', () => {
    it('should evaluate policy', async () => {
      mockPolicyService.evaluate.mockResolvedValue({ allowed: true, reason: 'ok' });

      const request = {
        body: { tenantId: 't-1', resourceType: 'pipeline', resourceId: 'p-1', action: 'execute' },
      } as any;
      const reply = createMockReply();

      await controller.evaluatePolicy(request, reply);

      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ allowed: true }),
      }));
    });
  });

  describe('getEvaluationHistory', () => {
    it('should return evaluation history', async () => {
      mockPolicyService.getEvaluationHistory.mockResolvedValue([
        { id: 'eval-1', policyId: 'pol-1', result: 'allow' },
      ]);

      const request = { query: { tenantId: 't-1' } } as any;
      const reply = createMockReply();

      await controller.getEvaluationHistory(request, reply);

      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.any(Array),
      }));
    });
  });
});
