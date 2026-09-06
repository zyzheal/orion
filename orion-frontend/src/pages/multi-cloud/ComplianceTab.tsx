/**
 * ComplianceTab.tsx - 合规检查 Tab
 * 抽取自 MultiCloudAdvancedPage.tsx (P2-9 Phase 47)
 */
import React from 'react';
import {
  Card,
  Table,
  Button,
  Select,
  Space,
  Statistic,
  Row,
  Col,
  Progress,
  Typography,
} from 'antd';
import { AuditOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { buildComplianceColumns } from './MultiCloudAdvancedColumns';
import { COMPLIANCE_CATEGORY_OPTIONS } from './MultiCloudAdvancedConfig';
import type { ComplianceReport } from '@/api/multi-cloud';

const { Text } = Typography;

export interface ComplianceTabProps {
  complianceReport: ComplianceReport | null;
  complianceLoading: boolean;
  onRunComplianceCheck: (categories?: string[]) => void;
}

export const ComplianceTab: React.FC<ComplianceTabProps> = ({
  complianceReport,
  complianceLoading,
  onRunComplianceCheck,
}) => {
  const complianceColumns = buildComplianceColumns();

  return (
    <Card
      title="合规检查报告"
      style={{ borderRadius: 12 }}
      extra={
        <Space>
          <Button
            icon={<AuditOutlined />}
            onClick={() => onRunComplianceCheck()}
            loading={complianceLoading}
            type="primary"
          >
            执行合规检查
          </Button>
          <Select
            placeholder="按类别筛选"
            style={{ width: 140 }}
            allowClear
            onChange={(value) => value && onRunComplianceCheck([value])}
            options={COMPLIANCE_CATEGORY_OPTIONS}
          />
        </Space>
      }
    >
      {complianceReport ? (
        <>
          <Row gutter={16} style={{ marginBottom: spacing.lg }}>
            <Col span={6}>
              <Card size="small" style={{ textAlign: 'center', borderRadius: 8 }}>
                <Progress
                  type="dashboard"
                  percent={complianceReport.score}
                  strokeColor={
                    complianceReport.score >= 80
                      ? colors.success[500]
                      : complianceReport.score >= 60
                        ? colors.warning[500]
                        : colors.error[500]
                  }
                  format={(percent) => `${percent}%`}
                />
                <div style={{ marginTop: spacing.sm }}>
                  <Text strong>合规评分</Text>
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" style={{ textAlign: 'center', borderRadius: 8 }}>
                <Statistic
                  title="总规则"
                  value={complianceReport.totalRules}
                  valueStyle={{ fontSize: 32 }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card
                size="small"
                style={
                  {
                    textAlign: 'center',
                    borderRadius: 8,
                    borderTop: `2px solid ${colors.success[500]}`,
                  } as React.CSSProperties
                }
              >
                <Statistic
                  title="通过"
                  value={complianceReport.passedRules}
                  valueStyle={{ color: colors.success[500], fontSize: 32 }}
                  prefix={<CheckCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card
                size="small"
                style={
                  {
                    textAlign: 'center',
                    borderRadius: 8,
                    borderTop: `2px solid ${colors.error[500]}`,
                  } as React.CSSProperties
                }
              >
                <Statistic
                  title="未通过"
                  value={complianceReport.failedRules}
                  valueStyle={{ color: colors.error[500], fontSize: 32 }}
                  prefix={<CloseCircleOutlined />}
                />
              </Card>
            </Col>
          </Row>

          <Table
            columns={complianceColumns}
            dataSource={complianceReport.results}
            rowKey="ruleId"
            size="small"
            pagination={false}
          />
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <AuditOutlined
            style={{ fontSize: 48, color: colors.neutral[300], marginBottom: spacing.md }}
          />
          <div>
            <Text type="secondary">点击"执行合规检查"按钮开始检查云资源合规性</Text>
          </div>
        </div>
      )}
    </Card>
  );
};

export default ComplianceTab;
