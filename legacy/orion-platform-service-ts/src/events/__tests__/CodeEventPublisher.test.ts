/**
 * CodeEventPublisher 单元测试
 *
 * ARCH-010: Updated to use EventBusAdapter pattern
 */

let mockPublish: jest.Mock;
let mockIsAvailable: jest.Mock;
let mockGetConnectionState: jest.Mock;

jest.mock('../EventBusAdapter', () => ({
  EventBusAdapter: jest.fn(),
}));

import { CodeEventPublisher } from '../CodeEventPublisher';
import { EventBusAdapter } from '../EventBusAdapter';

describe('CodeEventPublisher', () => {
  let publisher: CodeEventPublisher;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPublish = jest.fn().mockResolvedValue({ success: true, eventId: 'mock-id', deliveryMode: 'jetstream' });
    mockIsAvailable = jest.fn().mockReturnValue(true);
    mockGetConnectionState = jest.fn().mockReturnValue('connected');

    (EventBusAdapter as jest.Mock).mockImplementation(() => ({
      publish: mockPublish,
      isAvailable: mockIsAvailable,
      getConnectionState: mockGetConnectionState,
      setEventBus: jest.fn(),
    }));

    publisher = new CodeEventPublisher({
      source: 'code-service',
      defaultTenantId: 'tenant-001',
      defaultUserId: 'user-001',
    });
  });

  describe('Publish Methods', () => {
    it('should publish code.pr.opened event', async () => {
      await publisher.publishPROpened({
        prId: 'pr-001',
        repoId: 'repo-001',
        author: 'developer-001',
        sourceBranch: 'feature/new-feature',
        targetBranch: 'main',
      });

      expect(mockPublish).toHaveBeenCalledWith(
        'code.pr.opened',
        expect.objectContaining({
          prId: 'pr-001',
          author: 'developer-001',
          timestamp: expect.any(String),
        }),
        expect.objectContaining({
          source: 'code-service',
          tenantId: 'tenant-001',
          userId: 'user-001',
        }),
      );
    });

    it('should publish code.pr.merged event', async () => {
      await publisher.publishPRMerged({
        prId: 'pr-001',
        repoId: 'repo-001',
        mergedBy: 'reviewer-001',
        targetBranch: 'main',
      });

      expect(mockPublish).toHaveBeenCalledWith(
        'code.pr.merged',
        expect.objectContaining({ prId: 'pr-001', mergedBy: 'reviewer-001' }),
        expect.any(Object),
      );
    });

    it('should publish code.pr.closed event', async () => {
      await publisher.publishPRClosed({
        prId: 'pr-001',
        repoId: 'repo-001',
        closedBy: 'developer-001',
      });

      expect(mockPublish).toHaveBeenCalledWith(
        'code.pr.closed',
        expect.objectContaining({ prId: 'pr-001' }),
        expect.any(Object),
      );
    });

    it('should publish code.pr.updated event', async () => {
      await publisher.publishPRUpdated({
        prId: 'pr-001',
        repoId: 'repo-001',
        updatedBy: 'developer-001',
        updateType: 'commits',
      });

      expect(mockPublish).toHaveBeenCalledWith(
        'code.pr.updated',
        expect.objectContaining({ prId: 'pr-001', updateType: 'commits' }),
        expect.any(Object),
      );
    });
  });

  describe('Extensions merge', () => {
    it('should merge custom extensions with defaults', async () => {
      await publisher.publishPROpened(
        { prId: 'pr-001', repoId: 'repo-001', author: 'dev', sourceBranch: 'feat', targetBranch: 'main' },
        { tenantId: 'custom-tenant', userId: 'custom-user', traceId: 'trace-abc', priority: 'high' },
      );

      expect(mockPublish).toHaveBeenCalledWith(
        'code.pr.opened',
        expect.any(Object),
        expect.objectContaining({ tenantId: 'custom-tenant', priority: 'high' }),
      );
    });
  });

  describe('Status methods', () => {
    it('should return adapter availability', () => {
      expect(publisher.isAvailable()).toBe(true);
    });

    it('should return adapter connection state', () => {
      expect(publisher.getConnectionState()).toBe('connected');
    });
  });

  describe('No EventBus', () => {
    it('should gracefully degrade when EventBus is not available', async () => {
      mockIsAvailable.mockReturnValue(false);
      mockPublish.mockResolvedValue({ success: false, deliveryMode: 'disabled' });

      const result = await publisher.publishPROpened({
        prId: 'pr-001',
        repoId: 'repo-001',
        author: 'developer-001',
        sourceBranch: 'feature/new-feature',
        targetBranch: 'main',
      });

      expect(result.success).toBe(false);
    });
  });
});
