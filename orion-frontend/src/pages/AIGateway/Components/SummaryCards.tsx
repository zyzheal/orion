/**
 * SummaryCards - AI Gateway 汇总卡片 (4 张)
 * 抽取自 index.tsx (P2-9 Phase 219)
 */
import { Card, Statistic } from 'antd';
import {
  ThunderboltOutlined,
  SafetyOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens';
import type { AIGatewayHealth } from '@/api/ai-gateway';

interface Props {
  healthData: AIGatewayHealth[];
}

export const SummaryCards = ({ healthData }: Props) => (
  <>
    <Card>
      <Statistic title="场景总数" value={healthData.length} prefix={<ThunderboltOutlined />} />
    </Card>
    <Card>
      <Statistic
        title="健康场景"
        value={healthData.filter((h) => h.isHealthy).length}
        valueStyle={{ color: colors.success[500] }}
        prefix={<CheckCircleOutlined />}
      />
    </Card>
    <Card>
      <Statistic
        title="熔断场景"
        value={healthData.filter((h) => h.circuitState === 'OPEN').length}
        valueStyle={{ color: colors.error[500] }}
        prefix={<CloseCircleOutlined />}
      />
    </Card>
    <Card>
      <Statistic
        title="降级激活"
        value={healthData.filter((h) => h.degradationActive).length}
        valueStyle={{ color: colors.warning[500] }}
        prefix={<SafetyOutlined />}
      />
    </Card>
  </>
);
