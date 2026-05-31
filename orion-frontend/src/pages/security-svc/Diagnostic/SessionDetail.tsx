/**
 * Diagnostic Session Detail Page
 * Detailed view of a single diagnostic session with symptoms, findings, and actions
 */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography,
  Card,
  Button,
  Space,
  Tag,
  Spin,
  message,
  Descriptions,
  Table,
  Alert,
} from 'antd';
import { DesktopOutlined, ArrowLeftOutlined, CheckCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { getSession, completeSession, getSessionComplexity } from '@/api/diagnostic';
import type { DiagnosticSymptom } from '@/api/diagnostic';
import dayjs from 'dayjs';
import { colors } from '@/tokens';

const { Title, Text } = Typography;

const statusConfig: Record<string, { color: string; label: string }> = {
  running: { color: 'blue', label: '运行中' },
  completed: { color: 'green', label: '已完成' },
  failed: { color: 'red', label: '失败' },
  pending: { color: 'orange', label: '等待中' },
};

const DiagnosticSessionDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [complexity, setComplexity] = useState<any>(null);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [sessionRes, complexityRes] = await Promise.all([
        getSession(id),
        getSessionComplexity(id),
      ]);
      setSession(sessionRes.data);
      setComplexity(complexityRes.data);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载会话详情失败：${error.message}`);
      } else {
        message.error('加载会话详情失败');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleComplete = async () => {
    if (!id) return;
    try {
      await completeSession(id);
      message.success('会话已完成');
      loadData();
    } catch (error) {
      message.error('完成会话失败');
    }
  };

  const symptomColumns = [
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 140,
      render: (v: unknown) => <Tag color="purple">{v as string}</Tag>,
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      width: 140,
      render: (v: unknown) => <Text code>{v as string}</Text>,
    },
    {
      title: '严重级别',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (v: unknown) => {
        const value = v as string;
        const colorMap: Record<string, string> = {
          low: 'blue',
          medium: 'orange',
          high: 'red',
          critical: 'magenta',
        };
        return <Tag color={colorMap[value] || 'default'}>{value}</Tag>;
      },
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (v: unknown) => <Text>{v as string}</Text>,
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!session) {
    return (
      <Alert
        type="warning"
        message="未找到会话"
        description="该诊断会话不存在或已被删除"
        showIcon
      />
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/diagnostic/sessions')}
        >
          返回
        </Button>
        <div style={{ flex: 1 }}>
          <Title level={2} style={{ marginBottom: 8 }}>
            <DesktopOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            会话详情
          </Title>
          <Text type="secondary" code>
            {session.id}
          </Text>
        </div>
        <Space>
          {session.status === 'running' && (
            <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleComplete}>
              完成会话
            </Button>
          )}
          <Button icon={<ReloadOutlined />} onClick={loadData}>
            刷新
          </Button>
        </Space>
      </div>

      {/* Session Info */}
      <Card title="会话信息" style={{ marginBottom: 16 }}>
        <Descriptions column={3} size="small">
          <Descriptions.Item label="状态">
            <Tag color={statusConfig[session.status]?.color}>
              {statusConfig[session.status]?.label}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="触发类型">{session.triggerType}</Descriptions.Item>
          <Descriptions.Item label="触发器ID">
            <Text code>{session.triggerId}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="症状数">{session.symptomCount}</Descriptions.Item>
          <Descriptions.Item label="开始时间">
            {dayjs(session.startTime).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
          <Descriptions.Item label="持续时间">
            {session.duration
              ? `${Math.floor(session.duration / 60000)}m ${Math.floor((session.duration % 60000) / 1000)}s`
              : '进行中'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Complexity */}
      {complexity && (
        <Card title="复杂度分析" style={{ marginBottom: 16 }}>
          <Descriptions column={3} size="small">
            <Descriptions.Item label="复杂度等级">
              <Tag
                color={
                  complexity.complexity === 'high'
                    ? 'red'
                    : complexity.complexity === 'medium'
                      ? 'orange'
                      : 'green'
                }
              >
                {complexity.complexity}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="评分">{complexity.score}</Descriptions.Item>
            <Descriptions.Item label="因素">
              <Space>
                {complexity.factors.map((f: string, idx: number) => (
                  <Tag key={idx}>{f}</Tag>
                ))}
              </Space>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {/* Symptoms */}
      <Card title="症状列表">
        {session.symptoms && session.symptoms.length > 0 ? (
          <Table
            columns={symptomColumns}
            dataSource={session.symptoms}
            rowKey={(record: DiagnosticSymptom, idx) => `${record.type}-${idx}`}
            pagination={false}
            size="small"
          />
        ) : (
          <Text type="secondary">暂无症状</Text>
        )}
      </Card>
    </div>
  );
};

export default DiagnosticSessionDetail;
