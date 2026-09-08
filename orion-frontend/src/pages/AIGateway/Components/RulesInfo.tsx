/**
 * RulesInfo - 规则引擎卡片
 * 抽取自 index.tsx (P2-9 Phase 219)
 */
import { Card, Empty, Tag, Typography } from 'antd';
import { spacing } from '@/tokens';

const { Text } = Typography;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface RulesData { scenarios?: string[] }

interface Props {
  rules: RulesData | null;
  loading: boolean;
}

export const RulesInfo = ({ rules, loading }: Props) => (
  <Card title="规则引擎" style={{ marginTop: spacing.lg, gridColumn: '1 / -1' }}>
    {rules ? (
      <div>
        <Text>内置降级规则覆盖 {rules.scenarios?.length || 15} 个 AI 场景</Text>
        <div style={{ marginTop: spacing[3] }}>
          {rules.scenarios && rules.scenarios.length > 0 ? (
            rules.scenarios.map((s: string) => (
              <Tag key={s} style={{ marginBottom: spacing.sm }}>
                {s}
              </Tag>
            ))
          ) : (
            <Empty description="暂无规则数据" />
          )}
        </div>
      </div>
    ) : (
      !loading && <Empty description="暂无规则数据" />
    )}
  </Card>
);
