import React from 'react';
import { Typography, Card, Row, Col, Statistic } from 'antd';
import { colors, spacing } from '@/tokens';
import {
  AppstoreOutlined,
  CloudServerOutlined,
  SettingOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';

const { Title } = Typography;

const Dashboard: React.FC = () => {
  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>Dashboard</Title>

      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="Pipeline 数量"
              value={12}
              prefix={<AppstoreOutlined />}
              valueStyle={{ color: colors.primary[500] }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="运行中"
              value={3}
              prefix={<CloudServerOutlined />}
              valueStyle={{ color: colors.success[500] }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="成功"
              value={156}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: colors.success[500] }}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: 24 }}>
        <Title level={4}>欢迎使用 Orion Platform</Title>
        <Typography.Paragraph>
          这是一个强大的流水线编排平台，帮助您管理和自动化部署流程。
        </Typography.Paragraph>

        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col span={8}>
            <Card hoverable>
              <AppstoreOutlined style={{ fontSize: spacing[12], color: colors.primary[500] }} />
              <Title level={5}>Pipeline 管理</Title>
              <Typography.Text type="secondary">
                创建和管理 CI/CD 流水线
              </Typography.Text>
            </Card>
          </Col>
          <Col span={8}>
            <Card hoverable>
              <CloudServerOutlined style={{ fontSize: spacing[12], color: colors.success[500] }} />
              <Title level={5}>运行监控</Title>
              <Typography.Text type="secondary">
                实时监控流水线执行状态
              </Typography.Text>
            </Card>
          </Col>
          <Col span={8}>
            <Card hoverable>
              <SettingOutlined style={{ fontSize: spacing[12], color: colors.purple[500] }} />
              <Title level={5}>系统设置</Title>
              <Typography.Text type="secondary">
                配置系统和项目参数
              </Typography.Text>
            </Card>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default Dashboard;
