/**
 * SBOM Dashboard compliance report
 * 抽取自 index.tsx (P2-9 Phase 148)
 */
import React from 'react';
import { Button, Card, Col, Row, Space, Typography } from 'antd';
import { DownloadOutlined, FileTextOutlined } from '@ant-design/icons';
import { StatCard, PieChart, BarChart, TreeMap } from '@/components/charts';
import type { PieDataItem, BarDataItem } from '@/components/charts';
import { spacing } from '@/tokens';
import type { SbomComplianceReport, SbomDocument, SbomWaiver } from '../types';

const { Text } = Typography;

interface ComplianceReportProps {
  compliance: SbomComplianceReport | null;
  waivers: SbomWaiver[];
  documents: SbomDocument[];
  licenseDistribution: PieDataItem[];
  componentByDoc: BarDataItem[];
}

export const ComplianceReport: React.FC<ComplianceReportProps> = ({
  compliance,
  waivers,
  documents,
  licenseDistribution,
  componentByDoc,
}) => (
  <Card
    title={
      <Space>
        <FileTextOutlined />
        合规报告
      </Space>
    }
    extra={
      <Button icon={<DownloadOutlined />} size="small">
        导出 PDF
      </Button>
    }
    style={{ marginBottom: spacing.lg }}
  >
    {compliance ? (
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Row gutter={16}>
          <Col span={6}>
            <StatCard title="总 SBOM" value={compliance.totalSboms || 0} />
          </Col>
          <Col span={6}>
            <StatCard title="合规数" value={compliance.compliantSboms || 0} />
          </Col>
          <Col span={6}>
            <StatCard title="严重漏洞" value={compliance.criticalVulns || 0} />
          </Col>
          <Col span={6}>
            <StatCard title="活跃豁免" value={waivers.length} />
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <PieChart
              title="许可证分布"
              data={licenseDistribution}
              variant="donut"
              height={200}
            />
          </Col>
          <Col span={8}>
            <BarChart title="组件数量按文档" data={componentByDoc} height={200} />
          </Col>
          <Col span={8}>
            <TreeMap
              title="组件风险分布"
              data={documents.map((d) => ({
                name: d.format,
                value: d.packageCount,
              }))}
              height={200}
            />
          </Col>
        </Row>
      </Space>
    ) : (
      <Text type="secondary">暂无合规报告数据</Text>
    )}
  </Card>
);
