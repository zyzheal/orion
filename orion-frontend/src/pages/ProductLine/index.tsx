/**
 * Product Line Management Page
 * List, create, edit product lines; manage ReleaseTrains and HotfixChannels
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Form,
  Input,
  Select,
  message,
  Table as AntTable,
  Descriptions,
} from 'antd';
import {
  FireOutlined,
  PlusOutlined,
  ReloadOutlined,
  BranchesOutlined,
  SearchOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import Table from '@/components/Table';
import SearchFilterBar from '@/components/SearchFilterBar';
import PageSkeleton from '@/components/PageSkeleton';
import {
  getProductLines,
  createProductLine,
  updateProductLine,
  deleteProductLine,
  activateProductLine,
  suspendProductLine,
  getReleaseTrains,
  createReleaseTrain,
  getHotfixChannels,
  createHotfixChannel,
  resolveEnvironment,
  requiresApproval,
  isHotfix,
  type ProductLine,
  type ProductLineCreateInput,
  type ProductLineUpdateInput,
  type ReleaseTrain,
  type HotfixChannel,
  type ReleaseTrainInput,
  type HotfixChannelInput,
  type ProductLinePhase,
} from '@/api/product-lines';
import { ProductLineModals } from './ProductLineModals';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { colors, spacing } from '@/tokens';
import {
  phaseColorMap,
} from './config';
import {
  buildProductLineColumns,
  filterDefinitions,
  releaseTrainColumns,
  hotfixChannelColumns,
} from './columns';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

// ---- Branch Resolver Tool ----

const BranchResolver: React.FC<{ productLines: ProductLine[] }> = ({ productLines }) => {
  const [plId, setPlId] = useState<string>('');
  const [branch, setBranch] = useState('');
  const [result, setResult] = useState<{
    env?: string;
    needsApproval?: boolean;
    isHotfixBranch?: boolean;
  } | null>(null);

  const handleResolve = async () => {
    if (!plId || !branch) {
      message.warning('请选择产品线并输入分支名');
      return;
    }
    try {
      const [envRes, approvalRes, hotfixRes] = await Promise.all([
        resolveEnvironment(plId, branch).catch(() => null),
        requiresApproval(plId, branch).catch(() => null),
        isHotfix(plId, branch).catch(() => null),
      ]);
      setResult({
        env: envRes?.data ? String(envRes.data) : undefined,
        needsApproval: approvalRes?.data?.requiresApproval,
        isHotfixBranch: hotfixRes?.data?.isHotfix,
      });
    } catch (error: unknown) {
      // Try mock: find matching env mapping
      const pl = productLines.find((p) => p.id === plId);
      if (pl) {
        const mappings = pl.environmentMappings.mappings;
        let matchedEnv = pl.environmentMappings.defaultEnvironment;
        let needsApproval = true;
        for (const m of mappings) {
          if (m.patternType === 'exact' && m.branch === branch) {
            matchedEnv = m.environment;
            needsApproval = m.requireApproval ?? true;
            break;
          }
          if (m.patternType === 'glob') {
            const re = new RegExp('^' + m.branch.replace(/\*/g, '.*') + '$');
            if (re.test(branch)) {
              matchedEnv = m.environment;
              needsApproval = m.requireApproval ?? true;
              break;
            }
          }
        }
        const isHot =
          pl.branchPolicies.protectedBranches?.some((p) => p.pattern.startsWith('hotfix')) &&
          branch.startsWith('hotfix/');
        setResult({ env: matchedEnv, needsApproval, isHotfixBranch: isHot });
      }
    }
  };

  return (
    <Card
      size="small"
      title={
        <Space>
          <BranchesOutlined /> 分支环境解析工具
        </Space>
      }
      style={{ marginBottom: spacing.md }}
    >
      <Space wrap>
        <Select
          style={{ width: 200 }}
          placeholder="选择产品线"
          value={plId}
          onChange={setPlId}
          options={productLines.map((pl) => ({ label: pl.displayName, value: pl.id }))}
        />
        <Input
          placeholder="分支名称 (如: feature/xxx)"
          style={{ width: 240 }}
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          onPressEnter={handleResolve}
        />
        <Button type="primary" icon={<SearchOutlined />} onClick={handleResolve}>
          解析
        </Button>
      </Space>
      {result && (
        <Descriptions size="small" style={{ marginTop: spacing[3] }} column={3} bordered>
          <Descriptions.Item label="目标环境">
            {result.env ? (
              <Tag color="blue">{result.env}</Tag>
            ) : (
              <Text type="secondary">未匹配</Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="需要审批">
            {result.needsApproval !== undefined ? (
              result.needsApproval ? (
                <Tag color="orange">是</Tag>
              ) : (
                <Tag color="green">否</Tag>
              )
            ) : (
              <Text type="secondary">-</Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Hotfix 分支">
            {result.isHotfixBranch !== undefined ? (
              result.isHotfixBranch ? (
                <Tag color="red">
                  <FireOutlined /> 是
                </Tag>
              ) : (
                <Tag>否</Tag>
              )
            ) : (
              <Text type="secondary">-</Text>
            )}
          </Descriptions.Item>
        </Descriptions>
      )}
    </Card>
  );
};

// ---- Main Component ----

const ProductLineManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [productLines, setProductLines] = useState<ProductLine[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingPL, setEditingPL] = useState<ProductLine | null>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedPL, setSelectedPL] = useState<ProductLine | null>(null);
  const [releaseTrains, setReleaseTrains] = useState<ReleaseTrain[]>([]);
  const [hotfixChannels, setHotfixChannels] = useState<HotfixChannel[]>([]);
  const [rtModalVisible, setRtModalVisible] = useState(false);
  const [hfModalVisible, setHfModalVisible] = useState(false);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [rtForm] = Form.useForm();
  const [hfForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getProductLines();
      setProductLines(Array.isArray(res.data) ? res.data : []);
    } catch (error: unknown) {
      setProductLines([]);
      message.error(`加载产品线数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredData = useMemo(() => {
    return productLines.filter((pl) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !pl.name.toLowerCase().includes(q) &&
          !pl.displayName.toLowerCase().includes(q) &&
          !(pl.description && pl.description.toLowerCase().includes(q))
        )
          return false;
      }
      if (filters.phase && filters.phase !== 'all' && pl.status.phase !== filters.phase)
        return false;
      if (
        filters.branchMode &&
        filters.branchMode !== 'all' &&
        pl.branchPolicies.mode !== filters.branchMode
      )
        return false;
      return true;
    });
  }, [searchQuery, filters, productLines]);

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      const payload: ProductLineCreateInput = {
        name: values.name,
        displayName: values.displayName,
        description: values.description,
        gitRepo: {
          url: values.gitUrl,
          provider: values.gitProvider || 'github',
          defaultBranch: values.gitDefaultBranch || 'main',
        },
        branchPolicies: {
          mode: values.branchMode || 'gitflow',
          protectedBranches: [],
        },
        environmentMappings: {
          defaultEnvironment: values.defaultEnvironment || 'dev',
          mappings: [
            {
              branch: 'main',
              patternType: 'exact' as const,
              environment: 'prod' as const,
              requireApproval: true,
            },
            {
              branch: 'develop',
              patternType: 'exact' as const,
              environment: 'test' as const,
              requireApproval: false,
            },
            {
              branch: 'feature/*',
              patternType: 'glob' as const,
              environment: 'dev' as const,
              requireApproval: false,
            },
          ],
        },
        tenantId: values.tenantId,
      };
      await createProductLine(payload);
      message.success('产品线创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      loadData();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        if (error instanceof Error) {
          message.error(`创建失败：${error.message}`);
        } else {
          message.error('创建失败');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editingPL) return;
    try {
      const values = await editForm.validateFields();
      setSubmitting(true);
      const payload: ProductLineUpdateInput = {
        displayName: values.displayName,
        description: values.description,
        branchPolicies: {
          mode: values.branchMode || editingPL.branchPolicies.mode,
          protectedBranches: editingPL.branchPolicies.protectedBranches,
        },
        environmentMappings: editingPL.environmentMappings,
      };
      await updateProductLine(editingPL.id, payload);
      message.success('产品线更新成功');
      setEditModalVisible(false);
      loadData();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        if (error instanceof Error) {
          message.error(`更新失败：${error.message}`);
        } else {
          message.error('更新失败');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProductLine(id);
      message.success('产品线已删除');
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
      await activateProductLine(id);
      message.success('产品线已激活');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`激活失败：${error.message}`);
      } else {
        message.error('激活失败');
      }
    }
  };

  const handleSuspend = async (id: string) => {
    try {
      await suspendProductLine(id);
      message.success('产品线已暂停');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`暂停失败：${error.message}`);
      } else {
        message.error('暂停失败');
      }
    }
  };

  const openEdit = (pl: ProductLine) => {
    setEditingPL(pl);
    editForm.setFieldsValue({
      displayName: pl.displayName,
      description: pl.description,
      branchMode: pl.branchPolicies.mode,
    });
    setEditModalVisible(true);
  };

  const openDetail = async (pl: ProductLine) => {
    setSelectedPL(pl);
    setDetailDrawerVisible(true);
    try {
      const [rtRes, hfRes] = await Promise.all([getReleaseTrains(pl.id), getHotfixChannels(pl.id)]);
      setReleaseTrains(rtRes?.data || []);
      setHotfixChannels(hfRes?.data || []);
    } catch (error: unknown) {
      setReleaseTrains([]);
      setHotfixChannels([]);
    }
  };

  const handleCreateRT = async () => {
    if (!selectedPL) return;
    try {
      const values = await rtForm.validateFields();
      setSubmitting(true);
      const payload: ReleaseTrainInput = {
        name: values.rtName,
        schedule: values.rtSchedule,
        targetBranch: values.rtTargetBranch || 'main',
        sourceBranch: values.rtSourceBranch || 'develop',
        autoPromote: values.rtAutoPromote || false,
        approvalRequired:
          values.rtApprovalRequired !== undefined ? values.rtApprovalRequired : true,
        approvers: values.rtApprovers
          ? values.rtApprovers.split(',').map((s: string) => s.trim())
          : [],
      };
      await createReleaseTrain(selectedPL.id, payload);
      message.success('发布列车创建成功');
      setRtModalVisible(false);
      rtForm.resetFields();
      // Reload
      try {
        const res = await getReleaseTrains(selectedPL.id);
        setReleaseTrains(res.data || []);
      } catch {
        /* optional reload, ignore */
      }
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        if (error instanceof Error) {
          message.error(`创建失败：${error.message}`);
        } else {
          message.error('创建失败');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateHF = async () => {
    if (!selectedPL) return;
    try {
      const values = await hfForm.validateFields();
      setSubmitting(true);
      const payload: HotfixChannelInput = {
        name: values.hfName,
        enabled: values.hfEnabled !== undefined ? values.hfEnabled : true,
        branchPattern: values.hfBranchPattern || '^hotfix/.*$',
        approvalRequired:
          values.hfApprovalRequired !== undefined ? values.hfApprovalRequired : true,
        approvalTimeout: values.hfApprovalTimeout || 30,
        autoMerge: values.hfAutoMerge || false,
        notifyOnCall: values.hfNotifyOnCall !== undefined ? values.hfNotifyOnCall : true,
        maxDuration: values.hfMaxDuration || 60,
      };
      await createHotfixChannel(selectedPL.id, payload);
      message.success('紧急修复通道创建成功');
      setHfModalVisible(false);
      hfForm.resetFields();
      try {
        const res = await getHotfixChannels(selectedPL.id);
        setHotfixChannels(res.data || []);
      } catch {
        /* optional reload, ignore */
      }
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        if (error instanceof Error) {
          message.error(`创建失败：${error.message}`);
        } else {
          message.error('创建失败');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Table columns ----

  const columns = useMemo(
    () =>
      buildProductLineColumns({
        openDetail,
        openEdit,
        handleActivate,
        handleSuspend,
        handleDelete,
      }),
    [openDetail, openEdit, handleActivate, handleSuspend, handleDelete],
  );

  const filterDefs = filterDefinitions;

  // ---- Release Train columns ----

  const rtColumns = releaseTrainColumns;

  // ---- Hotfix Channel columns ----

  const hfColumns = hotfixChannelColumns;

  // ---- Detail Drawer content ----

  const detailTabItems = useMemo(
    () => [
      {
        key: 'info',
        label: '基本信息',
        children: selectedPL ? (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="名称">{selectedPL.name}</Descriptions.Item>
            <Descriptions.Item label="显示名称">{selectedPL.displayName}</Descriptions.Item>
            <Descriptions.Item label="描述" span={2}>
              {selectedPL.description || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Git 仓库" span={2}>
              <Text code>{selectedPL.gitRepo?.url}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Provider">{selectedPL.gitRepo?.provider}</Descriptions.Item>
            <Descriptions.Item label="默认分支">
              {selectedPL.gitRepo?.defaultBranch}
            </Descriptions.Item>
            <Descriptions.Item label="分支模式">
              {selectedPL.branchPolicies?.mode}
            </Descriptions.Item>
            <Descriptions.Item label="默认环境">
              {selectedPL.environmentMappings?.defaultEnvironment}
            </Descriptions.Item>
            <Descriptions.Item label="环境映射数">
              {selectedPL.environmentMappings?.mappings?.length || 0}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={phaseColorMap[selectedPL.status?.phase as ProductLinePhase]}>
                {selectedPL.status?.phase}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        ) : null,
      },
      {
        key: 'release-trains',
        label: '发布列车',
        children: (
          <div>
            <div
              style={{ marginBottom: spacing[3], display: 'flex', justifyContent: 'space-between' }}
            >
              <Text type="secondary">管理定时发布列车</Text>
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => setRtModalVisible(true)}
              >
                创建发布列车
              </Button>
            </div>
            <AntTable
              columns={rtColumns}
              dataSource={releaseTrains}
              rowKey="id"
              size="small"
              pagination={false}
            />
          </div>
        ),
      },
      {
        key: 'hotfix-channels',
        label: 'Hotfix 通道',
        children: (
          <div>
            <div
              style={{ marginBottom: spacing[3], display: 'flex', justifyContent: 'space-between' }}
            >
              <Text type="secondary">管理紧急修复通道</Text>
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                danger
                onClick={() => setHfModalVisible(true)}
              >
                创建 Hotfix 通道
              </Button>
            </div>
            <AntTable
              columns={hfColumns}
              dataSource={hotfixChannels}
              rowKey="id"
              size="small"
              pagination={false}
            />
          </div>
        ),
      },
    ],
    [selectedPL, releaseTrains, hotfixChannels]
  );

  const isInitialLoading = loading && productLines.length === 0;

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
              marginBottom: spacing.lg,
            }}
          >
            <div>
              <Title level={2} style={{ marginBottom: spacing.sm }}>
                <AppstoreOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
                多分支产品线
              </Title>
              <Text type="secondary">管理产品线的分支策略、环境映射、发布列车和紧急修复通道</Text>
            </div>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
                刷新
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateModalVisible(true)}
              >
                创建产品线
              </Button>
            </Space>
          </div>

          {/* Branch Resolver Tool */}
          <BranchResolver productLines={productLines} />

          {/* Product Line List */}
          <Card>
            <div style={{ marginBottom: spacing.md }}>
              <SearchFilterBar
                onSearch={setSearchQuery}
                onFilter={setFilters}
                filters={filterDefs}
                searchPlaceholder="搜索产品线..."
              />
            </div>
            <Table
              columns={columns}
              dataSource={filteredData}
              loading={loading}
              rowKey="id"
              size="middle"
              striped
            />
          </Card>

          <ProductLineModals
            createModalVisible={createModalVisible}
            setCreateModalVisible={setCreateModalVisible}
            editModalVisible={editModalVisible}
            setEditModalVisible={setEditModalVisible}
            editingPL={editingPL}
            setEditingPL={setEditingPL}
            detailDrawerVisible={detailDrawerVisible}
            setDetailDrawerVisible={setDetailDrawerVisible}
            selectedPL={selectedPL}
            setSelectedPL={setSelectedPL}
            releaseTrains={releaseTrains}
            setReleaseTrains={setReleaseTrains}
            hotfixChannels={hotfixChannels}
            setHotfixChannels={setHotfixChannels}
            rtModalVisible={rtModalVisible}
            setRtModalVisible={setRtModalVisible}
            hfModalVisible={hfModalVisible}
            setHfModalVisible={setHfModalVisible}
            createForm={createForm}
            editForm={editForm}
            rtForm={rtForm}
            hfForm={hfForm}
            submitting={submitting}
            setSubmitting={setSubmitting}
            handleCreate={handleCreate}
            handleEdit={handleEdit}
            handleCreateRT={handleCreateRT}
            handleCreateHF={handleCreateHF}
            productLines={productLines}
            detailTabItems={detailTabItems}
          />
        </>
      )}
    </div>
  );
};

export default ProductLineManagement;
