import { lazy, Suspense } from 'react';
import { Spin } from 'antd';
import type { TabsProps } from 'antd';
import {
  CloudServerOutlined,
  DesktopOutlined,
  DeploymentUnitOutlined,
  LinkOutlined,
  CodeOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import CITablePage from '../CITablePage';
import TopologyPage from '../TopologyPage';
import IntegrationPage from '../IntegrationPage';
import BatchExecPage from '../BatchExecPage';
import AuditLogPage from '../AuditLogPage';

// P2: xterm 436KB 仅在进入「Web 终端」tab 时加载
const WebTerminalPage = lazy(() => import('../WebTerminalPage'));

export function buildCMDBTabItems(): TabsProps['items'] {
  return [
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
      children: (
        <Suspense fallback={<Spin style={{ padding: 48, textAlign: 'center' }} />}>
          <WebTerminalPage />
        </Suspense>
      ),
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
}
