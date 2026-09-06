/**
 * Service Dependency Tree Builder
 * Turns the flat list of services returned by the graph API into a nested
 * tree structure suitable for the Ant Design Tree component.
 *
 * Rules:
 *   - Root nodes are services with either no dependencies or no dependents
 *     (leaf-like entries at the top of the graph).
 *   - The tree is capped at 10 top-level entries and a depth of 3.
 *   - Visited IDs are de-duped to avoid cycles.
 */
import React from 'react';
import { Space, Tag, Typography } from 'antd';
import { DeploymentUnitOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import type { ServiceDependency } from '@/api/graph';
import {
  serviceStatusColorMap,
  serviceStatusLabelMap,
} from './config';

const { Text } = Typography;

export interface DependencyTreeNode {
  key: string;
  title: React.ReactNode;
  children?: DependencyTreeNode[];
}

const MAX_DEPTH = 2;
const MAX_ROOTS = 10;

export function buildServiceDependencyTreeData(
  services: ServiceDependency[]
): DependencyTreeNode[] {
  const rootNodes = services.filter(
    (s) => s.dependencies.length === 0 || s.dependents.length === 0
  );
  const seen = new Set<string>();

  const buildChildren = (
    serviceId: string,
    depth: number
  ): DependencyTreeNode[] => {
    if (depth > MAX_DEPTH || seen.has(serviceId)) return [];
    seen.add(serviceId);
    const svc = services.find((s) => s.id === serviceId);
    if (!svc) return [];

    return svc.dependencies.map((depId) => {
      const dep = services.find((s) => s.id === depId);
      return {
        key: `${serviceId}->${depId}`,
        title: (
          <Space>
            <Tag color={dep ? serviceStatusColorMap[dep.status] : 'default'}>
              {dep ? serviceStatusLabelMap[dep.status] : '未知'}
            </Tag>
            <Text>{dep?.name ?? depId}</Text>
          </Space>
        ),
        children: buildChildren(depId, depth + 1),
      };
    });
  };

  return rootNodes.slice(0, MAX_ROOTS).map((svc) => ({
    key: svc.id,
    title: (
      <Space>
        <DeploymentUnitOutlined style={{ color: colors.primary[500] }} />
        <Text strong>{svc.name}</Text>
        <Tag color={serviceStatusColorMap[svc.status]}>
          {serviceStatusLabelMap[svc.status]}
        </Tag>
        <Text type="secondary" style={{ fontSize: 12 }}>
          依赖: {svc.dependencies.length} | 被依赖: {svc.dependents.length}
        </Text>
      </Space>
    ),
    children: buildChildren(svc.id, 0),
  }));
}
