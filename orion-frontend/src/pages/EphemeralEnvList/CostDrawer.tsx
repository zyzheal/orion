/**
 * CostDrawer.tsx - 环境成本抽屉（自包含）
 * 抽取自 EphemeralEnvList/index.tsx (P2-9 Phase 69)
 */
import React, { useState, useEffect } from 'react';
import { Drawer, Descriptions, Typography } from 'antd';
import { colors, spacing } from '@/tokens';
import {
  getEphemeralEnvCost,
  type EphemeralEnvironment,
  type EphemeralEnvCost,
} from '@/api/ephemeral-envs';
import dayjs from 'dayjs';

const { Text } = Typography;

interface CostDrawerProps {
  env: EphemeralEnvironment | null;
  open: boolean;
  onClose: () => void;
}

export const CostDrawer: React.FC<CostDrawerProps> = ({ env, open, onClose }) => {
  const [cost, setCost] = useState<EphemeralEnvCost | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && env) {
      setLoading(true);
      getEphemeralEnvCost(env.id)
        .then((res) => {
          setCost(res ? res.data : null);
        })
        .catch(() => setCost(null))
        .finally(() => setLoading(false));
    }
  }, [open, env]);

  if (!env) return null;

  return (
    <Drawer
      title={`环境成本 - ${env.namespace}`}
      placement="right"
      width={480}
      onClose={onClose}
      open={open}
      loading={loading}
      data-testid="cost-drawer"
    >
      {loading ? (
        <Text type="secondary">加载成本数据...</Text>
      ) : cost ? (
        <>
          <Descriptions column={1} bordered size="small" style={{ marginBottom: spacing.lg }}>
            <Descriptions.Item label="环境 ID">
              <Text code>{env.id}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="统计周期">
              {cost.periodStart && cost.periodEnd
                ? `${dayjs(cost.periodStart).format('YYYY-MM-DD')} ~ ${dayjs(cost.periodEnd).format('YYYY-MM-DD')}`
                : '-'}
            </Descriptions.Item>
          </Descriptions>

          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="CPU 成本">
              <Text strong>{cost.cpuCost.toFixed(2)}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="内存成本">
              <Text strong>{cost.memoryCost.toFixed(2)}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="存储成本">
              <Text strong>{cost.storageCost.toFixed(2)}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="网络成本">
              <Text strong>{cost.networkCost.toFixed(2)}</Text>
            </Descriptions.Item>
          </Descriptions>

          <div
            style={{
              marginTop: spacing.lg,
              padding: spacing.md,
              background: colors.success[50],
              borderRadius: 8,
              textAlign: 'center',
              border: `1px solid ${colors.success[200]}`,
            }}
          >
            <Text type="secondary" style={{ fontSize: spacing[3] }}>
              总成本
            </Text>
            <br />
            <Text strong style={{ fontSize: spacing[6], color: colors.success[500] }}>
              {cost.totalCost.toFixed(2)} {cost.currency}
            </Text>
          </div>
        </>
      ) : (
        <Text type="secondary">暂无成本数据</Text>
      )}
    </Drawer>
  );
};
