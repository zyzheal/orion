import React, { useEffect } from 'react';
import { Typography, Card, Row, Col, Statistic } from 'antd';
import {
  AppstoreOutlined,
  CloudServerOutlined,
  SettingOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';

const { Title } = Typography;

const Dashboard: React.FC = () => {
  useEffect(() => {
    console.log('[Dashboard] Component mounted');
  }, []);

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
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="运行中"
              value={3}
              prefix={<CloudServerOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="成功"
              value={156}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
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
              <AppstoreOutlined style={{ fontSize: 48, color: '#1890ff' }} />
              <Title level={5}>Pipeline 管理</Title>
              <Typography.Text type="secondary">
                创建和管理 CI/CD 流水线
              </Typography.Text>
            </Card>
          </Col>
          <Col span={8}>
            <Card hoverable>
              <CloudServerOutlined style={{ fontSize: 48, color: '#52c41a' }} />
              <Title level={5}>运行监控</Title>
              <Typography.Text type="secondary">
                实时监控流水线执行状态
              </Typography.Text>
            </Card>
          </Col>
          <Col span={8}>
            <Card hoverable>
              <SettingOutlined style={{ fontSize: 48, color: '#722ed1' }} />
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
