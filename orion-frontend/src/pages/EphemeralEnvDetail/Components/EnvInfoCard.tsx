/**
 * EnvInfoCard - 环境信息卡片
 * 抽取自 index.tsx (P2-9 Phase 115)
 */
import React from 'react';
import { Card, Descriptions, Space, Tag, Divider, Typography } from 'antd';
import { CloudServerOutlined, DatabaseOutlined, AppstoreOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import dayjs from 'dayjs';
import type { EphemeralEnvDetailState } from '../useEphemeralEnvDetailState';

const { Title, Text } = Typography;

interface EnvInfoCardProps {
  state: EphemeralEnvDetailState;
}

export const EnvInfoCard: React.FC<EnvInfoCardProps> = ({ state }) => {
  const { env } = state;
  if (!env) return null;

  return (
    <Card title="环境信息" size="small" style={{ marginBottom: spacing.lg }}>
      <Descriptions column={3} size="small" bordered>
        <Descriptions.Item label="环境 ID">
          <Text code style={{ fontSize: spacing[2] }}>
            {env.id}
          </Text>
        </Descriptions.Item>
        <Descriptions.Item label="Namespace">{env.namespace}</Descriptions.Item>
        <Descriptions.Item label="PR ID">#{env.prId}</Descriptions.Item>
        <Descriptions.Item label="仓库">{env.repoId}</Descriptions.Item>
        <Descriptions.Item label="分支">
          <Tag>{env.branchName}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Commit SHA">
          <Text code style={{ fontSize: spacing[2] }}>
            {env.commitSha}
          </Text>
        </Descriptions.Item>
        <Descriptions.Item label="创建者">{env.createdBy || '-'}</Descriptions.Item>
        <Descriptions.Item label="创建时间">
          {dayjs(env.createdAt).format('YYYY-MM-DD HH:mm:ss')}
        </Descriptions.Item>
        <Descriptions.Item label="空闲时间">
          {env.idleSince ? dayjs(env.idleSince).format('YYYY-MM-DD HH:mm:ss') : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="自动销毁时间">
          {env.autoDestroyAt ? dayjs(env.autoDestroyAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="销毁时间">
          {env.destroyedAt ? dayjs(env.destroyedAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Preview URL">
          {env.previewUrl ? (
            <a href={env.previewUrl} target="_blank" rel="noopener noreferrer">
              {env.previewUrl}
            </a>
          ) : (
            '-'
          )}
        </Descriptions.Item>
      </Descriptions>

      {env.resources && (
        <>
          <Divider style={{ margin: '12px 0' }} />
          <Title level={5}>资源分配</Title>
          <Descriptions column={3} size="small" bordered>
            <Descriptions.Item label="CPU">
              <Space>
                <CloudServerOutlined />
                <Text strong>{env.resources.cpu}</Text>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="内存">
              <Space>
                <DatabaseOutlined />
                <Text strong>{env.resources.memory}</Text>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="存储">
              <Space>
                <AppstoreOutlined />
                <Text strong>{env.resources.storage}</Text>
              </Space>
            </Descriptions.Item>
          </Descriptions>
        </>
      )}
    </Card>
  );
};
