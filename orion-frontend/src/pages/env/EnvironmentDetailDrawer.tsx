/**
 * EnvironmentDetailDrawer
 * 环境详情 Drawer（抽取自 EnvironmentPage.tsx）
 */
import React from 'react';
import { Drawer, Descriptions, Tag, Switch, Space, Button, Typography } from 'antd';

const { Title } = Typography;
import {
  PauseCircleOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import type { Environment } from '@/api/environments';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import dayjs from 'dayjs';
import { typeColorMap, typeLabelMap, statusColorMap, statusLabelMap } from './constants';

export interface EnvironmentDetailDrawerProps {
  visible: boolean;
  env: Environment | null;
  onClose: () => void;
  onStatusChange: (id: string, status: Environment['status']) => Promise<void>;
}

export const EnvironmentDetailDrawer: React.FC<EnvironmentDetailDrawerProps> = ({
  visible,
  env,
  onClose,
  onStatusChange,
}) => (
  <Drawer
    title={env ? `${env.name}` : '环境详情'}
    open={visible}
    onClose={onClose}
    width={700}
    destroyOnClose
  >
    {env && (
      <>
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="环境名称">{env.name}</Descriptions.Item>
          <Descriptions.Item label="类型">
            <Tag color={typeColorMap[env.type]}>
              {typeLabelMap[env.type] || env.type}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={statusColorMap[env.status]}>
              {statusLabelMap[env.status] || env.status}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="项目 ID">{env.project_id}</Descriptions.Item>
          <Descriptions.Item label="集群">{env.cluster || '-'}</Descriptions.Item>
          <Descriptions.Item label="命名空间">{env.namespace || '-'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {env.created_at
              ? dayjs(env.created_at).format('YYYY-MM-DD HH:mm:ss')
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间">
            {env.updated_at
              ? dayjs(env.updated_at).format('YYYY-MM-DD HH:mm:ss')
              : '-'}
          </Descriptions.Item>
        </Descriptions>

        {/* TTL & Hibernate Info */}
        {env.config && (
          <div style={{ marginTop: spacing.lg }}>
            <Title level={5}>高级配置</Title>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="自动休眠">
                <Switch
                  checked={!!(env.config as { autoSleep?: boolean })?.autoSleep}
                  disabled
                  checkedChildren="开启"
                  unCheckedChildren="关闭"
                />
              </Descriptions.Item>
              <Descriptions.Item label="TTL">
                {(env.config as { ttlHours?: number })?.ttlHours
                  ? `${(env.config as { ttlHours?: number }).ttlHours} 小时后自动销毁`
                  : '无限制'}
              </Descriptions.Item>
              <Descriptions.Item label="副本数">
                {(env.config as { replicas?: number })?.replicas || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="资源限制">
                {(env.config as { resources?: Record<string, unknown> })?.resources
                  ? JSON.stringify(
                      (env.config as { resources?: Record<string, unknown> }).resources
                    )
                  : '-'}
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}

        {/* Raw Config */}
        {env.config && Object.keys(env.config).length > 0 && (
          <div style={{ marginTop: spacing.lg }}>
            <Title level={5}>环境配置</Title>
            <pre
              style={{
                background: colors.neutral[100],
                padding: spacing.md,
                borderRadius: 4,
                fontSize: 13,
                overflow: 'auto',
                maxHeight: 300,
              }}
            >
              {JSON.stringify(env.config, null, 2)}
            </pre>
          </div>
        )}

        {/* Quick status actions */}
        <div style={{ marginTop: spacing.lg }}>
          <Title level={5}>快捷操作</Title>
          <Space wrap>
            {env.status !== 'active' && (
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={() => {
                  onStatusChange(env.id, 'active');
                  onClose();
                }}
              >
                唤醒
              </Button>
            )}
            {env.status === 'active' && (
              <Button
                icon={<PauseCircleOutlined />}
                onClick={() => {
                  onStatusChange(env.id, 'inactive');
                  onClose();
                }}
              >
                休眠
              </Button>
            )}
            {env.status === 'active' && (
              <Button
                danger
                onClick={() => {
                  onStatusChange(env.id, 'maintenance');
                  onClose();
                }}
              >
                设为维护中
              </Button>
            )}
          </Space>
        </div>
      </>
    )}
  </Drawer>
);
