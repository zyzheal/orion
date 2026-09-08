/**
 * Console GovernanceCards
 * Phase 6 服务治理模块
 * 抽取自 index.tsx (P2-9 Phase 196)
 */
import React from 'react';
import { Card, Col, Row, Space, Typography } from 'antd';
import {
  GatewayOutlined,
  ClusterOutlined,
  HeartOutlined,
  ApartmentOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons';
import { colors, spacing, componentRadius } from '@/tokens';

const { Text } = Typography;

interface GovernanceItem {
  path: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
}

const GOVERNANCE_ITEMS: GovernanceItem[] = [
  {
    path: '/service-registry',
    title: '服务注册中心',
    desc: '服务注册、发现与健康状态管理',
    icon: <ClusterOutlined style={{ fontSize: 24, color: colors.primary[500] }} />,
  },
  {
    path: '/gateway-routes',
    title: '网关路由管理',
    desc: 'API Gateway 路由配置与流量管理',
    icon: <GatewayOutlined style={{ fontSize: 24, color: colors.purple[500] }} />,
  },
  {
    path: '/health-dashboard',
    title: '健康仪表盘',
    desc: '系统健康 KPI、服务状态与告警趋势',
    icon: <HeartOutlined style={{ fontSize: 24, color: colors.success[500] }} />,
  },
  {
    path: '/service-topology',
    title: '服务拓扑',
    desc: '服务依赖关系可视化与调用链追踪',
    icon: <ApartmentOutlined style={{ fontSize: 24, color: colors.info[500] }} />,
  },
  {
    path: '/version-management',
    title: '版本管理',
    desc: 'Pipeline、制品和部署版本管理',
    icon: <CloudUploadOutlined style={{ fontSize: 24, color: colors.primary[500] }} />,
  },
  {
    path: '/traffic-governance',
    title: '流量治理',
    desc: '灰度发布和流量切分规则管理',
    icon: <ApartmentOutlined style={{ fontSize: 24, color: colors.warning[500] }} />,
  },
];

export const GovernanceCards = () => (
  <Card title="Phase 6 服务治理" style={{ marginTop: spacing.lg }} >
    <Row gutter={[16, 16]}>
      {GOVERNANCE_ITEMS.map((item) => (
        <Col key={item.path} xs={24} sm={12} lg={8}>
          <Card
            hoverable
            onClick={() => {
              window.location.href = item.path;
            }}
            style={{ height: '100%', borderRadius: componentRadius.card }}
          >
            <Space direction="vertical" size={8}>
              {item.icon}
              <Text strong>{item.title}</Text>
              <Text type="secondary" style={{ fontSize: 12 }} >
                {item.desc}
              </Text>
            </Space>
          </Card>
        </Col>
      ))}
    </Row>
  </Card>
);
