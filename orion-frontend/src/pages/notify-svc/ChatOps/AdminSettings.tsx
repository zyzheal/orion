/**
 * ChatOps Admin Settings - 管理后台
 *
 * 拆分结构（P2-9 Phase 41）:
 * - constants.ts: riskLevelConfig/environmentOptions
 * - CapabilityMappingTab.tsx: 命令-Capability 映射 CRUD + 表单 + 分页
 * - ApprovalConfigTab.tsx: 审批配置 + 审批人列表 + 编辑弹窗
 * - AuditLogTab.tsx: 审计日志 + 过滤 + 分页
 * - AdminSettings.tsx: 7 个 Tabs (含 permissions/versions/rate-limits/webhooks 外部页面)
 */
import React, { useState } from 'react';
import { Card, Tabs } from 'antd';
import {
  SafetyOutlined,
  ClockCircleOutlined,
  AuditOutlined,
  HistoryOutlined,
  ThunderboltOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { spacing } from '@/tokens';
import PermissionAdmin from './PermissionAdmin';
import CommandVersionPage from './CommandVersionPage';
import RateLimitPage from './RateLimitPage';
import WebhookPage from './WebhookPage';
import { CapabilityMappingTab } from './CapabilityMappingTab';
import { ApprovalConfigTab } from './ApprovalConfigTab';
import { AuditLogTab } from './AuditLogTab';

const AdminSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('mappings');

  const tabItems = [
    {
      key: 'mappings',
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <SafetyOutlined />
          命令-Capability 映射
        </span>
      ),
      children: <CapabilityMappingTab />,
    },
    {
      key: 'approval',
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ClockCircleOutlined />
          审批配置
        </span>
      ),
      children: <ApprovalConfigTab />,
    },
    {
      key: 'audit',
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <AuditOutlined />
          审计日志
        </span>
      ),
      children: <AuditLogTab />,
    },
    {
      key: 'permissions',
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <SafetyOutlined />
          权限管理
        </span>
      ),
      children: <PermissionAdmin />,
    },
    {
      key: 'versions',
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <HistoryOutlined />
          版本管理
        </span>
      ),
      children: <CommandVersionPage />,
    },
    {
      key: 'rate-limits',
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ThunderboltOutlined />
          速率限制
        </span>
      ),
      children: <RateLimitPage />,
    },
    {
      key: 'webhooks',
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <LinkOutlined />
          Webhook 管理
        </span>
      ),
      children: <WebhookPage />,
    },
  ];

  return (
    <div style={{ padding: spacing.md }}>
      <Card bodyStyle={{ padding: '16px 24px' }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          defaultActiveKey="mappings"
          items={tabItems}
        />
      </Card>
    </div>
  );
};

export default AdminSettings;
