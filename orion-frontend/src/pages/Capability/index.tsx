/**
 * Capability 管理模块入口
 * 提供能力管理、角色能力分配、用户能力覆盖等功能
 *
 * 页面结构：
 * - /console/capabilities/list - 能力列表
 * - /console/capabilities/roles - 角色能力分配
 * - /console/capabilities/users - 用户能力覆盖
 */
import React, { useState } from 'react';
import { Card, Tabs, Typography } from 'antd';
import {
  SafetyCertificateOutlined,
  TeamOutlined,
  UserOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import CapabilityList from './CapabilityList';
import RoleCapabilityMapping from './RoleCapabilityMapping';
import UserCapabilityMapping from './UserCapabilityMapping';
import { colors } from '@/tokens';

const { Title, Paragraph } = Typography;

/**
 * Capability 管理主页面
 * 包含三个子页面：能力列表、角色能力分配、用户能力覆盖
 */
const CapabilityManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState('list');

  const tabItems = [
    {
      key: 'list',
      label: (
        <span>
          <SafetyCertificateOutlined />
          能力列表
        </span>
      ),
      children: <CapabilityList />,
    },
    {
      key: 'roles',
      label: (
        <span>
          <TeamOutlined />
          角色能力分配
        </span>
      ),
      children: <RoleCapabilityMapping />,
    },
    {
      key: 'users',
      label: (
        <span>
          <UserOutlined />
          用户能力覆盖
        </span>
      ),
      children: <UserCapabilityMapping />,
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ marginBottom: 8 }}>
          <SafetyCertificateOutlined style={{ marginRight: 8, color: colors.purple[500] }} />
          能力管理
        </Title>
        <Paragraph type="secondary">管理系统的能力单元、角色能力分配和用户能力覆盖</Paragraph>
      </div>

      {/* 功能标签页 */}
      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab} defaultActiveKey="list" items={tabItems} />
      </Card>
    </div>
  );
};

export default CapabilityManagement;
