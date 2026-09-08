/**
 * Console QuickNav
 * 抽取自 index.tsx (P2-9 Phase 196)
 */
import React from 'react';
import { Card, Col, Row, Space, Typography } from 'antd';
import { AppstoreOutlined, SettingOutlined, UserOutlined } from '@ant-design/icons';
import { colors } from '@/tokens';

const { Text } = Typography;

interface NavItem {
  path: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    path: '/console/plugins',
    title: '插件管理',
    desc: '安装、配置和管理系统插件',
    icon: <AppstoreOutlined style={{ fontSize: 24, color: colors.primary[500] }} />,
  },
  {
    path: '/console/settings',
    title: '系统配置',
    desc: '功能开关、特性管理、配置治理',
    icon: <SettingOutlined style={{ fontSize: 24, color: colors.purple[500] }} />,
  },
  {
    path: '/console/users',
    title: '用户管理',
    desc: '用户、角色、权限管理',
    icon: <UserOutlined style={{ fontSize: 24, color: colors.info[500] }} />,
  },
];

export const QuickNav = () => (
  <Card title="快速导航">
    <Row gutter={[16, 16]}>
      {NAV_ITEMS.map((item) => (
        <Col key={item.path} xs={24} sm={12} lg={8}>
          <Card
            hoverable
            onClick={() => {
              window.location.href = item.path;
            }}
            style={{ height: '100%' }}
          >
            <Space direction="vertical" size={8}>
              {item.icon}
              <Text strong>{item.title}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {item.desc}
              </Text>
            </Space>
          </Card>
        </Col>
      ))}
    </Row>
  </Card>
);
