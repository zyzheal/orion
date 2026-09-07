/**
 * SBOM Vulnerability scan results card
 */
import React from 'react';
import { Card, Table as AntTable, Typography } from 'antd';
import type { TableColumn } from '@/components/Table';
import { spacing } from '@/tokens';
import type { SbomVulnResult } from '../types';

const { Text } = Typography;

interface VulnResultsCardProps {
  results: SbomVulnResult[];
  columns: TableColumn<SbomVulnResult>[];
}

export const VulnResultsCard: React.FC<VulnResultsCardProps> = ({ results, columns }) => (
  <Card title="漏洞扫描结果" style={{ marginBottom: spacing.lg }}>
    {results.length > 0 ? (
      <AntTable
        columns={columns}
        dataSource={results}
        rowKey="id"
        size="small"
      />
    ) : (
      <Text type="secondary">暂无漏洞扫描数据</Text>
    )}
  </Card>
);
