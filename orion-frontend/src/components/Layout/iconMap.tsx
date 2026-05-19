/**
 * 导航菜单图标映射
 * 集中管理所有菜单项对应的 Ant Design 图标
 */
import React from 'react';
import {
  DashboardOutlined,
  CloudUploadOutlined,
  EyeOutlined,
  RocketOutlined,
  CloudServerOutlined,
  SettingOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  ForkOutlined,
  InboxOutlined,
  DeploymentUnitOutlined,
  ProjectOutlined,
  AlertOutlined,
  DollarCircleOutlined,
  BarChartOutlined,
  ExperimentOutlined,
  TeamOutlined,
  UserSwitchOutlined,
  DatabaseOutlined,
  BookOutlined,
  SecurityScanOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ApiOutlined,
  BranchesOutlined,
  FileTextOutlined,
  ControlOutlined,
  UserOutlined,
  LinkOutlined,
  DesktopOutlined,
  CodeOutlined,
} from '@ant-design/icons';

export const iconMap: Record<string, React.ReactNode> = {
  // 一级模块
  '/workbench': <DashboardOutlined />,
  '/delivery': <CloudUploadOutlined />,
  '/observability': <EyeOutlined />,
  '/ai': <RocketOutlined />,
  '/infra': <CloudServerOutlined />,
  '/governance': <SettingOutlined />,
  '/ecosystem': <AppstoreOutlined />,

  // 独立菜单项
  '/tickets': <UnorderedListOutlined />,
  '/product-lines': <ForkOutlined />,
  '/artifacts': <InboxOutlined />,
  '/internal-libraries': <DeploymentUnitOutlined />,
  '/projects': <ProjectOutlined />,
  '/dashboard': <DashboardOutlined />,

  // 交付中心子菜单
  '/pipelines': <RocketOutlined />,
  '/deployments': <CloudServerOutlined />,
  '/canary-analysis': <BarChartOutlined />,
  '/change-intelligence': <BarChartOutlined />,
  '/console/code-mgmt': <ForkOutlined />,
  '/test-selector': <ExperimentOutlined />,

  // 可观测性中心子菜单
  '/observability/monitoring': <EyeOutlined />,
  '/alerts': <AlertOutlined />,
  '/metrics-dashboard': <BarChartOutlined />,
  '/observability/diagnostic': <EyeOutlined />,
  '/observability/self-healing': <RocketOutlined />,

  // AI 平台子菜单
  '/ai/chatops': <RocketOutlined />,
  '/ai/review': <EyeOutlined />,
  '/ai/docs': <BookOutlined />,
  '/ai/gateway': <RocketOutlined />,
  '/ai/agents': <AppstoreOutlined />,
  '/ai/trace': <EyeOutlined />,
  '/ai/cost': <DollarCircleOutlined />,
  '/ai/knowledge': <BookOutlined />,
  '/ai/security': <SecurityScanOutlined />,

  // 基础设施子菜单
  '/environments': <CloudServerOutlined />,
  '/ephemeral-envs': <CloudServerOutlined />,
  '/console/build-env': <CloudServerOutlined />,
  '/console/iac': <DatabaseOutlined />,
  '/queue': <UnorderedListOutlined />,
  '/vector-store': <DatabaseOutlined />,
  '/eventbus': <DeploymentUnitOutlined />,
  '/cmdb': <DatabaseOutlined />,
  '/cmdb/topology': <DeploymentUnitOutlined />,
  '/cmdb/integration': <LinkOutlined />,
  '/cmdb/terminal': <DesktopOutlined />,
  '/cmdb/batch-exec': <CodeOutlined />,
  '/cmdb/audit': <EyeOutlined />,
  '/sessions': <UserSwitchOutlined />,
  '/backup': <CloudUploadOutlined />,
  '/oncall': <ClockCircleOutlined />,

  // 治理中心子菜单
  '/policies': <SettingOutlined />,
  '/audit-log': <UnorderedListOutlined />,
  '/sbom': <EyeOutlined />,
  '/tenant-management': <TeamOutlined />,
  '/roles': <UserSwitchOutlined />,
  '/config-management': <SettingOutlined />,
  '/approvals': <CheckCircleOutlined />,
  '/console/approvals': <CheckCircleOutlined />,
  '/workflows': <BranchesOutlined />,
  '/finops': <DollarCircleOutlined />,

  // 生态中心子菜单
  '/dba': <DatabaseOutlined />,
  '/knowledge': <BookOutlined />,
  '/visor': <EyeOutlined />,
  '/documents': <FileTextOutlined />,

  // 效能看板子菜单
  '/dashboard/executive': <DashboardOutlined />,
  '/dashboard/manager': <TeamOutlined />,
  '/dashboard/engineer': <UserSwitchOutlined />,
  '/efficiency-dashboard': <BarChartOutlined />,
  '/risk-dashboard': <AlertOutlined />,

  // 旧路径兼容（向后兼容）
  '/console/ai-review': <EyeOutlined />,
  '/console/ai-docs': <BookOutlined />,
  '/console/chatops': <RocketOutlined />,
  '/ai-gateway': <RocketOutlined />,
  '/agents': <AppstoreOutlined />,
  '/ai-security': <SecurityScanOutlined />,
  '/llm-trace': <EyeOutlined />,
  '/ai-cost': <DollarCircleOutlined />,
  '/monitoring': <EyeOutlined />,
  '/diagnostic': <EyeOutlined />,
  '/self-healing': <RocketOutlined />,

  // 控制台模块子菜单
  '/console': <ControlOutlined />,
  '/console/plugins': <AppstoreOutlined />,
  '/console/settings': <SettingOutlined />,
  '/console/users': <UserOutlined />,

  // 扩展能力
  '/skills': <AppstoreOutlined />,
  '/plugin-spi': <ApiOutlined />,
};

export const getIcon = (key: string): React.ReactNode => iconMap[key] || <SettingOutlined />;
