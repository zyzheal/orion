/**
 * Developer Portal Page
 *
 * Central hub for API documentation, Mock services, SDK generation,
 * API subscriptions, and online API playground.
 *
 * Features:
 * - 5-tab navigation: API Docs, Mock Service, SDK Generator, Subscriptions, Playground
 * - Full CRUD for each module
 * - Version management and review workflow for documents
 * - Mock rule management with enable/disable toggle
 * - Multi-language SDK generation
 * - Subscription approval workflow with usage tracking
 * - Online API debugging with request history
 */

import React from 'react';
import {
  Card,
  Table,
  Button,
  Tabs,
  Tag,
  Input,
  Typography,
  Space,
  Form,
  Select,
  Row,
  Col,
  Statistic,
  Empty,
  Tooltip,
  Spin,
  Divider,
} from 'antd';
import {
  CodeOutlined,
  PlusOutlined,
  ReloadOutlined,
  StarOutlined,
  ThunderboltOutlined,
  SendOutlined,
  CopyOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  ClockCircleOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { colors, spacing, themeVars } from '@/tokens';

const { Title, Text } = Typography;
const { Search } = Input;
const { TextArea } = Input;

import { DeveloperPortalModals } from './DeveloperPortalModals';
import { TAB_KEYS, httpMethods } from './constants';
import type { TabKey } from './types';
import { useDeveloperPortalState } from './useDeveloperPortalState';

// ==================== Component ====================

const DeveloperPortalPage: React.FC = () => {
  const state = useDeveloperPortalState();
  const {
    activeTab,
    createDocForm,
    createDocModal,
    createMockForm,
    createMockModal,
    createSdkForm,
    createSdkModal,
    createSubForm,
    createSubModal,
    detailDocDrawer,
    docColumns,
    docPagination,
    docSearchText,
    docStats,
    docVersions,
    documents,
    editDocDrawer,
    editDocForm,
    editMockForm,
    editMockModal,
    handleCopyToClipboard,
    handleCreateDoc,
    handleCreateMock,
    handleCreateSdk,
    handleCreateSub,
    handleCreateVersion,
    handleEditDoc,
    handleEditMock,
    handleExecutePlayground,
    handlePublish,
    handleRejectSub,
    handleUnpublish,
    loadDocStats,
    loadDocuments,
    loadMockRules,
    loadMockStats,
    loadPgStats,
    loadPlaygroundRequests,
    loadSdkStats,
    loadSdkTasks,
    loadSubStats,
    loadSubscriptions,
    loading,
    mockColumns,
    mockPagination,
    mockRules,
    mockStats,
    newVersionForm,
    newVersionModal,
    openDocEdit,
    pgColumns,
    pgExecuting,
    pgHistory,
    pgHistoryDrawer,
    pgPagination,
    pgStats,
    playgroundForm,
    playgroundRequests,
    playgroundResult,
    rejectSubForm,
    rejectSubModal,
    sdkColumns,
    sdkDetailDrawer,
    sdkPagination,
    sdkStats,
    sdkTasks,
    selectedDoc,
    selectedMock,
    selectedSdk,
    selectedSub,
    setActiveTab,
    setCreateDocModal,
    setCreateMockModal,
    setCreateSdkModal,
    setCreateSubModal,
    setDetailDocDrawer,
    setDocSearchText,
    setEditDocDrawer,
    setEditMockModal,
    setNewVersionModal,
    setPgHistoryDrawer,
    setRejectSubModal,
    setSdkDetailDrawer,
    setSubDetailDrawer,
    subColumns,
    subDetailDrawer,
    subPagination,
    subStats,
    subscriptions,
    tabItems
  } = state;


  return (
    <div style={{ padding: 0 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing.lg,
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <CodeOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            开发者门户
          </Title>
          <Text type="secondary">API 文档、Mock 服务、SDK 生成、订阅管理与在线调试</Text>
        </div>
        <Space>
          {activeTab === TAB_KEYS.DOCS && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                createDocForm.resetFields();
                setCreateDocModal(true);
              }}
            >
              创建文档
            </Button>
          )}
          {activeTab === TAB_KEYS.MOCK && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                createMockForm.resetFields();
                setCreateMockModal(true);
              }}
            >
              添加规则
            </Button>
          )}
          {activeTab === TAB_KEYS.SDK && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                createSdkForm.resetFields();
                setCreateSdkModal(true);
              }}
            >
              生成 SDK
            </Button>
          )}
          {activeTab === TAB_KEYS.SUBSCRIPTIONS && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                createSubForm.resetFields();
                setCreateSubModal(true);
              }}
            >
              申请订阅
            </Button>
          )}
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              switch (activeTab) {
                case TAB_KEYS.DOCS:
                  loadDocuments();
                  loadDocStats();
                  break;
                case TAB_KEYS.MOCK:
                  loadMockRules();
                  loadMockStats();
                  break;
                case TAB_KEYS.SDK:
                  loadSdkTasks();
                  loadSdkStats();
                  break;
                case TAB_KEYS.SUBSCRIPTIONS:
                  loadSubscriptions();
                  loadSubStats();
                  break;
                case TAB_KEYS.PLAYGROUND:
                  loadPlaygroundRequests();
                  loadPgStats();
                  break;
              }
            }}
            loading={loading}
          >
            刷新
          </Button>
        </Space>
      </div>

      {/* Main Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as TabKey)}
        items={tabItems}
        style={{ marginBottom: spacing.md }}
      />

      {/* ==================== Tab: API Documents ==================== */}
      {activeTab === TAB_KEYS.DOCS && (
        <>
          {/* Stats */}
          <Row gutter={16} style={{ marginBottom: spacing.md }}>
            <Col span={4}>
              <Card size="small">
                <Statistic title="文档总数" value={docStats.total} />
              </Card>
            </Col>
            <Col span={4}>
              <Card size="small">
                <Statistic
                  title="已发布"
                  value={docStats.published}
                  valueStyle={{ color: colors.success[500] }}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card size="small">
                <Statistic
                  title="草稿"
                  value={docStats.draft}
                  valueStyle={{ color: colors.neutral[500] }}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card size="small">
                <Statistic
                  title="审核中"
                  value={docStats.inReview}
                  valueStyle={{ color: colors.warning[500] }}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card size="small">
                <Statistic title="总浏览" value={docStats.totalViews} />
              </Card>
            </Col>
            <Col span={4}>
              <Card size="small">
                <Statistic
                  title="总点赞"
                  value={docStats.totalHelpful}
                  prefix={<StarOutlined style={{ color: colors.warning[500] }} />}
                />
              </Card>
            </Col>
          </Row>

          <Card>
            <div style={{ marginBottom: spacing.md }}>
              <Search
                placeholder="搜索文档..."
                allowClear
                style={{ width: 400 }}
                value={docSearchText}
                onChange={(e) => setDocSearchText(e.target.value)}
                onSearch={(v) => {
                  if (v.trim()) loadDocuments(1, v.trim());
                  else loadDocuments(1);
                }}
              />
            </div>
            <Table
              columns={docColumns}
              dataSource={documents}
              rowKey="id"
              loading={loading}
              pagination={{
                ...docPagination,
                showSizeChanger: true,
                showTotal: (t) => `共 ${t} 条`,
                onChange: (p) => loadDocuments(p),
              }}
              locale={{
                emptyText: (
                  <Empty description={'暂无文档，点击"创建文档"开始添加'}>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        createDocForm.resetFields();
                        setCreateDocModal(true);
                      }}
                    >
                      创建文档
                    </Button>
                  </Empty>
                ),
              }}
            />
          </Card>
        </>
      )}

      {/* ==================== Tab: Mock Service ==================== */}
      {activeTab === TAB_KEYS.MOCK && (
        <>
          <Row gutter={16} style={{ marginBottom: spacing.md }}>
            <Col span={8}>
              <Card size="small">
                <Statistic title="规则总数" value={mockStats.total} />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small">
                <Statistic
                  title="已启用"
                  value={mockStats.enabled}
                  valueStyle={{ color: colors.success[500] }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small">
                <Statistic
                  title="已禁用"
                  value={mockStats.disabled}
                  valueStyle={{ color: colors.neutral[500] }}
                />
              </Card>
            </Col>
          </Row>

          <Card>
            <Table
              columns={mockColumns}
              dataSource={mockRules}
              rowKey="id"
              loading={loading}
              pagination={{
                ...mockPagination,
                showSizeChanger: true,
                showTotal: (t) => `共 ${t} 条`,
                onChange: (p) => loadMockRules(p),
              }}
              locale={{
                emptyText: (
                  <Empty description="暂无 Mock 规则">
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        createMockForm.resetFields();
                        setCreateMockModal(true);
                      }}
                    >
                      添加规则
                    </Button>
                  </Empty>
                ),
              }}
            />
          </Card>
        </>
      )}

      {/* ==================== Tab: SDK Generator ==================== */}
      {activeTab === TAB_KEYS.SDK && (
        <>
          <Row gutter={16} style={{ marginBottom: spacing.md }}>
            <Col span={6}>
              <Card size="small">
                <Statistic title="任务总数" value={sdkStats.total} />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="已完成"
                  value={sdkStats.completed}
                  valueStyle={{ color: colors.success[500] }}
                  prefix={<CheckCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="生成中"
                  value={sdkStats.pending}
                  valueStyle={{ color: colors.primary[500] }}
                  prefix={<SyncOutlined spin />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="失败"
                  value={sdkStats.failed}
                  valueStyle={{ color: colors.error[500] }}
                  prefix={<CloseCircleOutlined />}
                />
              </Card>
            </Col>
          </Row>

          <Card>
            <Table
              columns={sdkColumns}
              dataSource={sdkTasks}
              rowKey="id"
              loading={loading}
              pagination={{
                ...sdkPagination,
                showSizeChanger: true,
                showTotal: (t) => `共 ${t} 条`,
                onChange: (p) => loadSdkTasks(p),
              }}
              locale={{
                emptyText: (
                  <Empty description="暂无 SDK 任务">
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        createSdkForm.resetFields();
                        setCreateSdkModal(true);
                      }}
                    >
                      生成 SDK
                    </Button>
                  </Empty>
                ),
              }}
            />
          </Card>
        </>
      )}

      {/* ==================== Tab: Subscriptions ==================== */}
      {activeTab === TAB_KEYS.SUBSCRIPTIONS && (
        <>
          <Row gutter={16} style={{ marginBottom: spacing.md }}>
            <Col span={5}>
              <Card size="small">
                <Statistic title="订阅总数" value={subStats.totalSubscriptions} />
              </Card>
            </Col>
            <Col span={5}>
              <Card size="small">
                <Statistic
                  title="已通过"
                  value={subStats.approved}
                  valueStyle={{ color: colors.success[500] }}
                />
              </Card>
            </Col>
            <Col span={5}>
              <Card size="small">
                <Statistic
                  title="待审批"
                  value={subStats.pending}
                  valueStyle={{ color: colors.warning[500] }}
                  prefix={<ClockCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={5}>
              <Card size="small">
                <Statistic
                  title="已拒绝"
                  value={subStats.rejected}
                  valueStyle={{ color: colors.error[500] }}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card size="small">
                <Statistic title="已暂停" value={subStats.suspended} />
              </Card>
            </Col>
          </Row>

          <Card>
            <Table
              columns={subColumns}
              dataSource={subscriptions}
              rowKey="id"
              loading={loading}
              pagination={{
                ...subPagination,
                showSizeChanger: true,
                showTotal: (t) => `共 ${t} 条`,
                onChange: (p) => loadSubscriptions(p),
              }}
              locale={{
                emptyText: (
                  <Empty description="暂无订阅">
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        createSubForm.resetFields();
                        setCreateSubModal(true);
                      }}
                    >
                      申请订阅
                    </Button>
                  </Empty>
                ),
              }}
            />
          </Card>
        </>
      )}

      {/* ==================== Tab: Playground ==================== */}
      {activeTab === TAB_KEYS.PLAYGROUND && (
        <>
          <Row gutter={16} style={{ marginBottom: spacing.md }}>
            <Col span={8}>
              <Card size="small">
                <Statistic title="保存的请求" value={pgStats.totalRequests} />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small">
                <Statistic title="总执行次数" value={pgStats.totalExecutions} />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small">
                <Statistic title="平均延迟" value={pgStats.avgLatency} suffix="ms" />
              </Card>
            </Col>
          </Row>

          <Row gutter={16}>
            {/* Request Form */}
            <Col span={12}>
              <Card
                title={
                  <>
                    <SendOutlined style={{ marginRight: spacing.sm }} />
                    请求构建器
                  </>
                }
                style={{ marginBottom: spacing.md }}
              >
                <Form
                  form={playgroundForm}
                  layout="vertical"
                  onFinish={handleExecutePlayground}
                  initialValues={{ method: 'GET', bodyType: 'json' }}
                >
                  <Row gutter={12}>
                    <Col span={6}>
                      <Form.Item name="method" label="方法" rules={[{ required: true }]}>
                        <Select options={httpMethods.map((m) => ({ value: m, label: m }))} />
                      </Form.Item>
                    </Col>
                    <Col span={18}>
                      <Form.Item
                        name="url"
                        label="URL"
                        rules={[{ required: true, message: '请输入 URL' }]}
                      >
                        <Input placeholder="https://api.example.com/v1/resource" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item name="headers" label="Headers (JSON)">
                    <TextArea rows={2} placeholder='{"Authorization": "Bearer xxx"}' />
                  </Form.Item>
                  <Form.Item name="queryParams" label="Query Params (JSON)">
                    <TextArea rows={2} placeholder='{"page": "1", "limit": "10"}' />
                  </Form.Item>
                  <Row gutter={12}>
                    <Col span={6}>
                      <Form.Item name="bodyType" label="Body 类型">
                        <Select
                          options={[
                            { value: 'none', label: 'None' },
                            { value: 'json', label: 'JSON' },
                            { value: 'form', label: 'Form' },
                            { value: 'raw', label: 'Raw' },
                          ]}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={18}>
                      <Form.Item name="body" label="Body">
                        <TextArea rows={4} placeholder='{"key": "value"}' />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      icon={<SendOutlined />}
                      loading={pgExecuting}
                      block
                    >
                      发送请求
                    </Button>
                  </Form.Item>
                </Form>
              </Card>
            </Col>

            {/* Response */}
            <Col span={12}>
              <Card
                title={
                  <>
                    <ThunderboltOutlined style={{ marginRight: spacing.sm }} />
                    响应结果
                  </>
                }
                style={{ marginBottom: spacing.md }}
                extra={
                  playgroundResult && (
                    <Space>
                      <Tag
                        color={
                          playgroundResult.response.statusCode < 300
                            ? 'green'
                            : playgroundResult.response.statusCode < 400
                              ? 'blue'
                              : 'red'
                        }
                      >
                        {playgroundResult.response.statusCode}{' '}
                        {playgroundResult.response.statusText}
                      </Tag>
                      <Tag>{playgroundResult.response.latencyMs}ms</Tag>
                      <Tooltip title="复制响应">
                        <Button
                          type="link"
                          size="small"
                          icon={<CopyOutlined />}
                          onClick={() => handleCopyToClipboard(playgroundResult.response.body)}
                        />
                      </Tooltip>
                    </Space>
                  )
                }
              >
                {pgExecuting ? (
                  <div style={{ textAlign: 'center', padding: 40 }}>
                    <Spin tip="请求中..." />
                  </div>
                ) : playgroundResult ? (
                  <div>
                    <Divider style={{ margin: '8px 0' }}>响应 Headers</Divider>
                    <div style={{ marginBottom: spacing.sm }}>
                      {Object.entries(playgroundResult.response.headers).map(([k, v]) => (
                        <Tag key={String(k)} style={{ marginBottom: 4 }}>
                          <Text code style={{ fontSize: 11 }}>
                            {k}: {v}
                          </Text>
                        </Tag>
                      ))}
                    </div>
                    <Divider style={{ margin: '8px 0' }}>响应 Body</Divider>
                    <pre
                      style={{
                        background: themeVars.bgTertiary,
                        padding: spacing[3],
                        borderRadius: 8,
                        maxHeight: 300,
                        overflow: 'auto',
                        fontSize: 12,
                      }}
                    >
                      {playgroundResult.response.body}
                    </pre>
                  </div>
                ) : (
                  <Empty description={'填写请求参数并点击"发送请求"'} />
                )}
              </Card>
            </Col>
          </Row>

          {/* Saved Requests */}
          <Card
            title={
              <>
                <HistoryOutlined style={{ marginRight: spacing.sm }} />
                保存的请求
              </>
            }
          >
            <Table
              columns={pgColumns}
              dataSource={playgroundRequests}
              rowKey="id"
              loading={loading}
              size="small"
              pagination={{
                ...pgPagination,
                showSizeChanger: true,
                showTotal: (t) => `共 ${t} 条`,
                onChange: (p) => loadPlaygroundRequests(p),
              }}
              locale={{ emptyText: <Empty description="暂无保存的请求" /> }}
            />
          </Card>
        </>
      )}

      {/* ==================== Modals & Drawers ==================== */}


      <DeveloperPortalModals
        loading={loading}
        // Document
        createDocModal={createDocModal}
        createDocForm={createDocForm}
        onCreateDoc={async () => {
          try {
            const values = await createDocForm.validateFields();
            handleCreateDoc(values);
          } catch {
            /* validation failed */
          }
        }}
        onCreateDocCancel={() => setCreateDocModal(false)}
        editDocDrawer={editDocDrawer}
        editDocForm={editDocForm}
        selectedDoc={selectedDoc}
        onEditDoc={async () => {
          try {
            const values = await editDocForm.validateFields();
            handleEditDoc(values);
          } catch {
            /* validation failed */
          }
        }}
        onEditDocCancel={() => setEditDocDrawer(false)}
        onPublish={handlePublish}
        onUnpublish={handleUnpublish}
        detailDocDrawer={detailDocDrawer}
        docVersions={docVersions}
        onDetailDocCancel={() => setDetailDocDrawer(false)}
        onOpenDocEdit={() => {
          setDetailDocDrawer(false);
          openDocEdit(selectedDoc!);
        }}
        onOpenNewVersion={() => {
          newVersionForm.resetFields();
          setNewVersionModal(true);
        }}
        newVersionModal={newVersionModal}
        newVersionForm={newVersionForm}
        onNewVersion={async () => {
          try {
            const values = await newVersionForm.validateFields();
            handleCreateVersion(values);
          } catch {
            /* validation failed */
          }
        }}
        onNewVersionCancel={() => setNewVersionModal(false)}
        // Mock
        createMockModal={createMockModal}
        createMockForm={createMockForm}
        onCreateMock={async () => {
          try {
            const values = await createMockForm.validateFields();
            handleCreateMock(values);
          } catch {
            /* validation failed */
          }
        }}
        onCreateMockCancel={() => setCreateMockModal(false)}
        editMockModal={editMockModal}
        editMockForm={editMockForm}
        selectedMock={selectedMock}
        onEditMock={async () => {
          try {
            const values = await editMockForm.validateFields();
            handleEditMock(values);
          } catch {
            /* validation failed */
          }
        }}
        onEditMockCancel={() => setEditMockModal(false)}
        // SDK
        createSdkModal={createSdkModal}
        createSdkForm={createSdkForm}
        onCreateSdk={async () => {
          try {
            const values = await createSdkForm.validateFields();
            handleCreateSdk(values);
          } catch {
            /* validation failed */
          }
        }}
        onCreateSdkCancel={() => setCreateSdkModal(false)}
        sdkDetailDrawer={sdkDetailDrawer}
        selectedSdk={selectedSdk}
        onSdkDetailCancel={() => setSdkDetailDrawer(false)}
        onCopyCode={handleCopyToClipboard}
        // Subscription
        createSubModal={createSubModal}
        createSubForm={createSubForm}
        onCreateSub={async () => {
          try {
            const values = await createSubForm.validateFields();
            handleCreateSub(values);
          } catch {
            /* validation failed */
          }
        }}
        onCreateSubCancel={() => setCreateSubModal(false)}
        subDetailDrawer={subDetailDrawer}
        selectedSub={selectedSub}
        onSubDetailCancel={() => setSubDetailDrawer(false)}
        rejectSubModal={rejectSubModal}
        rejectSubForm={rejectSubForm}
        onRejectSub={async () => {
          try {
            const values = await rejectSubForm.validateFields();
            handleRejectSub(values);
          } catch {
            /* validation failed */
          }
        }}
        onRejectSubCancel={() => setRejectSubModal(false)}
        // Playground
        pgHistoryDrawer={pgHistoryDrawer}
        pgHistory={pgHistory}
        onPgHistoryCancel={() => setPgHistoryDrawer(false)}
      />

    </div>
  );
};

export default DeveloperPortalPage;
