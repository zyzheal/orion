/**
 * PluginMarketplaceService 单元测试
 */

import { PluginMarketplaceService } from '../PluginMarketplaceService';

// Mock DatabasePool
const mockPool = {
  query: jest.fn(),
};

describe('PluginMarketplaceService', () => {
  let service: PluginMarketplaceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PluginMarketplaceService(mockPool as any);
  });

  describe('listPlugins', () => {
    it('应该返回插件列表', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { id: 'p1', name: 'slack-integration' },
          { id: 'p2', name: 'jira-sync' },
        ],
      });

      const result = await service.listPlugins();

      expect(result.data.length).toBe(2);
    });

    it('应该支持按类别过滤', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'p1', category: 'integration' }],
      });

      const result = await service.listPlugins({ category: 'integration' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('category'),
        expect.arrayContaining(['integration'])
      );
    });

    it('应该支持按验证状态过滤', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'p1', verified: true }],
      });

      await service.listPlugins({ verified: true });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('verified ='),
        expect.any(Array)
      );
    });

    it('应该按下载量排序', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'p1' }],
      });

      await service.listPlugins();

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY downloads DESC'),
        expect.any(Array)
      );
    });
  });

  describe('getPlugin', () => {
    it('应该返回插件详情', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'p1',
          name: 'slack-integration',
          description: 'Slack notification plugin',
          author: 'orion',
          version: '1.0.0',
          rating: 4.5,
          downloads: 1000,
          verified: true,
        }],
      });

      const result = await service.getPlugin('p1');

      expect(result).not.toBeNull();
      expect(result!.name).toBe('slack-integration');
    });

    it('应该返回 null 如果未找到', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.getPlugin('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('installPlugin', () => {
    it('应该安装插件', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ id: 'p1', name: 'slack', version: '1.0.0' }],
        })
        .mockResolvedValueOnce({
          rows: [{
            id: 'i1',
            tenant_id: 'tenant1',
            plugin_id: 'p1',
            version: '1.0.0',
            status: 'installed',
          }],
        })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.installPlugin({
        tenant_id: 'tenant1',
        plugin_id: 'p1',
      });

      expect(result.status).toBe('installed');
    });

    it('应该拒绝不存在的插件', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.installPlugin({
        tenant_id: 'tenant1',
        plugin_id: 'nonexistent',
      })).rejects.toThrow('Plugin not found');
    });

    it('应该安装指定版本', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ id: 'p1', version: '2.0.0' }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 'i1', version: '1.5.0' }],
        })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.installPlugin({
        tenant_id: 'tenant1',
        plugin_id: 'p1',
        version: '1.5.0',
      });

      expect(result.version).toBe('1.5.0');
    });

    it('应该使用最新版本作为默认', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ id: 'p1', version: '2.0.0' }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 'i1', version: '2.0.0' }],
        })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.installPlugin({
        tenant_id: 'tenant1',
        plugin_id: 'p1',
      });

      expect(result.version).toBe('2.0.0');
    });

    it('应该增加下载计数', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ id: 'p1', version: '1.0.0' }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 'i1' }],
        })
        .mockResolvedValueOnce({ rows: [] });

      await service.installPlugin({
        tenant_id: 'tenant1',
        plugin_id: 'p1',
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('downloads = downloads + 1'),
        ['p1']
      );
    });
  });

  describe('uninstallPlugin', () => {
    it('应该卸载插件', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 1 });

      const result = await service.uninstallPlugin('tenant1', 'p1');

      expect(result.success).toBe(true);
    });

    it('应该返回 false 如果插件未安装', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0 });

      const result = await service.uninstallPlugin('tenant1', 'p1');

      expect(result.success).toBe(false);
    });
  });

  describe('reviewPlugin', () => {
    it('应该添加插件评价', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{
            id: 'r1',
            plugin_id: 'p1',
            user_id: 'user1',
            rating: 5,
            comment: 'Great plugin',
          }],
        })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.reviewPlugin({
        plugin_id: 'p1',
        user_id: 'user1',
        rating: 5,
        comment: 'Great plugin',
      });

      expect(result.rating).toBe(5);
    });

    it('应该支持 1-5 星评价', async () => {
      for (const rating of [1, 2, 3, 4, 5]) {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ id: 'r1', rating }] })
          .mockResolvedValueOnce({ rows: [] });

        const result = await service.reviewPlugin({
          plugin_id: 'p1',
          user_id: 'user1',
          rating,
        });

        expect(result.rating).toBe(rating);
      }
    });

    it('应该更新插件平均评分', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ id: 'r1' }],
        })
        .mockResolvedValueOnce({ rows: [] });

      await service.reviewPlugin({
        plugin_id: 'p1',
        user_id: 'user1',
        rating: 5,
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('AVG(rating)'),
        ['p1']
      );
    });

    it('应该支持可选评论', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ id: 'r1', comment: null }],
        })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.reviewPlugin({
        plugin_id: 'p1',
        user_id: 'user1',
        rating: 4,
      });

      expect(result.comment).toBeNull();
    });
  });

  describe('MarketplacePlugin', () => {
    it('应该包含完整的插件信息', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'p1',
          name: 'slack-integration',
          description: 'Slack plugin',
          author: 'orion',
          category: 'integration',
          version: '1.0.0',
          rating: 4.5,
          downloads: 1000,
          verified: true,
          price_cents: 0,
          created_at: new Date(),
        }],
      });

      const result = await service.getPlugin('p1');

      expect(result!.name).toBeDefined();
      expect(result!.author).toBeDefined();
      expect(result!.category).toBeDefined();
      expect(result!.rating).toBeDefined();
      expect(result!.downloads).toBeDefined();
      expect(result!.verified).toBeDefined();
    });
  });

  describe('PluginInstall', () => {
    it('应该包含安装信息', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ id: 'p1', version: '1.0.0' }],
        })
        .mockResolvedValueOnce({
          rows: [{
            id: 'i1',
            tenant_id: 'tenant1',
            plugin_id: 'p1',
            version: '1.0.0',
            status: 'installed',
            installed_at: new Date(),
          }],
        })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.installPlugin({
        tenant_id: 'tenant1',
        plugin_id: 'p1',
      });

      expect(result.tenant_id).toBe('tenant1');
      expect(result.plugin_id).toBe('p1');
      expect(result.installed_at).toBeDefined();
    });
  });

  describe('PluginReview', () => {
    it('应该包含评价信息', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{
            id: 'r1',
            plugin_id: 'p1',
            user_id: 'user1',
            rating: 5,
            comment: 'Excellent',
            created_at: new Date(),
          }],
        })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.reviewPlugin({
        plugin_id: 'p1',
        user_id: 'user1',
        rating: 5,
        comment: 'Excellent',
      });

      expect(result.plugin_id).toBe('p1');
      expect(result.user_id).toBe('user1');
      expect(result.created_at).toBeDefined();
    });
  });
});