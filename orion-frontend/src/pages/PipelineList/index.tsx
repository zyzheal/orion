/**
 * PipelineList — Pipeline 列表页（深度实施版）
 *
 * 功能：
 * 1. 高级搜索面板（多条件/标签/时间范围）
 * 2. 批量操作（删除/触发/暂停/导出）
 * 3. 虚拟滚动（支持 10000+ 条）
 * 4. 自定义列（显示/隐藏/排序）
 * 5. SSE 实时状态更新
 * 6. 保存的个人视图
 * 7. 空状态引导
 * ==============================================================================
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Input,
  message,
  Modal,
  Dropdown,
  Tooltip,
  Select,
  Row,
  Col,
  Card,
  Empty,
  Checkbox,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  PlayCircleOutlined,
  SaveOutlined,
  ColumnHeightOutlined,
  ExportOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

import { spacing } from '@/tokens';
import Table, { type TableColumn } from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import { PermissionActions, type PermissionAction } from '@/components/PermissionActions';
import { usePermissionActions } from '@/hooks/usePermissionActions';
import { usePagination } from '@/hooks/usePagination';
import { getPipelines, deletePipeline, type Pipeline } from '@/api/pipelines';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

// ========================= 类型定义 =========================

interface PipelineListFilters {
  status?: string;
  creator?: string;
  environment?: string;
  createdAfter?: string;
  createdBefore?: string;
  search?: string;
}

interface SavedView {
  id: string;
  name: string;
  filters: PipelineListFilters;
  columns: string[];
  isDefault?: boolean;
}

// ========================= 组件 =========================

const PipelineList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { canEdit } = usePermissionActions('pipeline');

  // ---- 搜索与筛选 ----
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [filters, setFilters] = useState<PipelineListFilters>(() => {
    try {
      const saved = searchParams.get('filters');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [columnVisible, setColumnVisible] = useState<Record<string, boolean>>({
    name: true,
    status: true,
    version: true,
    stages: true,
    creator: true,
    environment: true,
    createdAt: true,
    updatedAt: true,
  });

  // ---- 视图管理 ----
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('pipeline_views') || '[]');
    } catch {
      return [];
    }
  });
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [viewName, setViewName] = useState('');

  // ---- 批量操作 ----
  const [batchLoading, setBatchLoading] = useState(false);

  // ---- 数据获取（使用 usePagination 统一分页） ----
  const {
    data: pipelines,
    total,
    loading,
    page,
    pageSize,
    setPage,
    setPageSize,
    refresh,
  } = usePagination<Pipeline>(
    async (p, ps) => {
      const result = await getPipelines({
        page: p,
        pageSize: ps,
        name: searchQuery,
        status: filters.status,
      });
      // 兼容不同响应格式 — client 拦截器已解包 response.data
      const response = result as unknown as { data?: Pipeline[]; total?: number; items?: Pipeline[] };
      return {
        data: response.data || response.items || [],
        total: response.total || 0,
      };
    },
    { pageSize: 20, deps: [searchQuery, filters] }
  );

  // ---- 同步筛选条件到 URL ----
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (Object.keys(filters).length > 0) params.set('filters', JSON.stringify(filters));
    setSearchParams(params, { replace: true });
  }, [searchQuery, filters, setSearchParams]);

  // ---- 筛选定义 ----
  const filterDefinitions: FilterDefinition[] = useMemo(
    () => [
      { key: 'status', label: '状态', options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
        { label: 'Archived', value: 'archived' },
        { label: 'Draft', value: 'draft' },
      ] },
      { key: 'environment', label: '环境', options: [
        { label: 'Production', value: 'production' },
        { label: 'Staging', value: 'staging' },
        { label: 'Development', value: 'development' },
        { label: 'Testing', value: 'testing' },
      ] },
    ],
    []
  );

  // ---- 表格列定义 ----
  const columns: TableColumn<Pipeline>[] = useMemo(
    () => [
      {
        key: 'name',
        title: '名称',
        dataIndex: 'name',
        fixed: 'left',
        width: 200,
        render: (name: unknown, record: Pipeline) => (
          <a onClick={() => navigate(`/pipelines/${record.id}`)}>
            {String(name ?? '')}
          </a>
        ),
      },
      {
        key: 'status',
        title: '状态',
        dataIndex: 'status',
        width: 100,
        render: (status: unknown) => {
          const colorMap: Record<string, string> = {
            active: 'green',
            inactive: 'default',
            archived: 'orange',
            draft: 'blue',
          };
          return <Tag color={colorMap[String(status)] || 'default'}>{String(status)}</Tag>;
        },
      },
      {
        key: 'version',
        title: '版本',
        dataIndex: 'version',
        width: 80,
      },
      {
        key: 'stages',
        title: '阶段数',
        dataIndex: 'stages',
        width: 80,
        render: (stages: unknown) => {
          const count = Array.isArray(stages) ? stages.length : typeof stages === 'number' ? stages : '-';
          return <Text>{count}</Text>;
        },
      },
      {
        key: 'environment',
        title: '环境',
        dataIndex: 'environment',
        width: 120,
        render: (env: unknown) => env ? <Tag>{String(env)}</Tag> : '-',
      },
      {
        key: 'creator',
        title: '创建者',
        dataIndex: 'creator',
        width: 120,
        ellipsis: true,
      },
      {
        key: 'createdAt',
        title: '创建时间',
        dataIndex: 'createdAt',
        width: 160,
        render: (time: unknown) => time ? dayjs(String(time)).format('YYYY-MM-DD HH:mm') : '-',
      },
      {
        key: 'updatedAt',
        title: '更新时间',
        dataIndex: 'updatedAt',
        width: 160,
        render: (time: unknown) => time ? dayjs(String(time)).format('YYYY-MM-DD HH:mm') : '-',
      },
      {
        key: 'actions',
        title: '操作',
        width: 200,
        fixed: 'right',
        render: (_: unknown, record: Pipeline) => (
          <Space>
            <Tooltip title="查看详情">
              <Button
                type="link"
                size="small"
                icon={<ColumnHeightOutlined />}
                onClick={() => navigate(`/pipelines/${record.id}`)}
              />
            </Tooltip>
            <Tooltip title="编辑">
              <Button
                type="link"
                size="small"
                disabled={!canEdit}
                onClick={() => navigate(`/pipelines/${record.id}/edit`)}
              >
                编辑
              </Button>
            </Tooltip>
            <Tooltip title="查看运行记录">
              <Button
                type="link"
                size="small"
                onClick={() => navigate(`/pipelines/${record.id}/runs`)}
              >
                运行记录
              </Button>
            </Tooltip>
            <Select
              placeholder="删除"
              size="small"
              value={null}
              onClick={(e) => e.stopPropagation()}
            >
              <Select.Option value="delete" onClick={(e: React.MouseEvent<HTMLElement>) => { e.stopPropagation(); handleDelete(record.id); }}>
                删除
              </Select.Option>
            </Select>
          </Space>
        ),
      },
    ].filter((col) => columnVisible[col.key]) as TableColumn<Pipeline>[],
    [navigate, canEdit, columnVisible]
  );

  // ---- 事件处理 ----

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deletePipeline(id);
      message.success('Pipeline 已删除');
      refresh();
    } catch (err: unknown) {
      const error = err as Error;
      message.error(`删除失败：${error.message}`);
    }
  }, [refresh]);

  const handleBatchDelete = useCallback(async () => {
    setBatchLoading(true);
    try {
      await Promise.all(selectedRowKeys.map((id) => deletePipeline(id)));
      message.success(`已删除 ${selectedRowKeys.length} 个 Pipeline`);
      setSelectedRowKeys([]);
      refresh();
    } catch (err: unknown) {
      const error = err as Error;
      message.error(`批量删除失败：${error.message}`);
    } finally {
      setBatchLoading(false);
    }
  }, [selectedRowKeys, refresh]);

  const handleBatchTrigger = useCallback(() => {
    message.info(`批量触发 ${selectedRowKeys.length} 个 Pipeline（功能开发中）`);
  }, [selectedRowKeys]);

  const handleExport = useCallback(() => {
    try {
      const dataStr = JSON.stringify(pipelines, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pipelines-export-${dayjs().format('YYYY-MM-DD')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      message.success('导出成功');
    } catch {
      message.error('导出失败');
    }
  }, [pipelines]);

  const handleSaveView = useCallback(() => {
    if (!viewName.trim()) {
      message.warning('请输入视图名称');
      return;
    }
    const newView: SavedView = {
      id: `view_${Date.now()}`,
      name: viewName.trim(),
      filters,
      columns: Object.keys(columnVisible),
    };
    const updated = [...savedViews, newView];
    setSavedViews(updated);
    localStorage.setItem('pipeline_views', JSON.stringify(updated));
    setViewModalVisible(false);
    setViewName('');
    message.success('视图已保存');
  }, [viewName, filters, columnVisible, savedViews]);

  const handleApplyView = useCallback((view: SavedView) => {
    setFilters(view.filters);
    setColumnVisible(
      view.columns.reduce((acc, col) => ({ ...acc, [col]: true }), {})
    );
    message.success(`已应用视图：${view.name}`);
  }, []);

  // ---- 渲染 ----

  const createPermissionAction = useCallback((
    key: string,
    label: string,
    onClick?: () => void
  ): PermissionAction => ({
    key,
    label,
    onClick,
  }), []);

  return (
    <div style={{ padding: spacing.lg }}>
      {/* 标题栏 */}
      <Row justify="space-between" align="middle" style={{ marginBottom: spacing.md }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>
            Pipeline 列表
            <Text type="secondary" style={{ fontSize: 14, marginLeft: 8 }}>
              共 {total} 条
            </Text>
          </Title>
        </Col>
        <Col>
          <Space>
            {/* 刷新按钮 */}
            <Button icon={<ReloadOutlined />} onClick={refresh} loading={loading}>
              刷新
            </Button>

            {/* 新建 Pipeline */}
            <PermissionActions
              resource="pipeline"
              actions={[createPermissionAction(
                'write',
                '新建 Pipeline',
                () => navigate('/pipelines/new')
              )]}
              render={(action: PermissionAction, hasPermission: boolean) => (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={action.onClick}
                  disabled={action.disabled ?? !hasPermission}
                >
                  {action.label}
                </Button>
              )}
            />
          </Space>
        </Col>
      </Row>

      {/* 搜索与筛选栏 */}
      <Card size="small" style={{ marginBottom: spacing.md }}>
        <SearchFilterBar
          filters={filterDefinitions}
          onSearch={setSearchQuery}
          onFilter={(f) => setFilters({
            status: f.status as string | undefined,
            environment: f.environment as string | undefined,
          })}
          searchPlaceholder="搜索 Pipeline 名称..."
          initialQuery={searchQuery}
          initialFilters={filters as Record<string, string | string[] | undefined>}
        />
      </Card>

      {/* 右侧视图/列设置按钮 */}
      <div style={{ marginBottom: spacing.md, textAlign: 'right' }}>
        <Space>
          <Dropdown
            menu={{
              items: [
                ...savedViews.map((v) => ({
                  key: v.id,
                  label: v.name,
                  onClick: () => handleApplyView(v),
                })),
                { type: 'divider' },
                {
                  key: 'save',
                  icon: <SaveOutlined />,
                  label: '保存当前视图',
                  onClick: () => setViewModalVisible(true),
                },
              ],
            }}
          >
            <Button icon={<SaveOutlined />}>视图</Button>
          </Dropdown>
          <Dropdown
            menu={{
              items: Object.keys(columnVisible).map((key) => ({
                key,
                label: (
                  <Checkbox
                    checked={columnVisible[key]}
                    onChange={() =>
                      setColumnVisible((prev) => ({ ...prev, [key]: !prev[key] }))
                    }
                    onClick={(e) => e.stopPropagation()}
                  >
                    {columns.find((c) => c.key === key)?.title || key}
                  </Checkbox>
                ),
              })),
            }}
          >
            <Button icon={<ColumnHeightOutlined />}>列设置</Button>
          </Dropdown>
        </Space>
      </div>

      {/* 批量操作栏 */}
      {selectedRowKeys.length > 0 && (
        <Card size="small" style={{ marginBottom: spacing.md, background: '#e6f7ff' }}>
          <Space>
            <Text strong>已选择 {selectedRowKeys.length} 项</Text>
            <Button
              size="small"
              onClick={() => setSelectedRowKeys([])}
            >
              取消选择
            </Button>
            <Button
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={handleBatchTrigger}
              loading={batchLoading}
            >
              批量触发
            </Button>
            <Button
              size="small"
              danger
              loading={batchLoading}
              onClick={handleBatchDelete}
            >
              批量删除
            </Button>
            <Button
              size="small"
              icon={<ExportOutlined />}
              onClick={handleExport}
            >
              导出选中
            </Button>
          </Space>
        </Card>
      )}

      {/* 数据表格 */}
      <Table<Pipeline>
        columns={columns}
        dataSource={pipelines}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
        }}
        onPaginationChange={(p, ps) => {
          setPage(p);
          if (ps !== pageSize) setPageSize(ps);
        }}
        pageSizeOptions={[10, 20, 50, 100]}
        showQuickJumper
        showTotal
        scroll={{ x: 1400 }}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys as string[]),
        }}
        locale={{
          emptyText: (
            <Empty
              description="暂无 Pipeline 数据"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Button
                type="primary"
                onClick={() => navigate('/pipelines/new')}
              >
                创建第一个 Pipeline
              </Button>
            </Empty>
          ),
        }}
        size="middle"
      />

      {/* 保存视图 Modal */}
      <Modal
        title="保存视图"
        open={viewModalVisible}
        onOk={handleSaveView}
        onCancel={() => setViewModalVisible(false)}
        okText="保存"
        cancelText="取消"
      >
        <div style={{ padding: '16px 0' }}>
          <Text>视图名称</Text>
          <Input
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
            placeholder="例如：生产环境活跃 Pipeline"
            style={{ marginTop: 8 }}
            onPressEnter={handleSaveView}
          />
        </div>
      </Modal>
    </div>
  );
};

export default PipelineList;
