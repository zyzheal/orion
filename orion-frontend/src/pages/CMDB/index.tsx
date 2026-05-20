/**
 * CMDB - Configuration Management Database
 * CI management, topology view, integration status, web terminal, batch execution, audit
 *
 * 2026-05-19: 扩展为 6 Tab — 新增 Web 终端、批量执行、审计日志
 * 原有组件拆分为独立文件
 */
import React from 'react';
import { Tabs } from 'antd';
import {
  CloudServerOutlined,
  DeploymentUnitOutlined,
  LinkOutlined,
  DesktopOutlined,
  CodeOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import CITablePage from './CITablePage';
import TopologyPage from './TopologyPage';
import IntegrationPage from './IntegrationPage';
import WebTerminalPage from './WebTerminalPage';
import BatchExecPage from './BatchExecPage';
import AuditLogPage from './AuditLogPage';

const tabItems = [
  {
    key: 'cis',
    label: (
      <span>
        <CloudServerOutlined /> 配置项
      </span>
    ),
    children: <CITablePage />,
  },
  {
    key: 'topology',
    label: (
      <span>
        <DeploymentUnitOutlined /> 拓扑图
      </span>
    ),
    children: <TopologyPage />,
  },
  {
    key: 'integration',
    label: (
      <span>
        <LinkOutlined /> 集成资源
      </span>
    ),
    children: <IntegrationPage />,
  },
  {
    key: 'terminal',
    label: (
      <span>
        <DesktopOutlined /> Web 终端
      </span>
    ),
    children: <WebTerminalPage />,
  },
  {
    key: 'batch-exec',
    label: (
      <span>
        <CodeOutlined /> 批量执行
      </span>
    ),
    children: <BatchExecPage />,
  },
  {
    key: 'audit',
    label: (
      <span>
        <EyeOutlined /> 审计日志
      </span>
    ),
    children: <AuditLogPage />,
  },
];

const CMDBPage: React.FC = () => {
  return <Tabs defaultActiveKey="cis" items={tabItems} size="large" />;
};

export default CMDBPage;
