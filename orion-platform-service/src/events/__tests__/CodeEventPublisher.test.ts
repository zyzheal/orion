/**
 * CodeEventPublisher 单元测试
 */

import { CodeEventPublisher } from '../CodeEventPublisher';

// 模拟 EventBus
class MockEventBus {
  public publishedEvents: any[] = [];

  async publish(subject: string, data: any, options?: any): Promise<string> {
    const event = {
      specversion: '1.0',
      id: `event-${Date.now()}`,
      type: subject,
      source: 'orion-platform-service',
      time: new Date().toISOString(),
      data: data,
      ...options?.extensions,
    };
    this.publishedEvents.push({ subject, data: event, options });
    return 'mock-event-id';
  }

  isHealthy(): boolean {
    return true;
  }
}

describe('CodeEventPublisher', () => {
  let publisher: CodeEventPublisher;
  let mockEventBus: MockEventBus;

  beforeEach(() => {
    mockEventBus = new MockEventBus();
    publisher = new CodeEventPublisher({
      eventBus: mockEventBus,
      source: 'orion-platform-service',
      defaultTenantId: 'tenant-001',
      defaultUserId: 'user-001',
    });
  });

  afterEach(() => {
    mockEventBus.publishedEvents = [];
  });

  describe('CloudEvents 1.0 合规性', () => {
    it('发布的事件应包含所有必需字段', async () => {
      await publisher.publishPROpened({
        prId: 'pr-001',
        repoId: 'repo-001',
        author: 'developer-001',
        sourceBranch: 'feature/new-feature',
        targetBranch: 'main',
      });

      const event = mockEventBus.publishedEvents[0];
      expect(event.data.specversion).toBe('1.0');
      expect(event.data.id).toBeDefined();
      expect(event.data.type).toBe('code.pr.opened');
      expect(event.data.source).toBe('orion-platform-service');
      expect(event.data.time).toBeDefined();
      expect(event.data.data).toBeDefined();
    });

    it('发布的事件应包含扩展属性', async () => {
      await publisher.publishPROpened(
        {
          prId: 'pr-001',
          repoId: 'repo-001',
          author: 'developer-001',
          sourceBranch: 'feature/new-feature',
          targetBranch: 'main',
        },
        {
          tenantId: 'tenant-001',
          userId: 'user-001',
          traceId: 'trace-abc',
        }
      );

      const event = mockEventBus.publishedEvents[0];
      expect(event.data.tenantId).toBe('tenant-001');
      expect(event.data.userId).toBe('user-001');
      expect(event.data.traceId).toBe('trace-abc');
    });

    it('应使用默认的租户和用户 ID', async () => {
      await publisher.publishPROpened({
        prId: 'pr-001',
        repoId: 'repo-001',
        author: 'developer-001',
        sourceBranch: 'feature/new-feature',
        targetBranch: 'main',
      });

      const event = mockEventBus.publishedEvents[0];
      expect(event.data.tenantId).toBe('tenant-001');
      expect(event.data.userId).toBe('user-001');
      expect(event.data.traceId).toBeDefined();
    });
  });

  describe('PR 事件', () => {
    it('发布 code.pr.opened 事件', async () => {
      await publisher.publishPROpened({
        prId: 'pr-001',
        repoId: 'repo-001',
        author: 'developer-001',
        sourceBranch: 'feature/new-feature',
        targetBranch: 'main',
        title: 'Add new feature',
        description: 'This PR adds a new feature',
      });

      expect(mockEventBus.publishedEvents).toHaveLength(1);
      const event = mockEventBus.publishedEvents[0];
      expect(event.subject).toBe('code.pr.opened');
      expect(event.data.data.prId).toBe('pr-001');
      expect(event.data.data.repoId).toBe('repo-001');
      expect(event.data.data.author).toBe('developer-001');
      expect(event.data.data.sourceBranch).toBe('feature/new-feature');
      expect(event.data.data.targetBranch).toBe('main');
      expect(event.data.data.title).toBe('Add new feature');
      expect(event.data.data.timestamp).toBeDefined();
    });

    it('发布 code.pr.merged 事件', async () => {
      await publisher.publishPRMerged({
        prId: 'pr-001',
        repoId: 'repo-001',
        mergedBy: 'reviewer-001',
        targetBranch: 'main',
        mergeCommitSha: 'abc123def456',
      });

      expect(mockEventBus.publishedEvents).toHaveLength(1);
      const event = mockEventBus.publishedEvents[0];
      expect(event.subject).toBe('code.pr.merged');
      expect(event.data.data.prId).toBe('pr-001');
      expect(event.data.data.repoId).toBe('repo-001');
      expect(event.data.data.mergedBy).toBe('reviewer-001');
      expect(event.data.data.targetBranch).toBe('main');
      expect(event.data.data.mergeCommitSha).toBe('abc123def456');
      expect(event.data.data.timestamp).toBeDefined();
    });

    it('发布 code.pr.closed 事件', async () => {
      await publisher.publishPRClosed({
        prId: 'pr-001',
        repoId: 'repo-001',
        closedBy: 'developer-001',
        reason: 'Changes not needed',
      });

      expect(mockEventBus.publishedEvents).toHaveLength(1);
      const event = mockEventBus.publishedEvents[0];
      expect(event.subject).toBe('code.pr.closed');
      expect(event.data.data.prId).toBe('pr-001');
      expect(event.data.data.closedBy).toBe('developer-001');
      expect(event.data.data.reason).toBe('Changes not needed');
      expect(event.data.data.timestamp).toBeDefined();
    });

    it('发布 code.pr.updated 事件', async () => {
      await publisher.publishPRUpdated({
        prId: 'pr-001',
        repoId: 'repo-001',
        updatedBy: 'developer-001',
        updateType: 'commits',
      });

      expect(mockEventBus.publishedEvents).toHaveLength(1);
      const event = mockEventBus.publishedEvents[0];
      expect(event.subject).toBe('code.pr.updated');
      expect(event.data.data.prId).toBe('pr-001');
      expect(event.data.data.updatedBy).toBe('developer-001');
      expect(event.data.data.updateType).toBe('commits');
      expect(event.data.data.timestamp).toBeDefined();
    });
  });

  describe('事件数据类型验证', () => {
    it('PR Opened 事件应包含所有必需字段', async () => {
      await publisher.publishPROpened({
        prId: 'pr-001',
        repoId: 'repo-001',
        author: 'developer-001',
        sourceBranch: 'feature/new-feature',
        targetBranch: 'main',
      });

      const event = mockEventBus.publishedEvents[0];
      expect(event.data.data).toHaveProperty('prId');
      expect(event.data.data).toHaveProperty('repoId');
      expect(event.data.data).toHaveProperty('author');
      expect(event.data.data).toHaveProperty('sourceBranch');
      expect(event.data.data).toHaveProperty('targetBranch');
      expect(event.data.data).toHaveProperty('timestamp');
    });

    it('PR Merged 事件应包含所有必需字段', async () => {
      await publisher.publishPRMerged({
        prId: 'pr-001',
        repoId: 'repo-001',
        mergedBy: 'reviewer-001',
        targetBranch: 'main',
      });

      const event = mockEventBus.publishedEvents[0];
      expect(event.data.data).toHaveProperty('prId');
      expect(event.data.data).toHaveProperty('repoId');
      expect(event.data.data).toHaveProperty('mergedBy');
      expect(event.data.data).toHaveProperty('targetBranch');
      expect(event.data.data).toHaveProperty('timestamp');
    });
  });

  describe('无 EventBus 时的行为', () => {
    it('EventBus 未连接时应优雅降级', async () => {
      const publisherWithoutBus = new CodeEventPublisher();

      // 不应抛出错误
      await expect(
        publisherWithoutBus.publishPROpened({
          prId: 'pr-001',
          repoId: 'repo-001',
          author: 'developer-001',
          sourceBranch: 'feature/new-feature',
          targetBranch: 'main',
        })
      ).resolves.not.toThrow();
    });
  });

  describe('setEventBus 和 getEventBus', () => {
    it('应该能够动态设置和获取 EventBus', () => {
      const newPublisher = new CodeEventPublisher();
      expect(newPublisher.getEventBus()).toBeNull();

      newPublisher.setEventBus(mockEventBus);
      expect(newPublisher.getEventBus()).toBe(mockEventBus);
    });
  });
});