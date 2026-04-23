/**
 * Diagnostic Sessions Page
 * List diagnostic sessions, view details, add symptoms, complete sessions
 */
import React, { useState, useEffect } from 'react';
import { Typography, Button, Space, Tag, Modal, Form, Input, Select, message, Drawer } from 'antd';
import { colors, spacing } from '@/tokens';
import { PlusOutlined, ReloadOutlined, SearchOutlined, CheckCircleOutlined } from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import { getSessions, getSession, addSymptom, completeSession } from '@/api/diagnostic';
import type { DiagnosticSession, DiagnosticSymptom } from '@/api/diagnostic';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const statusConfig: Record<string, { color: string; label: string }> = {
  running: { color: 'blue', label: '运行中' },
  completed: { color: 'green', label: '已完成' },
  failed: { color: 'red', label: '失败' },
  pending: { color: 'orange', label: '等待中' },
};

const DiagnosticSessions: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<DiagnosticSession[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [symptomModalVisible, setSymptomModalVisible] = useState(false);
  const [selectedSession, setSelectedSession] = useState<DiagnosticSession | null>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [sessionDetail, setSessionDetail] = useState<any>(null);
  const [symptomForm] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await getSessions();
      const apiData = response.data.data;
      setSessions(Array.isArray(apiData) ? apiData : []);
    } catch (error) {
      console.error('Failed to load diagnostic sessions:', error);
      message.error('加载诊断会话失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredSessions = React.useMemo(() => {
    return sessions.filter((s) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchable = [s.id, s.triggerType, s.triggerId, s.status].join(' ').toLowerCase();
        if (!searchable.includes(query)) return false;
      }
      const statusFilter = filters.status;
      if (statusFilter && statusFilter !== 'all' && s.status !== statusFilter) return false;
      return true;
    });
  }, [searchQuery, filters, sessions]);

  const filterDefs: FilterDefinition[] = [
    {
      key: 'status',
      label: '状态',
      options: [
        { label: '全部', value: 'all' },
        { label: '运行中', value: 'running' },
        { label: '已完成', value: 'completed' },
        { label: '失败', value: 'failed' },
        { label: '等待中', value: 'pending' },
      ],
    },
    {
      key: 'triggerType',
      label: '触发类型',
      options: [
        { label: '全部', value: 'all' },
        { label: 'Manual', value: 'manual' },
        { label: 'Automated', value: 'automated' },
        { label: 'Alert', value: 'alert' },
      ],
    },
  ];

  const showSessionDetail = async (session: DiagnosticSession) => {
    setSelectedSession(session);
    setDetailDrawerVisible(true);
    try {
      const res = await getSession(session.id);
      setSessionDetail(res.data.data);
    } catch (error) {
      message.error('加载会话详情失败');
    }
  };

  const openSymptomModal = (session: DiagnosticSession) => {
    setSelectedSession(session);
    symptomForm.resetFields();
    setSymptomModalVisible(true);
  };

  const handleAddSymptom = async (values: any) => {
    if (!selectedSession) return;
    try {
      await addSymptom(selectedSession.id, values);
      message.success('症状已添加');
      setSymptomModalVisible(false);
      loadData();
      if (detailDrawerVisible) {
        const res = await getSession(selectedSession.id);
        setSessionDetail(res.data.data);
      }
    } catch (error) {
      message.error('添加症状失败');
    }
  };

  const handleCompleteSession = async (session: DiagnosticSession) => {
    Modal.confirm({
      title: '完成诊断会话',
      content: `确定要完成会话 ${session.id} 吗？完成后将生成诊断报告。`,
      onOk: async () => {
        try {
          await completeSession(session.id);
          message.success('会话已完成');
          loadData();
        } catch (error) {
          message.error('完成会话失败');
        }
      },
    });
  };

  const columns: TableColumn<any>[] = [
    {
      key: 'id',
      title: '会话ID',
      dataIndex: 'id',
      render: (v: unknown) => {
        const value = v as string;
        return (
        <Text
          code
          style={{ fontSize: spacing[3], color: colors.purple[500], cursor: 'pointer' }}
          onClick={() => {
            const s = sessions.find((item) => item.id === value);
            if (s) showSessionDetail(s);
          }}
        >
          {value}
        </Text>
      );
    },
    },
    {
      key: 'triggerType',
      title: '触发类型',
      dataIndex: 'triggerType',
      width: 120,
      render: (v: unknown) => <Tag color="purple">{v as string}</Tag>,
    },
    {
      key: 'triggerId',
      title: '触发器ID',
      dataIndex: 'triggerId',
      width: 140,
      render: (v: unknown) => <Text code style={{ fontSize: spacing[2] }}>{v as string}</Text>,
    },
    {
      key: 'symptomCount',
      title: '症状数',
      dataIndex: 'symptomCount',
      width: 90,
      render: (v: unknown) => <Text strong>{v as number}</Text>,
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: unknown) => {
        const value = v as string;
        const cfg = statusConfig[value];
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      key: 'startTime',
      title: '开始时间',
      dataIndex: 'startTime',
      sortable: true,
      width: 160,
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {dayjs(v as string).format('YYYY-MM-DD HH:mm:ss')}
        </Text>
      ),
    },
    {
      key: 'duration',
      title: '持续时间',
      dataIndex: 'duration',
      width: 100,
      render: (v: unknown) => {
        const value = v as number | undefined;
        if (!value) return <Text type="secondary">-</Text>;
        return <Text>{Math.floor(value / 60000)}m {Math.floor((value % 60000) / 1000)}s</Text>;
      },
    },
    {
      key: 'actions',
      title: '操作',
      width: 180,
      render: (_: unknown, record: any) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => showSessionDetail(record)}>
            详情
          </Button>
          {record.status === 'running' && (
            <>
              <Button type="link" size="small" onClick={() => openSymptomModal(record)}>
                添加症状
              </Button>
              <Button type="link" size="small" onClick={() => handleCompleteSession(record)}>
                完成
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <SearchOutlined style={{ marginRight: 8 }} />
            诊断会话
          </Title>
          <Text type="secondary">共 {sessions.length} 个会话</Text>
        </div>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/diagnostic/trigger')}>
            新诊断
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      <div style={{ marginBottom: 16 }}>
        <SearchFilterBar
          onSearch={setSearchQuery}
          onFilter={setFilters}
          filters={filterDefs}
          searchPlaceholder="搜索会话ID、触发器..."
        />
      </div>

      <Table
        columns={columns}
        dataSource={filteredSessions}
        loading={loading}
        rowKey="id"
        size="middle"
        striped
      />

      {/* Add Symptom Modal */}
      <Modal
        title="添加症状"
        open={symptomModalVisible}
        onCancel={() => setSymptomModalVisible(false)}
        footer={null}
        width={480}
      >
        <Form form={symptomForm} layout="vertical" onFinish={handleAddSymptom}>
          <Form.Item name="type" label="症状类型" rules={[{ required: true, message: '请输入症状类型' }]}>
            <Input placeholder="例如：high_latency, error_rate" />
          </Form.Item>
          <Form.Item name="source" label="来源" rules={[{ required: true, message: '请输入来源' }]}>
            <Input placeholder="例如：api-gateway, database" />
          </Form.Item>
          <Form.Item name="severity" label="严重级别">
            <Select
              options={[
                { label: '低', value: 'low' },
                { label: '中', value: 'medium' },
                { label: '高', value: 'high' },
                { label: '严重', value: 'critical' },
              ]}
              defaultValue="medium"
            />
          </Form.Item>
          <Form.Item name="description" label="描述" rules={[{ required: true, message: '请输入描述' }]}>
            <Input.TextArea rows={3} placeholder="详细描述症状..." />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>添加</Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Session Detail Drawer */}
      <Drawer
        title={`会话详情: ${selectedSession?.id}`}
        placement="right"
        width={600}
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
      >
        {sessionDetail && (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <div>
              <Text type="secondary">状态:</Text>{' '}
              <Tag color={statusConfig[sessionDetail.status]?.color}>
                {statusConfig[sessionDetail.status]?.label}
              </Tag>
            </div>
            <div>
              <Text type="secondary">触发类型:</Text> <Tag color="purple">{sessionDetail.triggerType}</Tag>
              <Text type="secondary" style={{ marginLeft: 16 }}>触发器ID:</Text> <Text code>{sessionDetail.triggerId}</Text>
            </div>
            <div>
              <Text type="secondary">症状数量:</Text> <Text strong>{sessionDetail.symptomCount}</Text>
            </div>
            <div>
              <Text type="secondary">开始时间:</Text>{' '}
              {dayjs(sessionDetail.startTime).format('YYYY-MM-DD HH:mm:ss')}
            </div>
            {sessionDetail.duration && (
              <div>
                <Text type="secondary">持续时间:</Text>{' '}
                {Math.floor(sessionDetail.duration / 60000)}m {Math.floor((sessionDetail.duration % 60000) / 1000)}s
              </div>
            )}
            {/* Symptoms List */}
            {sessionDetail.symptoms && sessionDetail.symptoms.length > 0 && (
              <>
                <Title level={5}>症状列表</Title>
                <Space direction="vertical" style={{ width: '100%' }}>
                  {sessionDetail.symptoms.map((symptom: DiagnosticSymptom, idx: number) => (
                    <div key={idx} style={{ padding: 12, background: colors.neutral[50], borderRadius: 6 }}>
                      <Space>
                        <Tag color="purple">{symptom.type}</Tag>
                        <Text strong>{symptom.source}</Text>
                      </Space>
                      <div style={{ marginTop: 8 }}>
                        <Text>{symptom.description}</Text>
                      </div>
                    </div>
                  ))}
                </Space>
              </>
            )}
            {sessionDetail.status === 'running' && (
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => {
                  if (selectedSession) handleCompleteSession(selectedSession);
                }}
              >
                完成会话
              </Button>
            )}
          </Space>
        )}
      </Drawer>
    </div>
  );
};

export default DiagnosticSessions;
