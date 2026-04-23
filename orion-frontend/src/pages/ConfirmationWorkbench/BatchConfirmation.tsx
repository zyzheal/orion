/**
 * Batch Confirmation - Grouped P3 items, bulk approve
 */
import React, { useState, useMemo, useEffect } from 'react';
import { Typography, Button, Space, Tag, Card, Checkbox, message, Select } from 'antd';
import { colors, spacing } from '@/tokens';
import { ReloadOutlined, CheckCircleOutlined } from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import { getConfirmations, batchApprove, type ConfirmationRequest } from '@/api/confirmations';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const priorityColorMap: Record<string, string> = {
  P0: colors.error[400],
  P1: colors.warning[500],
  P2: colors.warning[500],
  P3: colors.success[500],
};

const BatchConfirmation: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [confirmations, setConfirmations] = useState<ConfirmationRequest[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [groupFilter, setGroupFilter] = useState<string>('P3');
  const [processing, setProcessing] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getConfirmations({ status: 'pending' });
      setConfirmations(Array.isArray(res.data.data) ? res.data.data : []);
    } catch {
      message.error('Failed to load confirmations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredConfirmations = useMemo(() => {
    return confirmations.filter((c) => {
      if (groupFilter !== 'all' && c.priority !== groupFilter) return false;
      return true;
    });
  }, [groupFilter, confirmations]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredConfirmations.map((c) => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((i) => i !== id));
    }
  };

  const handleBatchApprove = async () => {
    if (selectedIds.length === 0) {
      message.warning('请选择要确认的项目');
      return;
    }
    setProcessing(true);
    try {
      await batchApprove({ ids: selectedIds });
      message.success(`已批量确认 ${selectedIds.length} 项`);
      setSelectedIds([]);
      loadData();
    } catch {
      message.error('批量确认失败');
    } finally {
      setProcessing(false);
    }
  };

  const columns: TableColumn<any>[] = [
    {
      key: 'select',
      title: '选择',
      width: 60,
      render: (_: unknown, record: any) => (
        <Checkbox checked={selectedIds.includes(record.id)} onChange={(e) => handleSelectOne(record.id, e.target.checked)} />
      ),
    },
    {
      key: 'priority',
      title: '优先级',
      dataIndex: 'priority',
      width: 80,
      render: (v: unknown) => <Tag color={priorityColorMap[String(v)] || 'default'}>{String(v)}</Tag>,
    },
    {
      key: 'sceneType',
      title: '场景',
      dataIndex: 'sceneType',
      width: 120,
      render: (v: unknown) => <Tag color="blue">{String(v)}</Tag>,
    },
    {
      key: 'id',
      title: '确认 ID',
      dataIndex: 'id',
      width: 180,
      render: (v: unknown) => <Text code style={{ fontSize: spacing[3] }}>{String(v).slice(0, 16)}...</Text>,
    },
    {
      key: 'aiSuggestion',
      title: 'AI 建议',
      dataIndex: 'aiSuggestion',
      width: 240,
      render: (v: unknown) => <Text style={{ fontSize: spacing[3] }}>{String(v)}</Text>,
    },
    {
      key: 'aiConfidence',
      title: 'AI 置信度',
      dataIndex: 'aiConfidence',
      width: 100,
      render: (v: unknown) => <Text>{String(v)}%</Text>,
    },
    {
      key: 'pushTime',
      title: '推送时间',
      dataIndex: 'pushTime',
      width: 160,
      render: (v: unknown) => <Text type="secondary" style={{ fontSize: spacing[3] }}>{dayjs(String(v)).fromNow()}</Text>,
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>批量确认</Title>
          <Text type="secondary">按优先级分组，批量处理确认请求</Text>
        </div>
        <Space>
          <Select value={groupFilter} onChange={setGroupFilter} style={{ width: 120 }}
            options={[
              { label: '全部', value: 'all' },
              { label: 'P0', value: 'P0' },
              { label: 'P1', value: 'P1' },
              { label: 'P2', value: 'P2' },
              { label: 'P3', value: 'P3' },
            ]} />
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
        </Space>
      </div>

      <Card title={
        <Space>
          <Checkbox checked={selectedIds.length === filteredConfirmations.length && filteredConfirmations.length > 0} onChange={(e) => handleSelectAll(e.target.checked)}>全选</Checkbox>
          <Text type="secondary">已选择 {selectedIds.length} 项</Text>
        </Space>
      } extra={
        <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleBatchApprove} loading={processing} disabled={selectedIds.length === 0}>
          批量确认 ({selectedIds.length})
        </Button>
      }>
        <Table columns={columns} dataSource={filteredConfirmations as unknown as Record<string, unknown>[]} loading={loading} rowKey="id" size="middle" striped />
      </Card>
    </div>
  );
};

export default BatchConfirmation;
