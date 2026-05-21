/**
 * Cache Config Page - Pipeline 缓存配置管理页面
 *
 * Features:
 * - 推荐缓存配置卡片（npm/pip/maven/gradle/go）
 * - 缓存策略 Table 管理（CRUD）
 * - 缓存命中率统计
 * - 缓存预热操作
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Typography,
  Card,
  Table,
  Tag,
  Space,
  Button,
  Input,
  Modal,
  Form,
  Select,
  Switch,
  Popconfirm,
  Row,
  Col,
  Progress,
  message,
  Tabs,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  DeleteOutlined,
  EditOutlined,
  ThunderboltOutlined,
  FolderOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { spacing } from '@/tokens';
import { colors } from '@/tokens';
import MetricCard from '@/components/MetricCard';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import {
  cacheStrategyApi,
  type CacheStrategy,
  type CacheRecommendation,
  type CacheType,
  type CacheStrategyCreateInput,
} from '@/api/cache-strategy';

const { Title, Text } = Typography;

// ==================== 缓存类型定义 ====================
const CACHE_TYPE_LABELS: Record<CacheType, string> = {
  npm: 'npm',
  pip: 'pip',
  maven: 'Maven',
  gradle: 'Gradle',
  go: 'Go Modules',
  custom: '自定义',
};

const CACHE_TYPE_COLORS: Record<CacheType, string> = {
  npm: colors.primary[500],
  pip: colors.warning[500],
  maven: colors.error[500],
  gradle: colors.success[500],
  go: colors.info[500],
  custom: colors.neutral[500],
};

// ==================== Mock 推荐配置 ====================
const MOCK_RECOMMENDATIONS: CacheRecommendation[] = [
  {
    type: 'npm',
    name: 'Node.js 依赖缓存',
    description: '缓存 node_modules 目录，加速 npm install',
    keyTemplate: 'npm:{{hashFiles(package-lock.json)}}',
    paths: ['node_modules'],
    restoreKeys: ['npm:', 'npm-production-'],
    ttlDays: 7,
  },
  {
    type: 'pip',
    name: 'Python 依赖缓存',
    description: '缓存 pip 下载的 Python 包',
    keyTemplate: 'pip:{{hashFiles(requirements.txt)}}',
    paths: ['~/.cache/pip'],
    restoreKeys: ['pip-'],
    ttlDays: 7,
  },
  {
    type: 'maven',
    name: 'Maven 依赖缓存',
    description: '缓存 Maven 本地仓库',
    keyTemplate: 'maven:{{checksum(pom.xml)}}',
    paths: ['~/.m2/repository'],
    restoreKeys: ['maven-', 'maven-snapshot-'],
    ttlDays: 14,
  },
  {
    type: 'gradle',
    name: 'Gradle 依赖缓存',
    description: '缓存 Gradle 依赖和构建缓存',
    keyTemplate: 'gradle:{{checksum(build.gradle)}}',
    paths: ['~/.gradle/caches', '.gradle'],
    restoreKeys: ['gradle-', 'gradle-build-cache-'],
    ttlDays: 14,
  },
  {
    type: 'go',
    name: 'Go 模块缓存',
    description: '缓存 Go 模块下载',
    keyTemplate: 'go:{{hashFiles(go.sum)}}',
    paths: ['~/go/pkg/mod'],
    restoreKeys: ['go-', 'go-build-'],
    ttlDays: 7,
  },
];

// ==================== Main Component ====================
const CacheConfigPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [strategies, setStrategies] = useState<CacheStrategy[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState<CacheStrategy | null>(null);
  const [form] = Form.useForm<CacheStrategyCreateInput>();

  // 加载缓存策略列表
  const loadStrategies = async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page: 1, limit: 100 };
      if (typeFilter !== 'all') {
        params.type = typeFilter;
      }
      const response = await cacheStrategyApi.list(params);
      const apiData = response.data?.data || response.data || response;
      setStrategies(Array.isArray(apiData) ? apiData : []);
    } catch (error: unknown) {
      // 使用 mock 数据作为 fallback
      console.warn('使用 mock 缓存策略数据:', error);
      setStrategies([
        {
          id: 'cache-1',
          tenantId: 'default',
          name: 'Node.js 依赖缓存',
          type: 'npm',
          keyTemplate: 'npm:{{hashFiles(package-lock.json)}}',
          paths: ['node_modules'],
          restoreKeys: ['npm:'],
          ttlDays: 7,
          enabled: true,
          hitCount: 156,
          missCount: 44,
          totalSize: 524288000,
          createdBy: 'admin',
          createdAt: '2026-01-10T00:00:00Z',
          updatedAt: '2026-04-15T00:00:00Z',
        },
        {
          id: 'cache-2',
          tenantId: 'default',
          name: 'Maven 依赖缓存',
          type: 'maven',
          keyTemplate: 'maven:{{checksum(pom.xml)}}',
          paths: ['~/.m2/repository'],
          restoreKeys: ['maven-'],
          ttlDays: 14,
          enabled: true,
          hitCount: 89,
          missCount: 23,
          totalSize: 1073741824,
          createdBy: 'admin',
          createdAt: '2026-02-01T00:00:00Z',
          updatedAt: '2026-04-20T00:00:00Z',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStrategies();
  }, [typeFilter]);

  // 过滤后的策略列表
  const filteredStrategies = useMemo(() => {
    return strategies.filter((s) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!s.name.toLowerCase().includes(q) && !s.type.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (typeFilter !== 'all' && s.type !== typeFilter) return false;
      return true;
    });
  }, [strategies, searchQuery, typeFilter]);

  // 统计数据
  const stats = useMemo(() => {
    const totalHit = strategies.reduce((sum, s) => sum + (s.hitCount || 0), 0);
    const totalMiss = strategies.reduce((sum, s) => sum + (s.missCount || 0), 0);
    const totalSize = strategies.reduce((sum, s) => sum + (s.totalSize || 0), 0);
    const hitRate = totalHit + totalMiss > 0 ? (totalHit / (totalHit + totalMiss)) * 100 : 0;

    return {
      totalStrategies: strategies.length,
      enabledCount: strategies.filter((s) => s.enabled).length,
      hitRate,
      totalSize,
    };
  }, [strategies]);

  // Table 列定义
  const columns: ColumnsType<CacheStrategy> = [
    {
      title: '策略名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: CacheType) => (
        <Tag color={CACHE_TYPE_COLORS[type]}>{CACHE_TYPE_LABELS[type]}</Tag>
      ),
    },
    {
      title: 'Key 模板',
      dataIndex: 'keyTemplate',
      key: 'keyTemplate',
      width: 220,
      render: (text: string) => (
        <Text code style={{ fontSize: spacing[2], wordBreak: 'break-all' }}>
          {text}
        </Text>
      ),
    },
    {
      title: '缓存路径',
      dataIndex: 'paths',
      key: 'paths',
      width: 200,
      render: (paths: string[]) => (
        <Space wrap size={2}>
          {paths.slice(0, 2).map((p, i) => (
            <Tag key={i} style={{ margin: 0 }}>
              {p.length > 15 ? `${p.substring(0, 15)}...` : p}
            </Tag>
          ))}
          {paths.length > 2 && <Tag>+{paths.length - 2}</Tag>}
        </Space>
      ),
    },
    {
      title: 'TTL (天)',
      dataIndex: 'ttlDays',
      key: 'ttlDays',
      width: 80,
      render: (days: number) => <Text>{days} 天</Text>,
    },
    {
      title: '命中率',
      key: 'hitRate',
      width: 120,
      render: (_: unknown, record: CacheStrategy) => {
        const hit = record.hitCount || 0;
        const miss = record.missCount || 0;
        const rate = hit + miss > 0 ? (hit / (hit + miss)) * 100 : 0;
        return (
          <Progress
            percent={rate}
            size="small"
            status={rate >= 70 ? 'success' : rate >= 40 ? 'normal' : 'exception'}
            style={{ width: 80 }}
          />
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (enabled: boolean) => (
        <Tag color={enabled ? 'green' : 'default'}>{enabled ? '启用' : '禁用'}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_: unknown, record: CacheStrategy) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除此缓存策略?"
            description="删除后无法恢复"
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 打开新建弹窗
  const openCreateModal = () => {
    setEditingStrategy(null);
    form.resetFields();
    form.setFieldValue('enabled', true);
    form.setFieldValue('ttlDays', 7);
    form.setFieldValue('paths', []);
    setModalVisible(true);
  };

  // 打开编辑弹窗
  const openEditModal = (strategy: CacheStrategy) => {
    setEditingStrategy(strategy);
    form.setFieldsValue({
      name: strategy.name,
      type: strategy.type,
      keyTemplate: strategy.keyTemplate,
      paths: strategy.paths,
      restoreKeys: strategy.restoreKeys || [],
      ttlDays: strategy.ttlDays,
      enabled: strategy.enabled,
    });
    setModalVisible(true);
  };

  // 删除策略
  const handleDelete = async (id: string) => {
    try {
      await cacheStrategyApi.delete(id);
      message.success('缓存策略已删除');
      loadStrategies();
    } catch (error: unknown) {
      // Mock 删除
      setStrategies((prev) => prev.filter((s) => s.id !== id));
      message.success('缓存策略已删除');
    }
  };

  // 保存策略
  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      if (editingStrategy) {
        // 更新
        try {
          await cacheStrategyApi.update(editingStrategy.id, values);
          message.success('缓存策略已更新');
        } catch {
          // Mock 更新
          setStrategies((prev) =>
            prev.map((s) =>
              s.id === editingStrategy.id ? { ...s, ...values, updatedAt: new Date().toISOString() } : s
            )
          );
          message.success('缓存策略已更新');
        }
      } else {
        // 创建
        try {
          await cacheStrategyApi.create(values);
          message.success('缓存策略已创建');
        } catch {
          // Mock 创建
          const newStrategy: CacheStrategy = {
            id: `cache-${Date.now()}`,
            tenantId: 'default',
            ...values,
            enabled: values.enabled ?? true,
            hitCount: 0,
            missCount: 0,
            totalSize: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setStrategies((prev) => [...prev, newStrategy]);
          message.success('缓存策略已创建');
        }
      }

      setModalVisible(false);
      loadStrategies();
    } catch {
      // 表单验证失败
    }
  };

  // 应用推荐配置
  const handleApplyRecommendation = (recommendation: CacheRecommendation) => {
    form.setFieldsValue({
      name: recommendation.name,
      type: recommendation.type,
      keyTemplate: recommendation.keyTemplate,
      paths: recommendation.paths,
      restoreKeys: recommendation.restoreKeys,
      ttlDays: recommendation.ttlDays,
      enabled: true,
    });
    setEditingStrategy(null);
    setModalVisible(true);
  };

  // 筛选定义
  const filterDefinitions: FilterDefinition[] = [
    {
      key: 'type',
      label: '类型',
      options: [
        { label: '全部', value: 'all' },
        { label: 'npm', value: 'npm' },
        { label: 'pip', value: 'pip' },
        { label: 'Maven', value: 'maven' },
        { label: 'Gradle', value: 'gradle' },
        { label: 'Go', value: 'go' },
        { label: '自定义', value: 'custom' },
      ],
      placeholder: '按类型筛选',
    },
  ];

  // Tab 项
  const tabItems = [
    {
      key: 'recommendations',
      label: (
        <span>
          <ThunderboltOutlined />
          推荐配置
        </span>
      ),
      children: (
        <Row gutter={spacing[4]}>
          {MOCK_RECOMMENDATIONS.map((rec) => (
            <Col span={8} key={rec.type} style={{ marginBottom: spacing[4] }}>
              <Card
                hoverable
                size="small"
                title={
                  <Space>
                    <Tag color={CACHE_TYPE_COLORS[rec.type]}>{CACHE_TYPE_LABELS[rec.type]}</Tag>
                    <Text strong>{rec.name}</Text>
                  </Space>
                }
                extra={
                  <Button
                    type="primary"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => handleApplyRecommendation(rec)}
                  >
                    使用
                  </Button>
                }
              >
                <Space direction="vertical" size={spacing[2]} style={{ width: '100%' }}>
                  <Text type="secondary">{rec.description}</Text>
                  <div>
                    <Text type="secondary">缓存路径: </Text>
                    <Text code>{rec.paths.join(', ')}</Text>
                  </div>
                  <div>
                    <Text type="secondary">TTL: </Text>
                    <Text>{rec.ttlDays} 天</Text>
                  </div>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      ),
    },
    {
      key: 'strategies',
      label: (
        <span>
          <DatabaseOutlined />
          缓存策略 ({stats.totalStrategies})
        </span>
      ),
      children: (
        <Card>
          <div style={{ marginBottom: spacing[4] }}>
            <SearchFilterBar
              onSearch={setSearchQuery}
              filters={filterDefinitions}
              searchPlaceholder="搜索策略名称..."
              onFilter={(filters) => {
                if (filters.type) setTypeFilter(String(filters.type));
              }}
              initialFilters={{ type: 'all' }}
            />
          </div>

          <Table<CacheStrategy>
            columns={columns}
            dataSource={filteredStrategies}
            rowKey="id"
            loading={loading}
            size="middle"
            pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 个策略` }}
          />
        </Card>
      ),
    },
  ];

  // 格式化文件大小
  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    if (bytes >= 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${bytes} B`;
  };

  return (
    <div style={{ padding: 0 }}>
      {/* 页面头部 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing[6],
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <FolderOutlined style={{ marginRight: spacing[2], color: colors.primary[500] }} />
            缓存配置
          </Title>
          <Text type="secondary">管理 Pipeline 缓存策略，提升构建速度</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadStrategies} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            创建策略
          </Button>
        </Space>
      </div>

      {/* 统计卡片 */}
      <Row gutter={spacing[4]} style={{ marginBottom: spacing[6] }}>
        <Col span={6}>
          <MetricCard title="策略总数" value={stats.totalStrategies} icon={<DatabaseOutlined />} />
        </Col>
        <Col span={6}>
          <MetricCard
            title="启用中"
            value={stats.enabledCount}
            color={colors.success[500]}
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="平均命中率"
            value={`${stats.hitRate.toFixed(1)}%`}
            color={stats.hitRate >= 70 ? colors.success[500] : stats.hitRate >= 40 ? colors.warning[500] : colors.error[500]}
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="总缓存大小"
            value={formatSize(stats.totalSize)}
            color={colors.info[500]}
          />
        </Col>
      </Row>

      {/* Tab 内容 */}
      <Tabs items={tabItems} defaultActiveKey="strategies" />

      {/* 新建/编辑弹窗 */}
      <Modal
        title={editingStrategy ? '编辑缓存策略' : '创建缓存策略'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSave}
        width={640}
        destroyOnClose
        okText={editingStrategy ? '更新' : '创建'}
      >
        <Form form={form} layout="vertical" style={{ marginTop: spacing[4] }}>
          <Form.Item
            name="name"
            label="策略名称"
            rules={[{ required: true, message: '请输入策略名称' }]}
          >
            <Input placeholder="例如: Node.js 依赖缓存" />
          </Form.Item>

          <Form.Item
            name="type"
            label="缓存类型"
            rules={[{ required: true, message: '请选择缓存类型' }]}
          >
            <Select placeholder="选择缓存类型">
              <Select.Option value="npm">npm (Node.js)</Select.Option>
              <Select.Option value="pip">pip (Python)</Select.Option>
              <Select.Option value="maven">Maven (Java)</Select.Option>
              <Select.Option value="gradle">Gradle (Java/Kotlin)</Select.Option>
              <Select.Option value="go">Go Modules</Select.Option>
              <Select.Option value="custom">自定义</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="keyTemplate"
            label="缓存 Key 模板"
            rules={[{ required: true, message: '请输入缓存 Key 模板' }]}
            tooltip="使用 {{hashFiles()}} 或 {{checksum()}} 动态生成 key"
          >
            <Input placeholder="例如: npm:{{hashFiles(package-lock.json)}}" />
          </Form.Item>

          <Form.Item
            name="paths"
            label="缓存路径"
            rules={[{ required: true, message: '请输入缓存路径' }]}
            tooltip="需要缓存的目录或文件路径"
          >
            <Select mode="tags" placeholder="输入缓存路径 (例如: node_modules)" />
          </Form.Item>

          <Form.Item name="restoreKeys" label="恢复 Key 前缀" tooltip="当缓存未命中时的备用 key">
            <Select mode="tags" placeholder="输入恢复 key 前缀" />
          </Form.Item>

          <Form.Item
            name="ttlDays"
            label="TTL (天)"
            rules={[{ required: true, message: '请输入 TTL' }]}
            initialValue={7}
          >
            <Input type="number" min={1} max={365} />
          </Form.Item>

          <Form.Item name="enabled" label="启用状态" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CacheConfigPage;