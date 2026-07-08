/**
 * ChannelIngressService Tests
 */
import { ChannelIngressService } from '../ChannelIngressService';

jest.mock('../../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
  getCurrentTraceId: () => 'test-trace-123',
}));

const mockChannelRepo = {
  findById: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockMessageRepo = {
  create: jest.fn(),
  updateStatus: jest.fn(),
  findAll: jest.fn(),
  getByChannel: jest.fn(),
};

describe('ChannelIngressService', () => {
  let service: ChannelIngressService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ChannelIngressService(mockChannelRepo as any, mockMessageRepo as any);
  });

  describe('getChannel', () => {
    it('should return channel when found', async () => {
      mockChannelRepo.findById.mockResolvedValue({ id: 'ch-1', name: 'Email' });
      const result = await service.getChannel('ch-1');
      expect(result.id).toBe('ch-1');
    });

    it('should throw when not found', async () => {
      mockChannelRepo.findById.mockResolvedValue(null);
      await expect(service.getChannel('missing')).rejects.toThrow('not found');
    });
  });

  describe('createChannel', () => {
    it('should create channel with user info', async () => {
      mockChannelRepo.create.mockResolvedValue({ id: 'ch-1', name: 'Slack' });
      const result = await service.createChannel({ name: 'Slack', channel_type: 'slack', config: {} } as any, 'user-1');
      expect(mockChannelRepo.create).toHaveBeenCalledWith(expect.objectContaining({ created_by: 'user-1' }));
    });
  });

  describe('processInbound', () => {
    it('should create inbound message for enabled channel', async () => {
      mockChannelRepo.findById.mockResolvedValue({ id: 'ch-1', enabled: true, channel_type: 'email' });
      mockMessageRepo.create.mockResolvedValue({ id: 'm-1', channel_id: 'ch-1', direction: 'inbound' });

      const result = await service.processInbound('ch-1', { from: 'user@test.com', body: 'Help needed' });
      expect(result.id).toBe('m-1');
      expect(mockMessageRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        channel_id: 'ch-1', direction: 'inbound', status: 'received',
      }));
    });

    it('should throw when channel not found or disabled', async () => {
      mockChannelRepo.findById.mockResolvedValue(null);
      await expect(service.processInbound('missing', {})).rejects.toThrow('not found or disabled');
    });
  });

  describe('testChannel', () => {
    it('should send test message and return success', async () => {
      mockChannelRepo.findById.mockResolvedValue({ id: 'ch-1', name: 'Email' });
      mockMessageRepo.create.mockResolvedValue({ id: 'm-1' });

      const result = await service.testChannel('ch-1');
      expect(result.success).toBe(true);
      expect(result.message).toContain('Email');
    });
  });
});
