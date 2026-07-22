/**
 * Diagnostic Knowledge Base Page
 * Search and manage diagnostic patterns, view knowledge base stats
 */
import React, { useState, useEffect } from 'react';
import { 
  Typography,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  message,
  Drawer,
  Descriptions,
  Statistic,
  Row,
  Col,
  Card,
} from 'antd';
import { colors, spacing } from '@/tokens';
import { ReadOutlined, PlusOutlined, ReloadOutlined, BookOutlined, SearchOutlined } from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import { searchPatterns, getPattern, addPattern, getKnowledgeStats } from '@/api/diagnostic';
import type { DiagnosticPattern } from '@/api/diagnostic';

const { Title, Text } = Typography;

const categoryConfig: Record<string, { color: string }> = {
  performance: { color: 'blue' },
  availability: { color: 'red' },
  security: { color: 'orange' },
  configuration: { color: 'purple' },
  infrastructure: { color: 'green' },
};

const DiagnosticKnowledgeBase: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [patterns, setPatterns] = useState<DiagnosticPattern[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedPattern, setSelectedPattern] = useState<DiagnosticPattern | null>(null);
  const [addForm] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [patternsRes, statsRes] = await Promise.all([searchPatterns(), getKnowledgeStats()]);
      const patternsData = patternsRes.data;
      setPatterns(Array.isArray(patternsData) ? patternsData : []);
      setStats(statsRes.data);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载知识库失败：${error.message}`);
      } else {
        message.error('加载知识库失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    try {
      const params: any = {};
      if (query) params.keyword = query;
      if (filters.category && filters.category !== 'all') params.category = filters.category;
      const response = await searchPatterns(params);
      const apiData = response.data;
      setPatterns(Array.isArray(apiData) ? apiData : []);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`搜索模式失败：${error.message}`);
      } else {
        message.error('搜索模式失败，请稍后重试');
      }
    }
  };

  const filterDefs: FilterDefinition[] = [
    {
      key: 'category',
      label: '分类',
      options: [
        { label: '全部', value: 'all' },
        { label: '性能', value: 'performance' },
        { label: '可用性', value: 'availability' },
        { label: '安全', value: 'security' },
        { label: '配置', value: 'configuration' },
        { label: '基础设施', value: 'infrastructure' },
      ],
    },
  ];

  const handleFilter = async (newFilters: Record<string, string | string[] | undefined>) => {
    setFilters(newFilters);
    try {
      const params: any = {};
      if (searchQuery) params.keyword = searchQuery;
      if (newFilters.category && newFilters.category !== 'all')
        params.category = newFilters.category;
      const response = await searchPatterns(params);
      const apiData = response.data;
      setPatterns(Array.isArray(apiData) ? apiData : []);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`筛选失败：${error.message}`);
      } else {
        message.error('筛选失败，请稍后重试');
      }
    }
  };

  const showDetail = async (pattern: DiagnosticPattern) => {
    setSelectedPattern(pattern);
    setDetailDrawerVisible(true);
    try {
      const res = await getPattern(pattern.id);
      setSelectedPattern(res.data);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载模式详情失败：${error.message}`);
      } else {
        message.error('加载模式详情失败，请稍后重试');
      }
    }
  };

  const handleAddPattern = async (values: any) => {
    try {
      let symptoms: string[] = [];
      if (typeof values.symptoms === 'string') {
        symptoms = values.symptoms.split(',').map((s: string) => s.trim());
      } else if (Array.isArray(values.symptoms)) {
        symptoms = values.symptoms;
      }
      await addPattern({ ...values, symptoms });
      message.success('模式已添加');
      setAddModalVisible(false);
      addForm.resetFields();
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`添加模式失败：${error.message}`);
      } else {
        message.error('添加模式失败，请稍后重试');
      }
    }
  };

  const columns: TableColumn<DiagnosticPattern>[] = [
    {
      key: 'name',
      title: '模式名称',
      dataIndex: 'name',
      sortable: true,
      filterable: true,
      render: (v: unknown, record: any) => {
        const value = v as string;
        return (
          <Text
            strong
            style={{ color: colors.purple[500], cursor: 'pointer' }}
            onClick={() => showDetail(record)}
          >
            {value}
          </Text>
        );
      },
    },
    {
      key: 'category',
      title: '分类',
      dataIndex: 'category',
      width: 120,
      render: (v: unknown) => {
        const value = v as string;
        const cfg = categoryConfig[value];
        return <Tag color={cfg?.color || 'default'}>{value}</Tag>;
      },
    },
    {
      key: 'symptoms',
      title: '症状',
      dataIndex: 'symptoms',
      render: (v: unknown) => {
        const symptoms = v as string[];
        return (
          <Space wrap>
            {symptoms.slice(0, 3).map((s, idx) => (
              <Tag key={idx} style={{ fontSize: spacing[2] }}>
                {s}
              </Tag>
            ))}
            {symptoms.length > 3 && <Tag>+{symptoms.length - 3}</Tag>}
          </Space>
        );
      },
    },
    {
      key: 'frequency',
      title: '出现频率',
      dataIndex: 'frequency',
      width: 100,
      sortable: true,
      render: (v: unknown) => <Text strong>{v as number}</Text>,
    },
    {
      key: 'rootCause',
      title: '根因',
      dataIndex: 'rootCause',
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {v as string}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 80,
      render: (_: unknown, record: any) => (
        <Button type="link" size="small" onClick={() => showDetail(record)}>
          详情
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: spacing.lg,
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <ReadOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            <BookOutlined style={{ marginRight: spacing.sm }} />
            知识库
          </Title>
          <Text type="secondary">共 {patterns.length} 个诊断模式</Text>
        </div>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalVisible(true)}>
            添加模式
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      {/* Stats */}
      {stats && (
        <Card style={{ marginBottom: spacing.md }}>
          <Row gutter={16}>
            <Col span={8}>
              <Statistic
                title="模式总数"
                value={stats.totalPatterns || 0}
                prefix={<SearchOutlined />}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="平均置信度"
                value={stats.avgConfidence ? (stats.avgConfidence * 100).toFixed(1) : 0}
                suffix="%"
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="分类数"
                value={stats.categories ? Object.keys(stats.categories).length : 0}
              />
            </Col>
          </Row>
          {stats.categories && (
            <div style={{ marginTop: spacing[3] }}>
              <Space wrap>
                {Object.entries(stats.categories).map(([cat, count]) => (
                  <Tag key={cat} color={categoryConfig[cat]?.color || 'default'}>
                    {cat}: {count as number}
                  </Tag>
                ))}
              </Space>
            </div>
          )}
        </Card>
      )}

      <div style={{ marginBottom: spacing.md }}>
        <SearchFilterBar
          onSearch={handleSearch}
          onFilter={handleFilter}
          filters={filterDefs}
          searchPlaceholder="搜索模式名称、症状、根因..."
        />
      </div>

      <Table
        columns={columns}
        dataSource={patterns}
        loading={loading}
        rowKey="id"
        size="middle"
        striped
      />

      {/* Add Pattern Modal */}
      <Modal
        title="添加诊断模式"
        open={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        footer={null}
        width={560}
      >
        <Form form={addForm} layout="vertical" onFinish={handleAddPattern}>
          <Form.Item
            name="name"
            label="模式名称"
            rules={[{ required: true, message: '请输入模式名称' }]}
          >
            <Input placeholder="例如：数据库连接池耗尽" />
          </Form.Item>
          <Form.Item
            name="category"
            label="分类"
            rules={[{ required: true, message: '请选择分类' }]}
          >
            <Select
              options={[
                { label: '性能', value: 'performance' },
                { label: '可用性', value: 'availability' },
                { label: '安全', value: 'security' },
                { label: '配置', value: 'configuration' },
                { label: '基础设施', value: 'infrastructure' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="symptoms"
            label="症状 (逗号分隔)"
            rules={[{ required: true, message: '请输入症状' }]}
          >
            <Input placeholder="例如：high_latency, connection_timeout, error_rate" />
          </Form.Item>
          <Form.Item
            name="rootCause"
            label="根因"
            rules={[{ required: true, message: '请输入根因' }]}
          >
            <Input.TextArea rows={2} placeholder="描述根本原因..." />
          </Form.Item>
          <Form.Item
            name="solution"
            label="解决方案"
            rules={[{ required: true, message: '请输入解决方案' }]}
          >
            <Input.TextArea rows={3} placeholder="描述解决方案..." />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              添加
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Pattern Detail Drawer */}
      <Drawer
        title={`模式详情: ${selectedPattern?.name}`}
        placement="right"
        width={600}
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
      >
        {selectedPattern && (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="名称">{selectedPattern.name}</Descriptions.Item>
              <Descriptions.Item label="分类">
                <Tag color={categoryConfig[selectedPattern.category]?.color}>
                  {selectedPattern.category}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="出现频率">{selectedPattern.frequency}</Descriptions.Item>
            </Descriptions>

            <div>
              <Title level={5}>症状</Title>
              <Space wrap>
                {selectedPattern.symptoms.map((s: string, idx: number) => (
                  <Tag key={idx} color="purple">
                    {s}
                  </Tag>
                ))}
              </Space>
            </div>

            <Card size="small" title="根因">
              <Text>{selectedPattern.rootCause}</Text>
            </Card>

            <Card size="small" title="解决方案">
              <Text>{selectedPattern.solution}</Text>
            </Card>
          </Space>
        )}
      </Drawer>
    </div>
  );
};

export default DiagnosticKnowledgeBase;
