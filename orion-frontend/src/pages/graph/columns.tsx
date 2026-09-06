/**
 * Graph Page Column Definitions
 * Factory functions for the three tables rendered on the page:
 *   - Service Dependency table
 *   - Infrastructure Topology table
 *   - Impact Analysis table (directly + transitively impacted)
 */
import { Badge, Button, Space, Tag, Typography } from 'antd';
import { DeploymentUnitOutlined } from '@ant-design/icons';
import type { TableColumn } from '@/components/Table';
import { colors } from '@/tokens/colors';
import type {
  ServiceDependency,
  InfrastructureNode,
  ImpactNode,
} from '@/api/graph';
import {
  serviceStatusColorMap,
  serviceStatusLabelMap,
  infraTypeLabelMap,
  impactLevelColorMap,
  impactLevelLabelMap,
} from './config';

const { Text } = Typography;

// =============================================================================
// Service Dependency Columns
// =============================================================================

export interface ServiceColumnsHandlers {
  onSelectService: (id: string) => void;
}

export function buildServiceColumns(
  handlers: ServiceColumnsHandlers
): TableColumn<ServiceDependency>[] {
  const { onSelectService } = handlers;

  return [
    {
      key: 'id',
      title: '服务ID',
      dataIndex: 'id',
      width: 120,
      render: (v: unknown) => <Text code>{String(v).slice(0, 8)}</Text>,
    },
    {
      key: 'name',
      title: '服务名称',
      dataIndex: 'name',
      width: 180,
      render: (v: unknown) => (
        <Space>
          <DeploymentUnitOutlined style={{ color: colors.primary[500] }} />
          <Text strong>{String(v)}</Text>
        </Space>
      ),
    },
    {
      key: 'version',
      title: '版本',
      dataIndex: 'version',
      width: 100,
      render: (v: unknown) => <Text type="secondary">{v ? String(v) : '-'}</Text>,
    },
    {
      key: 'dependencies',
      title: '依赖数',
      dataIndex: 'dependencies',
      width: 80,
      render: (v: unknown) => <Text>{Array.isArray(v) ? v.length : 0}</Text>,
    },
    {
      key: 'dependents',
      title: '被依赖数',
      dataIndex: 'dependents',
      width: 80,
      render: (v: unknown) => <Text>{Array.isArray(v) ? v.length : 0}</Text>,
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: unknown) => (
        <Badge
          status={
            v === 'running'
              ? 'success'
              : v === 'stopped'
                ? 'error'
                : v === 'degraded'
                  ? 'warning'
                  : 'default'
          }
          text={serviceStatusLabelMap[v as ServiceDependency['status']]}
        />
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 100,
      render: (_: unknown, record: ServiceDependency) => (
        <Button type="link" size="small" onClick={() => onSelectService(record.id)}>
          详情
        </Button>
      ),
    },
  ];
}

// =============================================================================
// Infrastructure Topology Columns
// =============================================================================

export function buildInfraColumns(): TableColumn<InfrastructureNode>[] {
  return [
    {
      key: 'id',
      title: '节点ID',
      dataIndex: 'id',
      width: 120,
      render: (v: unknown) => <Text code>{String(v).slice(0, 8)}</Text>,
    },
    {
      key: 'type',
      title: '类型',
      dataIndex: 'type',
      width: 120,
      render: (v: unknown) => {
        const type = v as InfrastructureNode['type'];
        return <Tag color="blue">{infraTypeLabelMap[type] ?? type}</Tag>;
      },
    },
    {
      key: 'name',
      title: '名称',
      dataIndex: 'name',
      width: 180,
      render: (v: unknown) => <Text strong>{String(v)}</Text>,
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: unknown) => {
        const status = v as InfrastructureNode['status'];
        return (
          <Badge
            status={status === 'online' ? 'success' : status === 'offline' ? 'error' : 'warning'}
            text={status}
          />
        );
      },
    },
  ];
}

// =============================================================================
// Impact Analysis Columns
// =============================================================================

export function buildImpactColumns(): TableColumn<ImpactNode>[] {
  return [
    {
      key: 'service',
      title: '受影响服务',
      dataIndex: 'service',
      width: 200,
      render: (v: unknown) => {
        const svc = v as ServiceDependency;
        return <Text strong>{svc?.name ?? 'Unknown'}</Text>;
      },
    },
    {
      key: 'impactLevel',
      title: '影响级别',
      dataIndex: 'impactLevel',
      width: 100,
      render: (v: unknown) => {
        const level = v as ImpactNode['impactLevel'];
        return <Tag color={impactLevelColorMap[level]}>{impactLevelLabelMap[level]}</Tag>;
      },
    },
    {
      key: 'status',
      title: '当前状态',
      dataIndex: 'status' as any,
      width: 100,
      render: (v: unknown) => (
        <Tag color={serviceStatusColorMap[v as ServiceDependency['status']]}>
          {serviceStatusLabelMap[v as ServiceDependency['status']]}
        </Tag>
      ),
    },
    {
      key: 'description',
      title: '影响描述',
      dataIndex: 'description',
      render: (v: unknown) => <Text type="secondary">{v ? String(v) : '-'}</Text>,
    },
  ];
}
