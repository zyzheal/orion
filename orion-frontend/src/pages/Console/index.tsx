/**
 * 控制台首页 - 管理员专用
 * 功能：系统概览统计卡片 + 快速导航到管理页面
 *
 * 2025-05-18: 从静态数据迁移到真实API调用
 * - 插件: 使用 plugins API
 * - 系统配置: 使用 feature-flags API
 *
 * 2026-05-19: 精简为纯仪表盘页面，插件管理/系统配置/用户管理
 * 已拆分至独立子页面，通过菜单或快捷入口访问
 *
 * 2026-07-04: 新增 Phase 6 服务治理模块快速导航
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Tag,
  Space,
  Button,
  Typography,
  Row,
  Col,
  Statistic,
  Progress,
  message,
  Alert,
  Spin,
} from 'antd';
import {
  ControlOutlined,
  AppstoreOutlined,
  SettingOutlined,
  UserOutlined,
  SafetyCertificateOutlined,
  ReloadOutlined,
  GatewayOutlined,
  ClusterOutlined,
  HeartOutlined,
  ApartmentOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons';
import { colors, spacing, componentRadius } from '@/tokens';
import { getInstalledPlugins } from '@/api/plugins';
import { getFeatureFlags } from '@/api/feature-flags';

const { Title, Text } = Typography;

// ==================== 类型定义 ====================

interface ConsoleStats {
  totalPlugins: number;
  activePlugins: number;
  totalFlags: number;
  enabledFlags: number;
}

// ==================== 组件 ====================

const Console: React.FC = () => {
  // 数据状态
  const [stats, setStats] = useState<ConsoleStats>({
    totalPlugins: 0,
    activePlugins: 0,
    totalFlags: 0,
    enabledFlags: 0,
  });

  // 加载状态
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // 错误状态
  const [error, setError] = useState<string | null>(null);

  // ==================== 数据加载 ====================

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pluginsRes, flagsRes] = await Promise.all([
        getInstalledPlugins(),
        getFeatureFlags(),
      ]);
      const plugins = pluginsRes.data || [];
      const flags = flagsRes.data || [];
      setStats({
        totalPlugins: (plugins as any).length,
        activePlugins: (plugins as any).filter((p: any) => p.status === 'enabled').length,
        totalFlags: flags.length,
        enabledFlags: flags.filter((f: any) => f.enabled).length,
      });
    } catch (err) {
      console.error('加载控制台数据失败:', err);
      setError('部分数据加载失败，使用演示数据');
      setStats({
        totalPlugins: 5,
        activePlugins: 3,
        totalFlags: 8,
        enabledFlags: 6,
      });
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // ==================== 事件处理 ====================

  const handleRefresh = () => {
    setInitialLoading(true);
    loadStats();
    message.info('正在刷新数据...');
  };

  // ==================== 渲染 ====================

  if (initialLoading) {
    return (
      <div
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}
      >
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return (
    <div style={{ padding: 0 }}>
      {/* 页面标题 */}
      <div
        style={{
          marginBottom: spacing.lg,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <ControlOutlined style={{ marginRight: spacing[3], color: colors.purple[500] }} />
            系统控制台
          </Title>
          <Text type="secondary">管理系统插件、配置和功能开关</Text>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={handleRefresh}
          loading={loading}
        >
          刷新
        </Button>
      </div>

      {/* 错误提示 */}
      {error && (
        <Alert
          message="数据加载提示"
          description={error}
          type="warning"
          showIcon
          style={{ marginBottom: spacing.md }}
        />
      )}

      {/* 统计卡片区 */}
      <Row gutter={[16, 16]} style={{ marginBottom: spacing.lg }}>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable onClick={() => window.location.href = '/console/plugins'}>
            <Statistic
              title="已安装插件"
              value={stats.totalPlugins}
              prefix={<AppstoreOutlined />}
              valueStyle={{ color: colors.primary[500] }}
            />
            <Progress
              percent={stats.totalPlugins > 0 ? (stats.activePlugins / stats.totalPlugins) * 100 : 0}
              strokeColor={colors.primary[500]}
              size="small"
              style={{ marginTop: spacing[3] }}
              format={() => `${stats.activePlugins} 个运行中`}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable onClick={() => window.location.href = '/console/settings'}>
            <Statistic
              title="功能开关"
              value={stats.totalFlags}
              prefix={<SettingOutlined />}
              valueStyle={{ color: colors.purple[500] }}
            />
            <Progress
              percent={stats.totalFlags > 0 ? (stats.enabledFlags / stats.totalFlags) * 100 : 0}
              strokeColor={colors.purple[500]}
              size="small"
              style={{ marginTop: spacing[3] }}
              format={() => `${stats.enabledFlags} 个已启用`}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable onClick={() => window.location.href = '/console/users'}>
            <Statistic
              title="系统用户"
              value="-"
              prefix={<UserOutlined />}
              valueStyle={{ color: colors.primary[500] }}
            />
            <div style={{ marginTop: spacing.md }}>
              <Tag color="blue">管理用户 →</Tag>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="系统健康度"
              value={98}
              suffix="%"
              prefix={<SafetyCertificateOutlined />}
              valueStyle={{ color: colors.success[500] }}
            />
            <div style={{ marginTop: spacing.md }}>
              <Tag color="success">运行正常</Tag>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 快速导航 */}
      <Card title="快速导航">
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={8}>
            <Card
              hoverable
              onClick={() => window.location.href = '/console/plugins'}
              style={{ height: '100%' }}
            >
              <Space direction="vertical" size={8}>
                <AppstoreOutlined style={{ fontSize: 24, color: colors.primary[500] }} />
                <Text strong>插件管理</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  安装、配置和管理系统插件
                </Text>
              </Space>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Card
              hoverable
              onClick={() => window.location.href = '/console/settings'}
              style={{ height: '100%' }}
            >
              <Space direction="vertical" size={8}>
                <SettingOutlined style={{ fontSize: 24, color: colors.purple[500] }} />
                <Text strong>系统配置</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  功能开关、特性管理、配置治理
                </Text>
              </Space>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Card
              hoverable
              onClick={() => window.location.href = '/console/users'}
              style={{ height: '100%' }}
            >
              <Space direction="vertical" size={8}>
                <UserOutlined style={{ fontSize: 24, color: colors.info[500] }} />
                <Text strong>用户管理</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  用户、角色、权限管理
                </Text>
              </Space>
            </Card>
          </Col>
        </Row>
      </Card>

      {/* Phase 6 服务治理模块 */}
      <Card title="Phase 6 服务治理" style={{ marginTop: spacing.lg }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={8}>
            <Card
              hoverable
              onClick={() => window.location.href = '/service-registry'}
              style={{ height: '100%', borderRadius: componentRadius.card }}
            >
              <Space direction="vertical" size={8}>
                <ClusterOutlined style={{ fontSize: 24, color: colors.primary[500] }} />
                <Text strong>服务注册中心</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  服务注册、发现与健康状态管理
                </Text>
              </Space>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Card
              hoverable
              onClick={() => window.location.href = '/gateway-routes'}
              style={{ height: '100%', borderRadius: componentRadius.card }}
            >
              <Space direction="vertical" size={8}>
                <GatewayOutlined style={{ fontSize: 24, color: colors.purple[500] }} />
                <Text strong>网关路由管理</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  API Gateway 路由配置与流量管理
                </Text>
              </Space>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Card
              hoverable
              onClick={() => window.location.href = '/health-dashboard'}
              style={{ height: '100%', borderRadius: componentRadius.card }}
            >
              <Space direction="vertical" size={8}>
                <HeartOutlined style={{ fontSize: 24, color: colors.success[500] }} />
                <Text strong>健康仪表盘</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  系统健康 KPI、服务状态与告警趋势
                </Text>
              </Space>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Card
              hoverable
              onClick={() => window.location.href = '/service-topology'}
              style={{ height: '100%', borderRadius: componentRadius.card }}
            >
              <Space direction="vertical" size={8}>
                <ApartmentOutlined style={{ fontSize: 24, color: colors.info[500] }} />
                <Text strong>服务拓扑</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  服务依赖关系可视化与调用链追踪
                </Text>
              </Space>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Card
              hoverable
              onClick={() => window.location.href = '/version-management'}
              style={{ height: '100%', borderRadius: componentRadius.card }}
            >
              <Space direction="vertical" size={8}>
                <CloudUploadOutlined style={{ fontSize: 24, color: colors.primary[500] }} />
                <Text strong>版本管理</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Pipeline、制品和部署版本管理
                </Text>
              </Space>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Card
              hoverable
              onClick={() => window.location.href = '/traffic-governance'}
              style={{ height: '100%', borderRadius: componentRadius.card }}
            >
              <Space direction="vertical" size={8}>
                <ApartmentOutlined style={{ fontSize: 24, color: colors.warning[500] }} />
                <Text strong>流量治理</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  灰度发布和流量切分规则管理
                </Text>
              </Space>
            </Card>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default Console;
