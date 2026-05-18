import React from 'react';
import { Card, Col, Row, Typography, Space, Tag } from 'antd';
import {
  DashboardOutlined,
  RobotOutlined,
  CodeOutlined,
  SecurityScanOutlined,
  ToolOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

const AICATEGORIES = [
  { key: 'overview', label: 'AI 总览', icon: <DashboardOutlined />, route: '/ai/dashboard' },
  { key: 'assistant', label: '智能助手', icon: <RobotOutlined />, route: '/ai/chatops' },
  { key: 'code', label: '代码智能', icon: <CodeOutlined />, route: '/ai/review' },
  { key: 'security', label: '安全与治理', icon: <SecurityScanOutlined />, route: '/ai/security' },
  { key: 'platform', label: '平台配置', icon: <ToolOutlined />, route: '/ai/gateway' },
];

export default function AIDashboard() {
  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>AI 能力平台</Title>
      <Text type="secondary">AI 驱动的研发效能提升，让工具链更智能</Text>

      <Space direction="vertical" size="large" style={{ width: '100%', marginTop: 24 }}>
        <Row gutter={[16, 16]}>
          {AICATEGORIES.map((cat) => (
            <Col key={cat.key} xs={24} sm={12} md={8} lg={8}>
              <Card hoverable size="small">
                <Space>
                  {cat.icon}
                  <Text strong>{cat.label}</Text>
                  <Tag color="blue">Phase 1</Tag>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </Space>
    </div>
  );
}