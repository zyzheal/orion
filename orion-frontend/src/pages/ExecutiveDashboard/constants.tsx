/**
 * Executive Dashboard constants
 * 抽取自 index.tsx (P2-9 Phase 158)
 */
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  TeamOutlined,
  FireOutlined,
  BarChartOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens';

export const COLORS = {
  success: colors.success[500],
  warning: colors.warning[500],
  error: colors.error[400],
  info: colors.primary[500],
  purple: colors.purple[500],
  cyan: colors.info[500],
};

export const KPI_ICONS: Record<string, React.ReactNode> = {
  总工单数: <BarChartOutlined />,
  已解决: <CheckCircleOutlined />,
  待处理: <ClockCircleOutlined />,
  解决率: <RiseOutlined />,
  平均解决时间: <ClockCircleOutlined />,
  SLA合规率: <CheckCircleOutlined />,
  工程师总数: <TeamOutlined />,
  活跃工程师: <FireOutlined />,
};

export const CATEGORY_NAMES: Record<string, string> = {
  infrastructure: '基础设施',
  application: '应用',
  database: '数据库',
  network: '网络',
  security: '安全',
  deployment: '部署',
  pipeline: '流水线',
  performance: '性能',
};

export const PRIORITY_NAMES: Record<string, string> = {
  critical: '紧急',
  high: '高',
  medium: '中',
  low: '低',
};
