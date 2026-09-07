/**
 * StatusBannerCard - 状态横幅卡片
 * 抽取自 index.tsx (P2-9 Phase 115)
 */
import React from 'react';
import {
  Button,
  Space,
  Tag,
  Card,
  Typography,
  Alert,
  Popconfirm,
} from 'antd';
import {
  LinkOutlined,
  ReloadOutlined,
  PoweroffOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import StatusBadge from '@/components/StatusBadge';
import dayjs from 'dayjs';
import { statusToBadge, statusLabel, type EphemeralEnvDetailState } from '../useEphemeralEnvDetailState';

const { Title, Text } = Typography;

interface StatusBannerCardProps {
  state: EphemeralEnvDetailState;
}

export const StatusBannerCard: React.FC<StatusBannerCardProps> = ({ state }) => {
  const {
    env,
    isWakable,
    isTeardownable,
    actionLoading,
    loading,
    id,
    loadData,
    handleOpenPreview,
    handleWake,
    handleTeardown,
  } = state;

  if (!env) return null;

  return (
    <Card
      style={{
        marginBottom: spacing.lg,
        borderLeft: `4px solid ${
          env.status === 'running'
            ? colors.success[500]
            : env.status === 'provisioning'
              ? colors.primary[500]
              : env.status === 'idle'
                ? colors.warning[500]
                : env.status === 'destroyed'
                  ? colors.error[500]
                  : colors.neutral[400]
        }`,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <Space style={{ marginBottom: spacing.sm }}>
            <Title level={4} style={{ margin: 0 }}>
              {env.namespace}
            </Title>
            <StatusBadge
              status={statusToBadge[env.status] || 'unknown'}
              label={statusLabel[env.status]}
            />
          </Space>
          <Text type="secondary">
            PR #{env.prId} · {env.repoId} · <Tag>{env.branchName}</Tag>
          </Text>
        </div>
        <Space>
          {env.previewUrl && env.status === 'running' && (
            <Button type="primary" icon={<LinkOutlined />} onClick={handleOpenPreview}>
              打开 Preview
            </Button>
          )}
          {isWakable && (
            <Button
              icon={<ThunderboltOutlined />}
              loading={actionLoading === 'wake'}
              onClick={handleWake}
            >
              唤醒
            </Button>
          )}
          {isTeardownable && (
            <Popconfirm
              title="确认销毁"
              description="确定要销毁该环境吗？此操作不可撤销。"
              onConfirm={handleTeardown}
              okText="销毁"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button
                danger
                icon={<PoweroffOutlined />}
                loading={actionLoading === 'teardown'}
              >
                销毁
              </Button>
            </Popconfirm>
          )}
          <Button icon={<ReloadOutlined />} onClick={() => id && loadData(id)} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      {env.autoDestroyAt && !['destroyed', 'tearing_down'].includes(env.status) && (
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: spacing.md }}
          message={`自动销毁时间: ${dayjs(env.autoDestroyAt).format('YYYY-MM-DD HH:mm')}`}
          description={`该环境将在 ${dayjs(env.autoDestroyAt).fromNow()} 自动销毁`}
        />
      )}
    </Card>
  );
};
