/**
 * SBOM package list card
 * 抽取自 index.tsx (P2-9 Phase 162)
 */
import { Card, Table } from 'antd';
import { spacing } from '@/tokens';
import type { SbomPackage } from '../types';
import type { TableColumn } from '@/components/Table';

interface PackageListCardProps {
  packages: SbomPackage[];
  columns: TableColumn<SbomPackage>[];
}

export const PackageListCard = ({ packages, columns }: PackageListCardProps) => (
  <Card title={`包清单 (${packages.length})`} style={{ marginBottom: spacing.lg }}>
    <Table columns={columns} dataSource={packages} rowKey="id" size="small" pagination={{ pageSize: 10 }} />
  </Card>
);
