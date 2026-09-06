/**
 * OverviewTab — 配置概览 Tab
 * 包含统计卡片、GitOps 同步状态卡片、配置列表表格
 */
import React from 'react';
import {
  Row,
  Col,
  Card,
  Table,
  Tag,
  Statistic,
  Typography,
} from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { ConfigItem, GitOpsConfig } from '@/api/config';

const { Text } = Typography;

export interface OverviewTabProps {
  configs: ConfigItem[];
  gitOpsConfig: GitOpsConfig | null;
  loading: boolean;
  /** 来自 buildConfigColumns 的列定义 */
  columns: any[];
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  configs,
  gitOpsConfig,
  loading,
  columns,
}) => (
  <>
    <Row gutter={16} style={{ marginBottom: spacing.lg }}>
      <Col span={4}>
        <Card>
          <Statistic title="配置总数" value={configs.length} />
        </Card>
      </Col>
      <Col span={4}>
        <Card>
          <Statistic
            title="已激活"
            value={configs.filter((c) => c.status === 'active').length}
            valueStyle={{ color: colors.success[500] }}
          />
        </Card>
      </Col>
      <Col span={4}>
        <Card>
          <Statistic
            title="待审批"
            value={configs.filter((c) => c.status === 'pending_approval').length}
            valueStyle={{ color: colors.warning[500] }}
          />
        </Card>
      </Col>
      <Col span={4}>
        <Card>
          <Statistic
            title="草稿"
            value={configs.filter((c) => c.status === 'draft').length}
            valueStyle={{ color: colors.neutral[400] }}
          />
        </Card>
      </Col>
      <Col span={4}>
        <Card>
          <Statistic
            title="敏感配置"
            value={configs.filter((c) => c.sensitive).length}
            valueStyle={{ color: colors.error[500] }}
          />
        </Card>
      </Col>
      <Col span={4}>
        <Card>
          <Statistic
            title="GitOps 状态"
            value={gitOpsConfig?.syncStatus === 'success' ? 1 : 0}
            valueStyle={{
              color:
                gitOpsConfig?.syncStatus === 'success'
                  ? colors.success[500]
                  : colors.error[500],
            }}
            prefix={
              gitOpsConfig?.syncStatus === 'success' ? (
                <CheckCircleOutlined />
              ) : (
                <CloseCircleOutlined />
              )
            }
          />
        </Card>
      </Col>
    </Row>

    <Card title="GitOps 同步状态" style={{ marginBottom: spacing.lg }}>
      <Row gutter={16}>
        <Col span={6}>
          <Text type="secondary">状态:</Text>{' '}
          <Tag color={gitOpsConfig?.syncStatus === 'success' ? 'green' : 'default'}>
            {gitOpsConfig?.syncStatus || 'idle'}
          </Tag>
        </Col>
        <Col span={6}>
          <Text type="secondary">仓库:</Text>{' '}
          <Text code>{gitOpsConfig?.repository || '未配置'}</Text>
        </Col>
        <Col span={6}>
          <Text type="secondary">分支:</Text>{' '}
          <Text code>{gitOpsConfig?.branch || 'main'}</Text>
        </Col>
        <Col span={6}>
          <Text type="secondary">最后同步:</Text>{' '}
          {gitOpsConfig?.lastSyncAt
            ? new Date(gitOpsConfig.lastSyncAt).toLocaleString()
            : '从未'}
        </Col>
      </Row>
    </Card>

    <Card title="配置列表">
      <Table
        columns={columns}
        dataSource={configs}
        loading={loading}
        pagination={{ pageSize: 10 }}
        rowKey="id"
      />
    </Card>
  </>
);
