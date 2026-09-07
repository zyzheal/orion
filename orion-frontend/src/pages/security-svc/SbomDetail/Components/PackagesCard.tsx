/**
 * SBOM Package list card
 */
import React from 'react';
import { Card, Table as AntTable } from 'antd';
import type { TableColumn } from '@/components/Table';
import { spacing } from '@/tokens';
import type { SbomPackage } from '../types';

interface PackagesCardProps {
  packages: SbomPackage[];
  columns: TableColumn<SbomPackage>[];
}

export const PackagesCard: React.FC<PackagesCardProps> = ({ packages, columns }) => (
  <Card title={`包清单 (${packages.length})`} style={{ marginBottom: spacing.lg }}>
    <AntTable
      columns={columns}
      dataSource={packages}
      rowKey="id"
      size="small"
      pagination={{ pageSize: 10 }}
    />
  </Card>
);
