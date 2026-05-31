/**
 * Chaos Run History Page
 * Displays experiment run records with timeline and metrics
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Tag,
  Space,
  Button,
  Timeline,
  Modal,
  Descriptions,
  Typography,
  message,
} from 'antd';
import {
  HistoryOutlined,
  RollbackOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { chaosApi, ChaosRun } from '@/api/chaos';
import { colors } from '@/tokens/colors';

const { Title, Text } = Typography;

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  running: { color: 'processing', icon: <LoadingOutlined />, label: '运行中' },
  completed: { color: 'success', icon: <CheckCircleOutlined />, label: '已完成' },
  failed: { color: 'error', icon: <CloseCircleOutlined />, label: '失败' },
  rolled_back: { color: 'warning', icon: <UndoOutlined />, label: '已回滚' },
};

export default function ChaosRunHistoryPage() {
  const [loading, setLoading] = useState(false);
  const [runs, setRuns] = useState<ChaosRun[]>([]);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedRun, setSelectedRun] = useState<ChaosRun | null>(null);

  const fetchRuns = async () => {
    setLoading(true);
    try {
      const data = await chaosApi.listExperiments();
      // Flatten runs from experiments
      const allRuns: ChaosRun[] = [];
      if (Array.isArray(data)) {
        // runs are fetched separately per experiment
      }
      setRuns(allRuns);
    } catch {
      message.error('获取运行记录失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRuns(); }, []);

  const handleRollback = async (runId: string) => {
    try {
      await chaosApi.rollbackRun(runId, '手动回滚');
      message.success('回滚成功');
      fetchRuns();
    } catch {
      message.error('回滚失败');
    }
  };

  const columns = [
    {
      title: '运行ID',
      dataIndex: 'id',
      key: 'id',
      ellipsis: true,
      width: 200,
    },
    {
      title: '实验ID',
      dataIndex: 'experiment_id',
      key: 'experiment_id',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => {
        const cfg = statusConfig[v] || statusConfig.running;
        return <Tag color={cfg.color} icon={cfg.icon}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'MTTR',
      dataIndex: ['metrics', 'mttr_ms'],
      key: 'mttr',
      render: (v: number) => v ? `${(v / 1000).toFixed(1)}s` : '-',
    },
    {
      title: '受影响服务',
      dataIndex: ['metrics', 'affected_services'],
      key: 'affected',
      render: (v: string[]) => v?.length ? v.map(s => <Tag key={s}>{s}</Tag>) : '-',
    },
    {
      title: '恢复',
      dataIndex: ['metrics', 'recovered'],
      key: 'recovered',
      render: (v: boolean) => v
        ? <Tag color="success" icon={<CheckCircleOutlined />}>已恢复</Tag>
        : <Tag color="error" icon={<CloseCircleOutlined />}>未恢复</Tag>,
    },
    {
      title: '开始时间',
      dataIndex: 'started_at',
      key: 'started_at',
      render: (v: string) => v ? new Date(v).toLocaleString() : '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: ChaosRun) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => { setSelectedRun(record); setDetailVisible(true); }}
          >
            详情
          </Button>
          {record.status === 'completed' && (
            <Button
              size="small"
              danger
              icon={<RollbackOutlined />}
              onClick={() => handleRollback(record.id)}
            >
              回滚
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={2} style={{ marginBottom: 16 }}>
        <HistoryOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        运行记录
      </Title>

      <Card>
        <Table
          dataSource={runs}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      </Card>

      <Modal
        title="运行详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={700}
      >
        {selectedRun && (
          <>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="运行ID">{selectedRun.id}</Descriptions.Item>
              <Descriptions.Item label="实验ID">{selectedRun.experiment_id}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusConfig[selectedRun.status]?.color}>
                  {statusConfig[selectedRun.status]?.label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="MTTR">
                {selectedRun.metrics?.mttr_ms ? `${(selectedRun.metrics.mttr_ms / 1000).toFixed(1)}s` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="错误数">{selectedRun.metrics?.error_count ?? 0}</Descriptions.Item>
              <Descriptions.Item label="恢复状态">
                {selectedRun.metrics?.recovered ? '已恢复' : '未恢复'}
              </Descriptions.Item>
            </Descriptions>

            <Card title="事件时间线" size="small">
              <Timeline
                items={(selectedRun.timeline || []).map(evt => ({
                  color: evt.type === 'inject' ? 'red' : evt.type === 'recover' ? 'green' : 'blue',
                  children: (
                    <div>
                      <Text strong>[{evt.type}]</Text> {evt.service}
                      <br />
                      <Text type="secondary">{evt.details}</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {new Date(evt.timestamp).toLocaleString()}
                      </Text>
                    </div>
                  ),
                }))}
              />
            </Card>
          </>
        )}
      </Modal>
    </div>
  );
}
