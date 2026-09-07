/**
 * SBOM License Compliance Card
 * 抽取自 index.tsx (P2-9 Phase 134)
 */
import React from 'react';
import { Card, Space, Tag, Descriptions, Divider, Row, Col, Typography } from 'antd';
import { CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import { cSuccess, cError, cNeutral } from '../constants';
import type { LicenseItem } from '../types';

const { Text } = Typography;

interface LicenseComplianceCardProps {
  licenseData: LicenseItem[];
}

export const LicenseComplianceCard: React.FC<LicenseComplianceCardProps> = ({
  licenseData,
}) => (
  <Card
    title="许可证合规"
    style={{ borderRadius: 12 }}
    extra={
      <Space size={spacing.md}>
        <Tag color={cSuccess}>
          <CheckCircleOutlined /> 合规
        </Tag>
        <Tag color={cError}>
          <WarningOutlined /> 违规
        </Tag>
      </Space>
    }
  >
    <Descriptions bordered column={4} size="middle" style={{ fontSize: 13 }}>
      {licenseData.map((lic) => (
        <Descriptions.Item
          key={lic.name}
          label={<Text style={{ fontWeight: 600 }}>{lic.name}</Text>}
          style={{
            backgroundColor: lic.compliant ? 'transparent' : `${cError}08`,
          }}
        >
          <div>
            <div style={{ marginBottom: 4 }}>
              <Text
                strong
                style={{ fontSize: 18, color: lic.compliant ? cNeutral : cError }}
              >
                {lic.count}
              </Text>
              <Text type="secondary" style={{ marginLeft: 4 }}>
                个组件
              </Text>
              <Text type="secondary" style={{ marginLeft: 8 }}>
                ({lic.percentage}%)
              </Text>
            </div>
            <div>
              <Tag color={lic.compliant ? cSuccess : cError}>
                <Space size={4}>
                  {lic.compliant ? <CheckCircleOutlined /> : <WarningOutlined />}
                  <span>{lic.compliant ? '合规' : '违规'}</span>
                </Space>
              </Tag>
            </div>
          </div>
        </Descriptions.Item>
      ))}
    </Descriptions>
    <Divider style={{ margin: `${spacing.sm}px 0` }} />
    <Row gutter={[spacing.md, spacing.md]}>
      {licenseData
        .filter((l) => !l.compliant)
        .map((lic) => (
          <Col span={24} key={lic.name}>
            <Card
              size="small"
              style={
                {
                  borderRadius: 8,
                  borderColor: cError,
                  backgroundColor: `${cError}05`,
                  border: `1px solid ${cError}30`,
                } as React.CSSProperties
              }
            >
              <Space size={spacing.sm}>
                <WarningOutlined style={{ color: cError, fontSize: 18 }} />
                <Text strong style={{ color: cError }}>
                  许可证违规：{lic.name}
                </Text>
                <Text type="secondary">
                  — 该许可证存在合规风险，需人工审核后方可引入，涉及 {lic.count} 个组件
                </Text>
              </Space>
            </Card>
          </Col>
        ))}
    </Row>
  </Card>
);
