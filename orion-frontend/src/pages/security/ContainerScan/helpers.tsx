/**
 * ContainerScan helpers
 * 抽取自 index.tsx (P2-9 Phase 133)
 */
import React from 'react';
import { Tag, Space, Typography } from 'antd';
import { colors } from '@/tokens';
import type { ImageScanRecord, VulnDistribution, ScanStatus } from './types';
import { commonStyle } from './constants';

const { Text } = Typography;

export const calcVulnDistribution = (records: ImageScanRecord[]): VulnDistribution[] => {
  const total = records.reduce((sum, r) => sum + r.total, 0);
  const critical = records.reduce((sum, r) => sum + r.critical, 0);
  const high = records.reduce((sum, r) => sum + r.high, 0);
  const medium = records.reduce((sum, r) => sum + r.medium, 0);
  const low = records.reduce((sum, r) => sum + r.low, 0);

  return [
    { severity: 'Critical', count: critical, color: colors.error[500] },
    { severity: 'High', count: high, color: colors.warning[500] },
    { severity: 'Medium', count: medium, color: colors.info[500] },
    { severity: 'Low', count: low, color: colors.neutral[500] },
  ].map((v) => ({
    ...v,
    percentage: total > 0 ? Math.round((v.count / total) * 100) : 0,
  }));
};

export const renderStatus = (status: ScanStatus) => {
  if (status === 'passed') return <Tag color={commonStyle.success}>通过</Tag>;
  if (status === 'vulnerable') return <Tag color={commonStyle.warning}>有漏洞</Tag>;
  return <Tag color={commonStyle.error}>扫描失败</Tag>;
};

export const renderVulnTotal = (record: ImageScanRecord) => {
  const tags: React.ReactNode[] = [];
  if (record.critical > 0)
    tags.push(
      <Tag key="critical" color={commonStyle.error}>
        {record.critical}
      </Tag>
    );
  if (record.high > 0)
    tags.push(
      <Tag key="high" color={commonStyle.warning}>
        {record.high}
      </Tag>
    );
  if (record.medium > 0)
    tags.push(
      <Tag key="medium" color={commonStyle.info}>
        {record.medium}
      </Tag>
    );
  if (record.low > 0)
    tags.push(
      <Tag key="low" color={commonStyle.neutral}>
        {record.low}
      </Tag>
    );
  if (tags.length === 0) return <Text type="secondary">0</Text>;
  return <Space size={2}>{tags}</Space>;
};
