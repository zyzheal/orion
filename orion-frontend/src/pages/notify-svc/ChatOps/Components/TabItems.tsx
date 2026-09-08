import type { TabsProps } from 'antd';
import {
  DashboardOutlined,
  PlayCircleOutlined,
  AuditOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import ChatDashboard from '../ChatDashboard';
import ExecutionDashboard from '../ExecutionDashboard';
import AuditLogViewer from '../AuditLogViewer';
import AdminSettings from '../AdminSettings';

const tabLabelStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 14,
  fontWeight: 500,
};

export function buildTabItems(): TabsProps['items'] {
  return [
    {
      key: 'overview',
      label: (
        <span style={tabLabelStyle}>
          <DashboardOutlined />
          总览看板
        </span>
      ),
      children: <ChatDashboard />,
    },
    {
      key: 'executions',
      label: (
        <span style={tabLabelStyle}>
          <PlayCircleOutlined />
          执行记录
        </span>
      ),
      children: <ExecutionDashboard />,
    },
    {
      key: 'audit',
      label: (
        <span style={tabLabelStyle}>
          <AuditOutlined />
          审计日志
        </span>
      ),
      children: <AuditLogViewer />,
    },
    {
      key: 'admin',
      label: (
        <span style={tabLabelStyle}>
          <SettingOutlined />
          管理配置
        </span>
      ),
      children: <AdminSettings />,
    },
  ];
}
