/**
 * Notification Rules Management Page
 *
 * Tab-based interface for managing platform notification destinations:
 *   - Webhooks tab: Generic HTTP webhook endpoints (existing functionality)
 *   - IM Notifications tab: IM bot webhooks (DingTalk, WeCom, Feishu)
 *
 * Route: /console/notification-rules
 * Access: admin, platform_admin
 * 组件化重构 (P2-9 Phase 175): 435→44 行
 */
import React from 'react';
import { Typography, Button, Space, Tabs } from 'antd';
import {
  ReloadOutlined,
  BellOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import WebhookManagement from '@/pages/WebhookManagement';
import { IMNotificationsTab } from './Components/IMNotificationsTab';

const { Title, Text } = Typography;

const NotificationRules: React.FC = () => (
  <div style={{ padding: 0 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.lg }}>
      <div>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <BellOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
          通知规则管理
        </Title>
        <Text type="secondary">管理平台 Webhook 与 IM 通知规则</Text>
      </div>
      <Button icon={<ReloadOutlined />} onClick={() => window.location.reload()}>
        刷新
      </Button>
    </div>

    <Tabs defaultActiveKey="webhooks">
      <Tabs.TabPane
        tab={
          <Space>
            <LinkOutlined /> Webhooks
          </Space>
        }
        key="webhooks"
      >
        <WebhookManagement />
      </Tabs.TabPane>
      <Tabs.TabPane
        tab={
          <Space>
            <BellOutlined /> IM 通知
          </Space>
        }
        key="im-notifications"
      >
        <IMNotificationsTab />
      </Tabs.TabPane>
    </Tabs>
  </div>
);

export default NotificationRules;
