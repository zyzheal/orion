/**
 * ServiceHealthTab
 * 服务健康 Tab（抽取自 ObservabilityPage.tsx）
 */
import React, { useState, useEffect } from 'react';
import {
  Table,
  Tag,
  Button,
  message,
  Progress,
  Typography,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import {
  getServiceHealth,
  type ServiceHealth,
} from '@/api/observability';
import { healthColorMap } from './constants';

const { Text } = Typography;

export const ServiceHealthTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<ServiceHealth[]>([]);

  const loadHealth = async () => {
    setLoading(true);
    try {
      const res = await getServiceHealth();
      setServices(res.data?.services || []);
    } catch (error: unknown) {
      message.error(`加载服务健康状态失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHealth();
  }, []);

  const columns = [
    {
      title: '服务名称',
      dataIndex: 'serviceName',
      key: 'serviceName',
      width: 180,
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: '健康状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (v: string) => (
        <Tag color={healthColorMap[v]}>
          {v === 'healthy' ? '健康' : v === 'degraded' ? '降级' : '不可用'}
        </Tag>
      ),
    },
    {
      title: 'P50 延迟',
      key: 'p50',
      width: 100,
      render: (_: unknown, r: ServiceHealth) => `${r.latencyP50}ms`,
    },
    {
      title: 'P95 延迟',
      key: 'p95',
      width: 100,
      render: (_: unknown, r: ServiceHealth) => `${r.latencyP95}ms`,
    },
    {
      title: 'P99 延迟',
      key: 'p99',
      width: 100,
      render: (_: unknown, r: ServiceHealth) => `${r.latencyP99}ms`,
    },
    {
      title: '错误率',
      key: 'errorRate',
      width: 100,
      render: (_: unknown, r: ServiceHealth) => (
        <Text style={{ color: r.errorRate > 5 ? colors.error[400] : colors.success[500] }}>
          {r.errorRate.toFixed(2)}%
        </Text>
      ),
    },
    {
      title: '请求速率',
      key: 'requestRate',
      width: 120,
      render: (_: unknown, r: ServiceHealth) => `${r.requestRate.toFixed(1)} req/s`,
    },
    {
      title: '饱和度',
      key: 'saturation',
      width: 120,
      render: (_: unknown, r: ServiceHealth) => (
        <Progress
          percent={Math.round(r.saturation)}
          size="small"
          strokeColor={r.saturation > 80 ? colors.error[400] : colors.success[500]}
          style={{ width: 80 }}
        />
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: spacing.md, display: 'flex', justifyContent: 'space-between' }}>
        <Text type="secondary">查看各服务的健康状态和关键指标</Text>
        <Button icon={<ReloadOutlined />} onClick={loadHealth} loading={loading}>
          刷新
        </Button>
      </div>
      <Table
        columns={columns}
        dataSource={services}
        rowKey="serviceName"
        loading={loading}
        size="middle"
        pagination={{ pageSize: 15 }}
      />
    </div>
  );
};
