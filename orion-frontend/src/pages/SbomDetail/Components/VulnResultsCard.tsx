/**
 * SBOM vulnerability scan results card
 * 抽取自 index.tsx (P2-9 Phase 162)
 */
import { Card, Table, Typography } from 'antd';
import { spacing } from '@/tokens';
import type { SbomVulnResult } from '../types';
import type { TableColumn } from '@/components/Table';

const { Text } = Typography;

interface VulnResultsCardProps {
  vulnResults: SbomVulnResult[];
  columns: TableColumn<SbomVulnResult>[];
}

export const VulnResultsCard = ({ vulnResults, columns }: VulnResultsCardProps) => (
  <Card title="漏洞扫描结果" style={{ marginBottom: spacing.lg }}>
    {vulnResults.length > 0 ? (
      <Table columns={columns} dataSource={vulnResults} rowKey="id" size="small" />
    ) : (
      <Text type="secondary">暂无漏洞扫描数据</Text>
    )}
  </Card>
);
