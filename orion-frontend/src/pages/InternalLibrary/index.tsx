/**
 * Internal Library Management Page
 * M30 - 二方库管理：列表、创建、版本管理、依赖追踪
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Typography,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  message,
  Tabs,
  Descriptions,
  Drawer,
  Tag,
  DatePicker,
  Card,
} from 'antd';
import { PlusOutlined, ReloadOutlined, TeamOutlined, BookOutlined } from '@ant-design/icons';
import PageSkeleton from '@/components/PageSkeleton';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import {
  getInternalLibraries,
  createInternalLibrary,
  deleteInternalLibrary,
  activateInternalLibrary,
  deprecateInternalLibrary,
  publishVersion,
  getVersions,
  deprecateVersion,
  getDependents,
  addDependent,
  updateDependent,
  updateDependentStats,
  type InternalLibrary,
  type LibraryVersion,
  type LibraryDependent,
  type CreateLibraryInput,
  type PublishVersionInput,
  type DeprecateLibraryInput,
  type AddDependentInput,
  type LibraryLanguage,
} from '@/api/internal-library';
import LibraryTable from './LibraryTable';
import CreateLibraryModal from './CreateLibraryModal';
import { getLibraryTabItems } from './LibraryDetail';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

// ---- Constants ----

const languageOptions = Object.entries({
  java: 'Java',
  node: 'Node.js',
  python: 'Python',
  go: 'Go',
  rust: 'Rust',
  dotnet: '.NET',
} as Record<LibraryLanguage, string>).map(([value, label]) => ({ label, value }));

const statusOptions = [
  { label: '全部', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Development', value: 'development' },
  { label: 'Deprecated', value: 'deprecated' },
  { label: 'Archived', value: 'archived' },
];

// ---- Main Component ----

const InternalLibraryManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [libraries, setLibraries] = useState<InternalLibrary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedLib, setSelectedLib] = useState<InternalLibrary | null>(null);
  const [versions, setVersions] = useState<LibraryVersion[]>([]);
  const [dependents, setDependents] = useState<LibraryDependent[]>([]);
  const [versionModalVisible, setVersionModalVisible] = useState(false);
  const [deprecateModalVisible, setDeprecateModalVisible] = useState(false);
  const [deprecateVersionModalVisible, setDeprecateVersionModalVisible] = useState(false);
  const [addDependentModalVisible, setAddDependentModalVisible] = useState(false);
  const [createForm] = Form.useForm();
  const [versionForm] = Form.useForm();
  const [deprecateForm] = Form.useForm();
  const [deprecateVersionForm] = Form.useForm();
  const [addDependentForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('info');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getInternalLibraries();
      setLibraries(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (error: unknown) {
      setLibraries([]);
      message.error(`加载二方库数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredData = useMemo(() => {
    return libraries.filter((lib) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !lib.name.toLowerCase().includes(q) &&
          !(lib.displayName && lib.displayName.toLowerCase().includes(q)) &&
          !(lib.description && lib.description.toLowerCase().includes(q))
        )
          return false;
      }
      if (filters.language && filters.language !== 'all' && lib.language !== filters.language)
        return false;
      if (filters.status && filters.status !== 'all' && lib.status !== filters.status) return false;
      if (filters.owner && filters.owner !== 'all' && lib.owner !== filters.owner) return false;
      return true;
    });
  }, [searchQuery, filters, libraries]);

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      const payload: CreateLibraryInput = {
        name: values.name,
        displayName: values.displayName,
        description: values.description,
        language: values.language,
        owner: values.owner,
        maintainers: values.maintainers
          ? values.maintainers.split(',').map((s: string) => s.trim())
          : [],
        repository: values.repository,
        documentation: values.documentation,
        sla: values.sla,
        publishConfig: values.requireApproval
          ? {
              requireApproval: true,
              approvers: values.approvers
                ? values.approvers.split(',').map((s: string) => s.trim())
                : [],
            }
          : undefined,
      };
      await createInternalLibrary(payload);
      message.success('二方库创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      loadData();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        if (error instanceof Error) {
          message.error(`二方库创建失败：${error.message}`);
        } else {
          message.error('二方库创建失败');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteInternalLibrary(id);
      message.success('二方库已删除');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`删除失败：${error.message}`);
      } else {
        message.error('删除失败');
      }
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await activateInternalLibrary(id);
      message.success('二方库已激活');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`激活失败：${error.message}`);
      } else {
        message.error('激活失败');
      }
    }
  };

  const handleDeprecate = async () => {
    if (!selectedLib) return;
    try {
      const values = await deprecateForm.validateFields();
      setSubmitting(true);
      const payload: DeprecateLibraryInput = {
        reason: values.reason,
        eolDate: values.eolDate.format('YYYY-MM-DD'),
        migrationGuide: values.migrationGuide,
        replacementLibrary: values.replacementLibrary,
      };
      await deprecateInternalLibrary(selectedLib.id, payload);
      message.success('二方库已废弃');
      setDeprecateModalVisible(false);
      deprecateForm.resetFields();
      loadData();
      if (detailDrawerVisible) openDetail(selectedLib);
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        if (error instanceof Error) {
          message.error(`废弃失败：${error.message}`);
        } else {
          message.error('废弃失败');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublishVersion = async () => {
    if (!selectedLib) return;
    try {
      const values = await versionForm.validateFields();
      setSubmitting(true);
      const payload: PublishVersionInput = {
        version: values.version,
        status: values.status || 'stable',
        changelog: values.changelog,
        artifactId: values.artifactId,
        securityScore: values.securityScore ? Number(values.securityScore) : undefined,
        testCoverage: values.testCoverage ? Number(values.testCoverage) : undefined,
        publishedTo: values.publishedTo
          ? values.publishedTo.split(',').map((s: string) => s.trim())
          : undefined,
      };
      await publishVersion(selectedLib.id, payload);
      message.success(`版本 ${values.version} 发布成功`);
      setVersionModalVisible(false);
      versionForm.resetFields();
      if (detailDrawerVisible) openDetail(selectedLib);
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        if (error instanceof Error) {
          message.error(`发布失败：${error.message}`);
        } else {
          message.error('发布失败');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeprecateVersion = async () => {
    if (!selectedLib) return;
    try {
      const values = await deprecateVersionForm.validateFields();
      setSubmitting(true);
      const targetVersion = versionForm.getFieldValue('_targetVersion') || values.targetVersion;
      await deprecateVersion(
        selectedLib.id,
        targetVersion,
        values.reason,
        values.eolDate.format('YYYY-MM-DD'),
        values.migrationGuide
      );
      message.success('版本已废弃');
      setDeprecateVersionModalVisible(false);
      deprecateVersionForm.resetFields();
      if (detailDrawerVisible) openDetail(selectedLib);
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        if (error instanceof Error) {
          message.error(`废弃失败：${error.message}`);
        } else {
          message.error('废弃失败');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddDependent = async () => {
    if (!selectedLib) return;
    try {
      const values = await addDependentForm.validateFields();
      setSubmitting(true);
      const payload: AddDependentInput = {
        repoName: values.repoName,
        teamName: values.teamName,
        version: values.version,
      };
      await addDependent(selectedLib.id, payload);
      message.success('依赖关系已添加');
      setAddDependentModalVisible(false);
      addDependentForm.resetFields();
      if (detailDrawerVisible) openDetail(selectedLib);
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        if (error instanceof Error) {
          message.error(`添加失败：${error.message}`);
        } else {
          message.error('添加失败');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateDependent = async (repoName: string, version: string) => {
    if (!selectedLib) return;
    try {
      await updateDependent(selectedLib.id, repoName, version);
      message.success('依赖版本已更新');
      if (detailDrawerVisible) openDetail(selectedLib);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`更新失败：${error.message}`);
      } else {
        message.error('更新失败');
      }
    }
  };

  const handleUpdateStats = async () => {
    if (!selectedLib) return;
    try {
      await updateDependentStats(selectedLib.id);
      message.success('依赖统计已更新');
      if (detailDrawerVisible) openDetail(selectedLib);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`更新依赖统计失败：${error.message}`);
      } else {
        message.error('更新依赖统计失败');
      }
    }
  };

  const openDetail = async (lib: InternalLibrary) => {
    setSelectedLib(lib);
    setDetailDrawerVisible(true);
    setActiveTab('info');
    try {
      const [verRes, depRes] = await Promise.all([getVersions(lib.id), getDependents(lib.id)]);
      setVersions(verRes?.data?.data || []);
      setDependents(depRes?.data?.data || []);
    } catch (error: unknown) {
      setVersions([]);
      setDependents([]);
    }
  };

  const filterDefs: FilterDefinition[] = [
    {
      key: 'language',
      label: '语言',
      options: [{ label: '全部', value: 'all' }, ...languageOptions],
    },
    { key: 'status', label: '状态', options: statusOptions },
  ];

  // ---- Detail Tabs ----

  const {
    items: detailTabItems,
    activeKey: detailActiveKey,
    onChange: detailTabChange,
  } = getLibraryTabItems(
    selectedLib,
    versions,
    dependents,
    activeTab,
    setActiveTab,
    () => {
      versionForm.resetFields();
      setVersionModalVisible(true);
    },
    (targetVersion: string) => {
      versionForm.setFieldValue('_targetVersion', targetVersion);
      setDeprecateVersionModalVisible(true);
    },
    handleUpdateStats,
    () => {
      addDependentForm.resetFields();
      setAddDependentModalVisible(true);
    },
    handleUpdateDependent
  );

  const isInitialLoading = loading && libraries.length === 0;

  return (
    <div style={{ padding: 0 }}>
      {/* Page loading skeleton (initial load) */}
      {isInitialLoading && <PageSkeleton rows={8} />}

      {isInitialLoading ? null : (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 24,
            }}
          >
            <div>
              <Title level={2} style={{ marginBottom: 8 }}>
                <BookOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
                二方库管理
              </Title>
              <Text type="secondary">管理内部二方库的生命周期、版本发布和依赖追踪</Text>
            </div>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
                刷新
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  createForm.resetFields();
                  setCreateModalVisible(true);
                }}
              >
                创建二方库
              </Button>
            </Space>
          </div>

          {/* Library List */}
          <Card>
            <div style={{ marginBottom: 16 }}>
              <SearchFilterBar
                onSearch={setSearchQuery}
                onFilter={setFilters}
                filters={filterDefs}
                searchPlaceholder="搜索二方库..."
              />
            </div>
            <LibraryTable
              dataSource={filteredData}
              loading={loading}
              onDetail={openDetail}
              onActivate={handleActivate}
              onDeprecate={(record) => {
                setSelectedLib(record);
                setDeprecateModalVisible(true);
              }}
              onDelete={handleDelete}
            />
          </Card>

          {/* Create Modal (extracted sub-component) */}
          <CreateLibraryModal
            visible={createModalVisible}
            form={createForm}
            submitting={submitting}
            onCancel={() => setCreateModalVisible(false)}
            onOk={handleCreate}
          />

          {/* Deprecate Library Modal */}
          <Modal
            title="废弃二方库"
            open={deprecateModalVisible}
            onCancel={() => setDeprecateModalVisible(false)}
            onOk={handleDeprecate}
            confirmLoading={submitting}
            width={520}
          >
            <Form form={deprecateForm} layout="vertical">
              <Form.Item
                name="reason"
                label="废弃原因"
                rules={[{ required: true, message: '请输入废弃原因' }]}
              >
                <Input.TextArea rows={3} placeholder="为什么废弃此二方库..." />
              </Form.Item>
              <Form.Item
                name="eolDate"
                label="EOL 日期"
                rules={[{ required: true, message: '请选择 EOL 日期' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="migrationGuide" label="迁移指南">
                <Input placeholder="https://docs.example.com/migrate" />
              </Form.Item>
              <Form.Item name="replacementLibrary" label="替代二方库">
                <Input placeholder="如: @orion/auth-v2" />
              </Form.Item>
            </Form>
          </Modal>

          {/* Publish Version Modal */}
          <Modal
            title="发布新版本"
            open={versionModalVisible}
            onCancel={() => setVersionModalVisible(false)}
            onOk={handlePublishVersion}
            confirmLoading={submitting}
            width={520}
          >
            <Form form={versionForm} layout="vertical">
              <Form.Item
                name="version"
                label="版本号"
                rules={[{ required: true, message: '请输入版本号' }]}
              >
                <Input placeholder="如: 2.4.0" />
              </Form.Item>
              <Form.Item name="status" label="版本状态">
                <Select
                  options={[
                    { label: 'Snapshot', value: 'snapshot' },
                    { label: 'Alpha', value: 'alpha' },
                    { label: 'Beta', value: 'beta' },
                    { label: 'RC', value: 'rc' },
                    { label: 'Stable', value: 'stable' },
                  ]}
                  defaultValue="stable"
                />
              </Form.Item>
              <Form.Item name="changelog" label="变更说明">
                <Input.TextArea rows={3} placeholder="版本变更说明..." />
              </Form.Item>
              <Form.Item name="artifactId" label="制品 ID">
                <Input placeholder="关联的制品 ID" />
              </Form.Item>
              <Form.Item name="securityScore" label="安全评分">
                <Input type="number" min={0} max={100} placeholder="0-100" />
              </Form.Item>
              <Form.Item name="testCoverage" label="测试覆盖率">
                <Input type="number" min={0} max={100} placeholder="0-100" />
              </Form.Item>
              <Form.Item name="publishedTo" label="发布仓库 (逗号分隔)">
                <Input placeholder="如: npm, maven-central" />
              </Form.Item>
            </Form>
          </Modal>

          {/* Deprecate Version Modal */}
          <Modal
            title="废弃版本"
            open={deprecateVersionModalVisible}
            onCancel={() => setDeprecateVersionModalVisible(false)}
            onOk={handleDeprecateVersion}
            confirmLoading={submitting}
            width={520}
          >
            <Form form={deprecateVersionForm} layout="vertical">
              <Form.Item
                name="targetVersion"
                label="目标版本"
                rules={[{ required: true, message: '请输入版本号' }]}
              >
                <Input placeholder="版本号" />
              </Form.Item>
              <Form.Item
                name="reason"
                label="废弃原因"
                rules={[{ required: true, message: '请输入废弃原因' }]}
              >
                <Input.TextArea rows={3} placeholder="为什么废弃此版本..." />
              </Form.Item>
              <Form.Item
                name="eolDate"
                label="EOL 日期"
                rules={[{ required: true, message: '请选择 EOL 日期' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="migrationGuide" label="迁移指南">
                <Input placeholder="https://docs.example.com/migrate" />
              </Form.Item>
            </Form>
          </Modal>

          {/* Add Dependent Modal */}
          <Modal
            title="添加依赖关系"
            open={addDependentModalVisible}
            onCancel={() => setAddDependentModalVisible(false)}
            onOk={handleAddDependent}
            confirmLoading={submitting}
            width={520}
          >
            <Form form={addDependentForm} layout="vertical">
              <Form.Item
                name="repoName"
                label="项目名称"
                rules={[{ required: true, message: '请输入项目名称' }]}
              >
                <Input placeholder="如: orion-platform-service" />
              </Form.Item>
              <Form.Item
                name="teamName"
                label="团队名称"
                rules={[{ required: true, message: '请输入团队名称' }]}
              >
                <Input placeholder="如: platform-team" />
              </Form.Item>
              <Form.Item
                name="version"
                label="使用版本"
                rules={[{ required: true, message: '请输入版本号' }]}
              >
                <Input placeholder="如: 2.3.0" />
              </Form.Item>
            </Form>
          </Modal>

          {/* Detail Drawer */}
          <Drawer
            title={selectedLib ? `${selectedLib.displayName || selectedLib.name}` : '详情'}
            open={detailDrawerVisible}
            onClose={() => setDetailDrawerVisible(false)}
            width={900}
            destroyOnClose
          >
            {selectedLib && (
              <Descriptions size="small" style={{ marginBottom: 16 }} column={3} bordered>
                <Descriptions.Item label="名称">
                  <Text code>{selectedLib.name}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="语言">
                  <Tag color="cyan">
                    {(
                      {
                        java: 'Java',
                        node: 'Node.js',
                        python: 'Python',
                        go: 'Go',
                        rust: 'Rust',
                        dotnet: '.NET',
                      } as Record<string, string>
                    )[selectedLib.language] || selectedLib.language}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag
                    color={
                      {
                        active: 'green',
                        deprecated: 'orange',
                        archived: 'default',
                        development: 'blue',
                      }[selectedLib.status] || 'default'
                    }
                  >
                    {selectedLib.status}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="当前版本">
                  <Text code>{selectedLib.currentVersion}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="团队">
                  <TeamOutlined /> {selectedLib.owner}
                </Descriptions.Item>
                <Descriptions.Item label="依赖项目">
                  {selectedLib.dependents?.totalRepos ?? 0}
                </Descriptions.Item>
              </Descriptions>
            )}
            <Tabs activeKey={detailActiveKey} onChange={detailTabChange} items={detailTabItems} />
          </Drawer>
        </>
      )}
    </div>
  );
};

export default InternalLibraryManagement;
