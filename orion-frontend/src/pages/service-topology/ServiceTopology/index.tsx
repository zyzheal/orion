/**
 * Service Topology Page
 *
 * Displays service dependency topology using table + tag visualization.
 * - Full topology graph in a Card with node/edge counts
 * - Service selector to inspect a specific service's dependencies
 * - Dependency table with color-coded dependency types
 *
 * API: /api/v1/service-topology
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Typography, Card, Table, Tag, Space, Select, Button, message, Empty, Spin } from 'antd';
import { ClusterOutlined, ReloadOutlined } from '@ant-design/icons';
import type { TableColumn } from '@/components/Table';
import { serviceTopologyApi, type TopologyGraph, type TopologyEdge, type ServiceDependencies } from '@/api/service-topology';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

const DEPENDENCY_TYPE_COLORS: Record<string, string> = {
  database: colors.primary[500],
  cache: colors.success[500],
  queue: colors.warning[500],
  external: colors.purple[500],
  calls: colors.info[500],
};

const ServiceTopologyPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [topology, setTopology] = useState<TopologyGraph | null>(null);
  const [dependencies, setDependencies] = useState<ServiceDependencies | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | undefined>(undefined);

  const loadTopology = async () => {
    setLoading(true);
    try {
      const response = await serviceTopologyApi.getTopology();
      setTopology(response.data ?? null);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载服务拓扑失败');
    } finally {
      setLoading(false);
    }
  };

  const loadDependencies = async (serviceId: string) => {
    setLoading(true);
    try {
      const response = await serviceTopologyApi.getServiceDependencies(serviceId);
      setDependencies(response.data ?? null);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载服务依赖关系失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTopology();
  }, []);

  useEffect(() => {
    if (selectedServiceId) {
      loadDependencies(selectedServiceId);
    } else {
      setDependencies(null);
    }
  }, [selectedServiceId]);

  const handleRefresh = () => {
    if (selectedServiceId) {
      loadDependencies(selectedServiceId);
    } else {
      loadTopology();
    }
  };

  const handleServiceChange = (value: string) => {
    setSelectedServiceId(value);
  };

  const edgeTypeTag = (type: string) => {
    const color = DEPENDENCY_TYPE_COLORS[type] || colors.neutral[500];
    const label = type === 'calls' ? '调用' : type;
    return <Tag color={color}>{label}</Tag>;
  };

  const dependencyColumns: TableColumn<TopologyEdge>[] = useMemo(() => [
    {
      key: 'source',
      title: '源服务',
      dataIndex: 'source',
      width: '25%',
      render: (value: unknown) => <Text strong>{String(value)}</Text>,
    },
    {
      key: 'target',
      title: '目标服务',
      dataIndex: 'target',
      width: '25%',
      render: (value: unknown) => <Text>{String(value)}</Text>,
    },
    {
      key: 'type',
      title: '依赖类型',
      dataIndex: 'type',
      width: '15%',
      render: (value: unknown) => edgeTypeTag(String(value)),
    },
    {
      key: 'description',
      title: '描述',
      dataIndex: 'type',
      width: '35%',
      render: (value: unknown) => {
        const type = String(value);
        const descriptions: Record<string, string> = {
          database: '数据库依赖',
          cache: '缓存依赖',
          queue: '消息队列依赖',
          external: '外部服务依赖',
          calls: '服务间调用',
        };
        return <Text type="secondary">{descriptions[type] || '未知依赖类型'}</Text>;
      },
    },
  ], []);

  const subGraphEdges = dependencies
    ? dependencies.outgoingDependencies
        .filter((e) => e.direction === 'outgoing')
        .map((e) => ({
          key: `${e.source}-${e.target}-${e.type}`,
          source: e.source,
          target: e.target,
          type: e.type,
        }))
    : topology?.edges ?? [];

  const nodeOptions = useMemo(() => {
    if (!topology) return [];
    return topology.nodes.map((node) => ({
      label: node.name || node.id,
      value: node.id,
    }));
  }, [topology]);

  return (
    <div style={{ padding: 0 }}>
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing.lg,
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm, display: 'flex', alignItems: 'center' }}>
            <ClusterOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            服务拓扑
          </Title>
          <Text type="secondary">可视化服务间依赖关系与调用链路</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      {/* Topology Overview Card */}
      <Card
        title={
          <Space>
            <Text strong>拓扑总览</Text>
            {topology && (
              <Space size="small">
                <Tag color={colors.primary[500]}>{topology.nodes.length} 个服务</Tag>
                <Tag color={colors.info[500]}>{topology.edges.length} 条依赖</Tag>
              </Space>
            )}
          </Space>
        }
        style={{ marginBottom: spacing.lg }}
        styles={{ body: { padding: spacing.md } }}
      >
        <Spin spinning={loading && !topology}>
          {!topology && !loading ? (
            <Empty description="暂无拓扑数据" />
          ) : (
            <Space direction="vertical" style={{ width: '100%' }} size={spacing.md}>
              <Text type="secondary">
                当前注册服务共 <Text strong>{topology?.nodes.length ?? 0}</Text> 个，
                依赖关系共 <Text strong>{topology?.edges.length ?? 0}</Text> 条。
              </Text>

              {/* Service selector */}
              <div>
                <Text style={{ display: 'block', marginBottom: spacing.sm, fontWeight: 500 }}>
                  选择服务查看子拓扑
                </Text>
                <Select
                  style={{ width: 320 }}
                  placeholder="请选择要查看的服务"
                  allowClear
                  onChange={handleServiceChange}
                  options={nodeOptions}
                  showSearch
                  optionFilterProp="label"
                />
              </div>
            </Space>
          )}
        </Spin>
      </Card>

      {/* Dependencies Card */}
      <Card
        title={
          <Space>
            <Text strong>
              {selectedServiceId ? '服务依赖详情' : '依赖关系总览'}
            </Text>
          </Space>
        }
        styles={{ body: { padding: 0 } }}
      >
        <Spin spinning={loading && !dependencies && selectedServiceId !== undefined}>
          {subGraphEdges.length === 0 ? (
            <div style={{ textAlign: 'center', padding: spacing.xxl }}>
              <Empty description={selectedServiceId ? '该服务暂无依赖数据' : '暂无依赖数据'} />
            </div>
          ) : (
            <Table
              columns={dependencyColumns}
              dataSource={subGraphEdges}
              loading={loading && selectedServiceId !== undefined}
              rowKey="key"
              size="middle"
              pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
            />
          )}
        </Spin>
      </Card>
    </div>
  );
};

export default ServiceTopologyPage;
