/**
 * Impact Analysis Tab
 * Service selector, impact summary statistics, warning alert, and two
 * tables listing directly + transitively impacted services.
 */
import React from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Typography,
} from 'antd';
import {
  ReloadOutlined,
  ShareAltOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import Table from '@/components/Table';
import type { ImpactAnalysis, ServiceDependency } from '@/api/graph';
import { buildImpactColumns } from './columns';

const { Text } = Typography;

export interface ImpactTabProps {
  impactData: ImpactAnalysis | null;
  impactLoading: boolean;
  impactServiceId: string;
  onImpactServiceIdChange: (id: string) => void;
  onAnalyzeImpact: () => void;
  onReset: () => void;
  services: ServiceDependency[];
}

const ImpactTab: React.FC<ImpactTabProps> = ({
  impactData,
  impactLoading,
  impactServiceId,
  onImpactServiceIdChange,
  onAnalyzeImpact,
  onReset,
  services,
}) => {
  const impactColumns = React.useMemo(() => buildImpactColumns(), []);

  return (
    <div>
      {/* Service Selector */}
      <Card size="small" style={{ marginBottom: spacing.md }}>
        <Space>
          <Text strong>选择要分析的服务:</Text>
          <Select
            style={{ width: 280 }}
            value={impactServiceId || undefined}
            onChange={onImpactServiceIdChange}
            placeholder="请选择服务"
            options={services.map((s) => ({ label: s.name, value: s.id }))}
            allowClear
          />
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={onAnalyzeImpact}
            loading={impactLoading}
            disabled={!impactServiceId}
          >
            分析影响
          </Button>
          <Button icon={<ReloadOutlined />} onClick={onReset}>
            重置
          </Button>
        </Space>
      </Card>

      {/* Impact Result */}
      <Spin spinning={impactLoading}>
        {impactData && (
          <>
            {/* Summary */}
            <Row gutter={16} style={{ marginBottom: spacing.md }}>
              <Col span={6}>
                <Card size="small">
                  <Statistic title="总影响服务" value={impactData.summary.totalImpacted} />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic
                    title="严重影响"
                    value={impactData.summary.criticalCount}
                    valueStyle={errorColorStyle}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic
                    title="高影响"
                    value={impactData.summary.highCount}
                    valueStyle={warningColorStyle}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic
                    title="基础设施影响"
                    value={impactData.infrastructureImpacted.length}
                    prefix={<ShareAltOutlined />}
                  />
                </Card>
              </Col>
            </Row>

            {/* Warning Alert for Critical Impacts */}
            {impactData.summary.criticalCount > 0 && (
              <Alert
                message="严重警告"
                description={`该服务故障将导致 ${impactData.summary.criticalCount} 个关键服务受到严重影响`}
                type="error"
                showIcon
                icon={<WarningOutlined />}
                style={{ marginBottom: spacing.md }}
              />
            )}

            {/* Directly Impacted */}
            <Card
              title={
                <Space>
                  <WarningOutlined style={{ color: colors.error[500] }} />
                  <Text>直接影响 ({impactData.directlyImpacted.length})</Text>
                </Space>
              }
              size="small"
              style={{ marginBottom: spacing.md }}
            >
              {impactData.directlyImpacted.length === 0 ? (
                <Text type="secondary">无直接影响</Text>
              ) : (
                <Table
                  columns={impactColumns}
                  dataSource={impactData.directlyImpacted}
                  rowKey={(record) => (record.service as ServiceDependency).id}
                  size="small"
                  pagination={false}
                />
              )}
            </Card>

            {/* Transitively Impacted */}
            <Card
              title={
                <Space>
                  <ShareAltOutlined style={{ color: colors.warning[500] }} />
                  <Text>间接影响 ({impactData.transitivelyImpacted.length})</Text>
                </Space>
              }
              size="small"
            >
              {impactData.transitivelyImpacted.length === 0 ? (
                <Text type="secondary">无间接影响</Text>
              ) : (
                <Table
                  columns={impactColumns}
                  dataSource={impactData.transitivelyImpacted}
                  rowKey={(record) => (record.service as ServiceDependency).id}
                  size="small"
                  pagination={false}
                />
              )}
            </Card>
          </>
        )}

        {!impactData && !impactLoading && (
          <Card style={{ textAlign: 'center', padding: 60 }}>
            <ThunderboltOutlined style={largeNeutralIconStyle} />
            <p style={secondaryParagraphStyle}>
              请选择一个服务并点击"分析影响"来查看故障影响范围
            </p>
          </Card>
        )}
      </Spin>
    </div>
  );
};

const errorColorStyle: React.CSSProperties = { color: colors.error[500] };
const warningColorStyle: React.CSSProperties = { color: colors.warning[500] };
const largeNeutralIconStyle: React.CSSProperties = {
  fontSize: 48,
  color: colors.neutral[300],
};
const secondaryParagraphStyle: React.CSSProperties = {
  marginTop: spacing.md,
  color: colors.neutral[500],
};

export default ImpactTab;
