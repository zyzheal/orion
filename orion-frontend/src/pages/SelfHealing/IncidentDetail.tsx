/**
 * Self-Healing - Incident Detail
 * Detailed view of a single self-healing incident
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Descriptions,
  Tag,
  Spin,
  Space,
  Button,
  Alert,
  Timeline,
  message,
} from 'antd';
import { ArrowLeftOutlined, ReloadOutlined, FileTextOutlined,} from '@ant-design/icons';
import { getIncident } from '@/api/self-healing';
import type { SelfHealingIncident } from '@/api/self-healing';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { colors, spacing } from '@/tokens';

const { Title } = Typography;

const IncidentDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(false);
  const [incident, setIncident] = useState<SelfHealingIncident | null>(null);

  const loadDetail = async () => {
    if (!id) {
      message.warning('缺少事件 ID');
      return;
    }
    setLoading(true);
    try {
      const res = await getIncident(id);
      setIncident((res.data || null) as unknown as SelfHealingIncident | null);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载事件详情失败：${error.message}`);
      } else {
        message.error('加载事件详情失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [id]);

  if (loading) {
    return (
      <div style={{ padding: spacing.lg, textAlign: 'center' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!incident) {
    return (
      <div style={{ padding: spacing.lg }}>
        <Alert
          message="未找到事件记录"
          description="请检查事件 ID 是否正确"
          type="error"
          action={<Button onClick={() => navigate('/console/self-healing/incidents')}>返回列表</Button>}
        />
      </div>
    );
  }

  const severityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'red';
      case 'warning':
        return 'orange';
      case 'info':
        return 'blue';
      default:
        return 'default';
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'resolved':
        return 'green';
      case 'healing':
        return 'blue';
      case 'pending':
        return 'orange';
      case 'failed':
        return 'red';
      default:
        return 'default';
    }
  };

  const duration = dayjs(incident.updatedAt).diff(dayjs(incident.createdAt), 'minute');

  return (
    <div style={{ padding: spacing.lg }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/console/self-healing/incidents')}>
          返回
        </Button>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
            <FileTextOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
          事件详情
        </Title>
        <Button icon={<ReloadOutlined />} onClick={loadDetail}>
          刷新
        </Button>
      </div>

      {/* Status Alert */}
      <Alert
        message={
          <Space>
            当前状态: <Tag color={statusColor(incident.status)}>{incident.status}</Tag>
            <Tag color={severityColor(incident.severity)}>{incident.severity}</Tag>
          </Space>
        }
        type={
          incident.status === 'resolved'
            ? 'success'
            : incident.status === 'failed'
              ? 'error'
              : 'info'
        }
        style={{ marginBottom: spacing.lg }}
      />

      {/* Basic Info */}
      <Card title="基本信息" style={{ marginBottom: spacing.md }}>
        <Descriptions column={2} bordered>
          <Descriptions.Item label="事件 ID">{incident.id}</Descriptions.Item>
          <Descriptions.Item label="类型">{incident.type}</Descriptions.Item>
          <Descriptions.Item label="应用">{incident.appName}</Descriptions.Item>
          <Descriptions.Item label="环境">{incident.environment}</Descriptions.Item>
          <Descriptions.Item label="策略">{incident.strategy || '未分配'}</Descriptions.Item>
          <Descriptions.Item label="处理耗时">
            {duration > 0 ? `${duration} 分钟` : '< 1 分钟'}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {dayjs(incident.createdAt).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间">
            {dayjs(incident.updatedAt).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Timeline */}
      <Card title="事件时间线">
        <Timeline
          items={[
            {
              color: 'blue',
              children: `事件触发 (${dayjs(incident.createdAt).format('HH:mm:ss')})`,
            },
            {
              color: 'orange',
              children: incident.strategy ? `策略 ${incident.strategy} 已分配` : '等待策略分配',
            },
            {
              color: incident.status === 'resolved' ? 'green' : 'blue',
              children: incident.status === 'resolved' ? '事件已解决' : '处理中...',
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default IncidentDetail;
