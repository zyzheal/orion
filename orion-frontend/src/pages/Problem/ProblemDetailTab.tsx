/**
 * ProblemDetailTab - 问题详情 Tab
 * 抽取自 index.tsx：Header + 状态流转按钮 + Descriptions + 关联项
 */
import React from 'react';
import {
  Typography,
  Space,
  Tag,
  Button,
  Card,
  Descriptions,
  Row,
  Col,
  Spin,
  Empty,
} from 'antd';
import {
  EditOutlined,
  LinkOutlined,
  ArrowRightOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { spacing, radius, shadows } from '@/tokens';
import { severityConfig, statusConfig, statusTransitions } from './config';
import type { Problem } from '@/api/problem';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export interface ProblemDetailTabProps {
  selectedProblem: Problem | null;
  detailLoading: boolean;
  statusUpdating: boolean;
  setActiveTab: (tab: string) => void;
  handleStatusTransition: (status: string) => void;
  handleOpenEditModal: (problem: Problem) => void;
  linkFormReset: () => void;
  setLinkIncidentModalVisible: (v: boolean) => void;
  setLinkChangeModalVisible: (v: boolean) => void;
}

export const ProblemDetailTab: React.FC<ProblemDetailTabProps> = ({
  selectedProblem,
  detailLoading,
  statusUpdating,
  setActiveTab,
  handleStatusTransition,
  handleOpenEditModal,
  linkFormReset,
  setLinkIncidentModalVisible,
  setLinkChangeModalVisible,
}) => {
  if (!selectedProblem) {
    return <Empty description="请选择一个问题查看详情" />;
  }

  return (
    <Spin spinning={detailLoading}>
      <Space direction="vertical" size={spacing.md} style={{ width: '100%' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: spacing.sm,
          }}
        >
          <div>
            <Space align="center" style={{ marginBottom: spacing.sm }}>
              <Title level={3} style={{ margin: 0 }}>
                {selectedProblem.title}
              </Title>
              <Tag
                color={severityConfig[selectedProblem.severity]?.color}
                icon={severityConfig[selectedProblem.severity]?.icon}
              >
                {severityConfig[selectedProblem.severity]?.label}
              </Tag>
              <Tag color={statusConfig[selectedProblem.status]?.color}>
                {statusConfig[selectedProblem.status]?.label}
              </Tag>
            </Space>
          </div>
          <Space wrap>
            {(statusTransitions[selectedProblem.status] || []).map((t) => (
              <Button
                key={t.status}
                type="primary"
                icon={t.icon}
                loading={statusUpdating}
                onClick={() => handleStatusTransition(t.status)}
              >
                {t.label}
              </Button>
            ))}
            <Button icon={<EditOutlined />} onClick={() => handleOpenEditModal(selectedProblem)}>
              编辑
            </Button>
            <Button onClick={() => setActiveTab('list')}>返回列表</Button>
          </Space>
        </div>

        {/* Detail Descriptions */}
        <Card title="问题详情" style={{ borderRadius: radius.lg, boxShadow: shadows.card }}>
          <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
            <Descriptions.Item label="描述" span={2}>
              {selectedProblem.description || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="分类">{selectedProblem.category || '-'}</Descriptions.Item>
            <Descriptions.Item label="负责人">
              {selectedProblem.assigned_to || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="根因分析" span={2}>
              {selectedProblem.root_cause || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="临时解决方案" span={2}>
              {selectedProblem.workaround || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="永久解决方案" span={2}>
              {selectedProblem.resolution || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="创建人">
              {selectedProblem.created_by || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {selectedProblem.created_at
                ? dayjs(selectedProblem.created_at).format('YYYY-MM-DD HH:mm:ss')
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="解决时间">
              {selectedProblem.resolved_at
                ? dayjs(selectedProblem.resolved_at).format('YYYY-MM-DD HH:mm:ss')
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="关闭时间">
              {selectedProblem.closed_at
                ? dayjs(selectedProblem.closed_at).format('YYYY-MM-DD HH:mm:ss')
                : '-'}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* Related items */}
        <Card
          title="关联项"
          style={{ borderRadius: radius.lg, boxShadow: shadows.card }}
          extra={
            <Space>
              <Button
                size="small"
                icon={<LinkOutlined />}
                onClick={() => {
                  linkFormReset();
                  setLinkIncidentModalVisible(true);
                }}
              >
                关联事件
              </Button>
              <Button
                size="small"
                icon={<LinkOutlined />}
                onClick={() => {
                  linkFormReset();
                  setLinkChangeModalVisible(true);
                }}
              >
                关联变更
              </Button>
            </Space>
          }
        >
          <Row gutter={[spacing.md, spacing.md]}>
            <Col xs={24} sm={12}>
              <Text strong style={{ display: 'block', marginBottom: spacing.sm }}>
                关联事件 ({selectedProblem.related_incidents?.length || 0})
              </Text>
              {selectedProblem.related_incidents?.length > 0 ? (
                <Space wrap>
                  {selectedProblem.related_incidents.map((id) => (
                    <Tag key={id} color="red" style={{ cursor: 'pointer' }}>
                      <ExclamationCircleOutlined /> {id}
                    </Tag>
                  ))}
                </Space>
              ) : (
                <Text type="secondary">暂无关联事件</Text>
              )}
            </Col>
            <Col xs={24} sm={12}>
              <Text strong style={{ display: 'block', marginBottom: spacing.sm }}>
                关联变更 ({selectedProblem.related_changes?.length || 0})
              </Text>
              {selectedProblem.related_changes?.length > 0 ? (
                <Space wrap>
                  {selectedProblem.related_changes.map((id) => (
                    <Tag key={id} color="blue" style={{ cursor: 'pointer' }}>
                      <ArrowRightOutlined /> {id}
                    </Tag>
                  ))}
                </Space>
              ) : (
                <Text type="secondary">暂无关联变更</Text>
              )}
            </Col>
          </Row>
        </Card>
      </Space>
    </Spin>
  );
};
