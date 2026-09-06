/**
 * Developer Portal — centralized state + data loading + CRUD handlers.
 *
 * Extracted from DeveloperPortalPage.tsx so the page file only owns the JSX
 * render. The hook returns every piece of state, form instance, loader and
 * handler the page needs to render its five tabs and the global modal cluster.
 */
import { useState, useEffect, useCallback } from 'react';
import { Form, message } from 'antd';
import {
  FileTextOutlined,
  ExperimentOutlined,
  CodeOutlined,
  KeyOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import {
  developerPortalApi,
  type PortalDocument,
  type PortalDocumentCreateRequest,
  type PortalDocumentUpdateRequest,
  type MockRule,
  type MockRuleCreateRequest,
  type SDKGenerationTask,
  type SDKGenerateRequest,
  type SDKLanguage,
  type APISubscription,
  type SubscriptionCreateRequest,
  type PlaygroundRequest,
  type PlaygroundExecuteRequest,
} from '@/api/developer-portal';
import { TAB_KEYS } from './constants';
import type { TabKey } from './types';
import {
  useDocColumns,
  useMockColumns,
  useSdkColumns,
  useSubColumns,
  usePgColumns,
} from './columns';

/** Payload returned by the playground execute API (response envelope). */
export interface PlaygroundExecuteResult {
  request: unknown;
  response: {
    statusCode: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
    latencyMs: number;
  };
}

/** One entry of the per-request response history drawer. */
export interface PgHistoryEntry {
  id: string;
  statusCode: number;
  latencyMs: number;
  timestamp: string;
}

export function useDeveloperPortalState() {
  const [activeTab, setActiveTab] = useState<TabKey>(TAB_KEYS.DOCS);

  // ---- Shared state ----
  const [loading, setLoading] = useState(false);

  // ---- Document state ----
  const [documents, setDocuments] = useState<PortalDocument[]>([]);
  const [docStats, setDocStats] = useState({
    total: 0,
    published: 0,
    draft: 0,
    inReview: 0,
    totalViews: 0,
    totalHelpful: 0,
  });
  const [docPagination, setDocPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [docSearchText, setDocSearchText] = useState('');
  const [createDocModal, setCreateDocModal] = useState(false);
  const [editDocDrawer, setEditDocDrawer] = useState(false);
  const [detailDocDrawer, setDetailDocDrawer] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<PortalDocument | null>(null);
  const [docVersions, setDocVersions] = useState<PortalDocument[]>([]);
  const [newVersionModal, setNewVersionModal] = useState(false);
  const [createDocForm] = Form.useForm();
  const [editDocForm] = Form.useForm();
  const [newVersionForm] = Form.useForm();

  // ---- Mock state ----
  const [mockRules, setMockRules] = useState<MockRule[]>([]);
  const [mockStats, setMockStats] = useState({ total: 0, enabled: 0, disabled: 0 });
  const [mockPagination, setMockPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [createMockModal, setCreateMockModal] = useState(false);
  const [editMockModal, setEditMockModal] = useState(false);
  const [selectedMock, setSelectedMock] = useState<MockRule | null>(null);
  const [createMockForm] = Form.useForm();
  const [editMockForm] = Form.useForm();

  // ---- SDK state ----
  const [sdkTasks, setSdkTasks] = useState<SDKGenerationTask[]>([]);
  const [sdkStats, setSdkStats] = useState({ total: 0, completed: 0, failed: 0, pending: 0 });
  const [sdkPagination, setSdkPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [createSdkModal, setCreateSdkModal] = useState(false);
  const [sdkDetailDrawer, setSdkDetailDrawer] = useState(false);
  const [selectedSdk, setSelectedSdk] = useState<SDKGenerationTask | null>(null);
  const [createSdkForm] = Form.useForm();

  // ---- Subscription state ----
  const [subscriptions, setSubscriptions] = useState<APISubscription[]>([]);
  const [subStats, setSubStats] = useState({
    totalSubscriptions: 0,
    approved: 0,
    pending: 0,
    rejected: 0,
    suspended: 0,
  });
  const [subPagination, setSubPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [createSubModal, setCreateSubModal] = useState(false);
  const [subDetailDrawer, setSubDetailDrawer] = useState(false);
  const [selectedSub, setSelectedSub] = useState<APISubscription | null>(null);
  const [createSubForm] = Form.useForm();
  const [rejectSubModal, setRejectSubModal] = useState(false);
  const [rejectSubForm] = Form.useForm();

  // ---- Playground state ----
  const [playgroundRequests, setPlaygroundRequests] = useState<PlaygroundRequest[]>([]);
  const [playgroundResult, setPlaygroundResult] = useState<{
    request: PlaygroundRequest;
    response: {
      statusCode: number;
      statusText: string;
      headers: Record<string, string>;
      body: string;
      latencyMs: number;
    };
  } | null>(null);
  const [pgPagination, setPgPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [pgExecuting, setPgExecuting] = useState(false);
  const [pgHistoryDrawer, setPgHistoryDrawer] = useState(false);
  const [pgHistory, setPgHistory] = useState<
    Array<{ id: string; statusCode: number; latencyMs: number; timestamp: string }>
  >([]);
  const [playgroundForm] = Form.useForm();
  const [pgStats, setPgStats] = useState({ totalRequests: 0, totalExecutions: 0, avgLatency: 0 });

  // ==================== Data Loading ====================

  const loadDocuments = useCallback(
    async (page = 1, search?: string) => {
      setLoading(true);
      try {
        if (search) {
          const resp = await developerPortalApi.searchDocuments(search);
          setDocuments(resp.data || []);
          setDocPagination((p) => ({ ...p, current: 1, total: resp.total || 0 }));
        } else {
          const resp = await developerPortalApi.listDocuments({
            page,
            perPage: docPagination.pageSize,
          });
          setDocuments(resp.data || []);
          setDocPagination((p) => ({ ...p, current: page, total: resp.total || 0 }));
        }
      } catch (err: unknown) {
        message.error(`加载文档失败: ${(err as Error).message}`);
      } finally {
        setLoading(false);
      }
    },
    [docPagination.pageSize]
  );

  const loadDocStats = useCallback(async () => {
    try {
      const resp = await developerPortalApi.getDocumentStats();
      if (resp.data) setDocStats(resp.data);
    } catch {
      /* non-critical */
    }
  }, []);

  const loadMockRules = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const resp = await developerPortalApi.listMockRules({
          page,
          pageSize: mockPagination.pageSize,
        });
        setMockRules(resp.data || []);
        setMockPagination((p) => ({ ...p, current: page, total: resp.total || 0 }));
      } catch (err: unknown) {
        message.error(`加载Mock规则失败: ${(err as Error).message}`);
      } finally {
        setLoading(false);
      }
    },
    [mockPagination.pageSize]
  );

  const loadMockStats = useCallback(async () => {
    try {
      const resp = await developerPortalApi.getMockStats();
      if (resp.data) setMockStats(resp.data);
    } catch {
      /* non-critical */
    }
  }, []);

  const loadSdkTasks = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const resp = await developerPortalApi.listSDKTasks({
          page,
          pageSize: sdkPagination.pageSize,
        });
        setSdkTasks(resp.data || []);
        setSdkPagination((p) => ({ ...p, current: page, total: resp.total || 0 }));
      } catch (err: unknown) {
        message.error(`加载SDK任务失败: ${(err as Error).message}`);
      } finally {
        setLoading(false);
      }
    },
    [sdkPagination.pageSize]
  );

  const loadSdkStats = useCallback(async () => {
    try {
      const resp = await developerPortalApi.getSDKStats();
      if (resp.data) setSdkStats(resp.data);
    } catch {
      /* non-critical */
    }
  }, []);

  const loadSubscriptions = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const resp = await developerPortalApi.listSubscriptions({
          page,
          pageSize: subPagination.pageSize,
        });
        setSubscriptions(resp.data || []);
        setSubPagination((p) => ({ ...p, current: page, total: resp.total || 0 }));
      } catch (err: unknown) {
        message.error(`加载订阅失败: ${(err as Error).message}`);
      } finally {
        setLoading(false);
      }
    },
    [subPagination.pageSize]
  );

  const loadSubStats = useCallback(async () => {
    try {
      const resp = await developerPortalApi.getSubscriptionStats();
      if (resp.data) setSubStats(resp.data);
    } catch {
      /* non-critical */
    }
  }, []);

  const loadPlaygroundRequests = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const resp = await developerPortalApi.listPlaygroundRequests({
          page,
          pageSize: pgPagination.pageSize,
        });
        setPlaygroundRequests(resp.data || []);
        setPgPagination((p) => ({ ...p, current: page, total: resp.total || 0 }));
      } catch (err: unknown) {
        message.error(`加载请求历史失败: ${(err as Error).message}`);
      } finally {
        setLoading(false);
      }
    },
    [pgPagination.pageSize]
  );

  const loadPgStats = useCallback(async () => {
    try {
      const resp = await developerPortalApi.getPlaygroundStats();
      if (resp.data) setPgStats(resp.data);
    } catch {
      /* non-critical */
    }
  }, []);

  // Load data on tab change
  useEffect(() => {
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
  }, [activeTab]);

  // ==================== Document Handlers ====================

  const handleCreateDoc = async (values: any) => {
    setLoading(true);
    try {
      const payload: PortalDocumentCreateRequest = {
        title: values.title as string,
        slug: values.slug as string,
        content: values.content as string,
        contentFormat: (values.contentFormat as string) || 'markdown',
        documentType: values.documentType as string,
        category: values.category as string | undefined,
        tags: (values.tags as string[]) || [],
        version: values.version as string | undefined,
      };
      await developerPortalApi.createDocument(payload);
      message.success('文档创建成功');
      setCreateDocModal(false);
      createDocForm.resetFields();
      loadDocuments();
      loadDocStats();
    } catch (err: unknown) {
      message.error(`创建失败: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEditDoc = async (values: any) => {
    if (!selectedDoc) return;
    setLoading(true);
    try {
      const payload: PortalDocumentUpdateRequest = {
        title: values.title as string,
        slug: values.slug as string,
        content: values.content as string,
        documentType: values.documentType as string,
        category: values.category as string | undefined,
        tags: (values.tags as string[]) || [],
      };
      await developerPortalApi.updateDocument(selectedDoc.id, payload);
      message.success('文档更新成功');
      setEditDocDrawer(false);
      editDocForm.resetFields();
      loadDocuments();
    } catch (err: unknown) {
      message.error(`更新失败: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDoc = async (id: string) => {
    try {
      await developerPortalApi.deleteDocument(id);
      message.success('文档已删除');
      loadDocuments();
      loadDocStats();
    } catch (err: unknown) {
      message.error(`删除失败: ${(err as Error).message}`);
    }
  };

  const handlePublish = async (id: string) => {
    try {
      await developerPortalApi.publishDocument(id);
      message.success('文档已发布');
      loadDocuments();
      loadDocStats();
    } catch (err: unknown) {
      message.error(`发布失败: ${(err as Error).message}`);
    }
  };

  const handleUnpublish = async (id: string) => {
    try {
      await developerPortalApi.unpublishDocument(id);
      message.success('已取消发布');
      loadDocuments();
      loadDocStats();
    } catch (err: unknown) {
      message.error(`取消发布失败: ${(err as Error).message}`);
    }
  };

  const handleCreateVersion = async (values: any) => {
    if (!selectedDoc) return;
    setLoading(true);
    try {
      await developerPortalApi.createDocumentVersion(selectedDoc.id, values.version as string);
      message.success('新版本创建成功');
      setNewVersionModal(false);
      newVersionForm.resetFields();
      loadDocuments();
    } catch (err: unknown) {
      message.error(`创建版本失败: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const openDocDetail = async (doc: PortalDocument) => {
    setSelectedDoc(doc);
    setDetailDocDrawer(true);
    try {
      const resp = await developerPortalApi.getDocumentVersions(doc.id);
      setDocVersions(resp.data || []);
    } catch {
      setDocVersions([]);
    }
  };

  const openDocEdit = (doc: PortalDocument) => {
    setSelectedDoc(doc);
    editDocForm.setFieldsValue({
      title: doc.title,
      slug: doc.slug,
      content: doc.content,
      documentType: doc.documentType,
      category: doc.category,
      tags: doc.tags,
    });
    setEditDocDrawer(true);
  };

  // ==================== Mock Handlers ====================

  const handleCreateMock = async (values: any) => {
    setLoading(true);
    try {
      const payload: MockRuleCreateRequest = {
        name: values.name as string,
        description: values.description as string,
        method: values.method as string,
        path: values.path as string,
        statusCode: values.statusCode as number,
        headers: { 'Content-Type': 'application/json' },
        body: values.body ? JSON.parse(values.body as string) : {},
        delay: values.delay as number,
        priority: values.priority as number,
        matchType: values.matchType as 'exact' | 'prefix' | 'regex',
      };
      await developerPortalApi.createMockRule(payload);
      message.success('Mock 规则创建成功');
      setCreateMockModal(false);
      createMockForm.resetFields();
      loadMockRules();
      loadMockStats();
    } catch (err: unknown) {
      message.error(`创建失败: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEditMock = async (values: any) => {
    if (!selectedMock) return;
    setLoading(true);
    try {
      await developerPortalApi.updateMockRule(selectedMock.id, {
        name: values.name as string,
        description: values.description as string,
        method: values.method as string,
        path: values.path as string,
        statusCode: values.statusCode as number,
        body: values.body ? JSON.parse(values.body as string) : {},
        delay: values.delay as number,
        priority: values.priority as number,
        matchType: values.matchType as 'exact' | 'prefix' | 'regex',
      });
      message.success('Mock 规则更新成功');
      setEditMockModal(false);
      editMockForm.resetFields();
      loadMockRules();
    } catch (err: unknown) {
      message.error(`更新失败: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMock = async (id: string) => {
    try {
      await developerPortalApi.deleteMockRule(id);
      message.success('Mock 规则已删除');
      loadMockRules();
      loadMockStats();
    } catch (err: unknown) {
      message.error(`删除失败: ${(err as Error).message}`);
    }
  };

  const handleToggleMock = async (id: string) => {
    try {
      await developerPortalApi.toggleMockRule(id);
      message.success('状态已切换');
      loadMockRules();
      loadMockStats();
    } catch (err: unknown) {
      message.error(`切换失败: ${(err as Error).message}`);
    }
  };

  const openMockEdit = (rule: MockRule) => {
    setSelectedMock(rule);
    editMockForm.setFieldsValue({
      name: rule.name,
      description: rule.description,
      method: rule.method,
      path: rule.path,
      statusCode: rule.statusCode,
      body: typeof rule.body === 'string' ? rule.body : JSON.stringify(rule.body, null, 2),
      delay: rule.delay,
      priority: rule.priority,
      matchType: rule.matchType,
    });
    setEditMockModal(true);
  };

  // ==================== SDK Handlers ====================

  const handleCreateSdk = async (values: any) => {
    setLoading(true);
    try {
      const payload: SDKGenerateRequest = {
        name: values.name as string,
        apiSpec: values.apiSpec as string,
        language: values.language as SDKLanguage,
        packageName: values.packageName as string,
        version: values.version as string,
      };
      await developerPortalApi.generateSDK(payload);
      message.success('SDK 生成任务已创建');
      setCreateSdkModal(false);
      createSdkForm.resetFields();
      loadSdkTasks();
      loadSdkStats();
    } catch (err: unknown) {
      message.error(`创建失败: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSdk = async (id: string) => {
    try {
      await developerPortalApi.deleteSDKTask(id);
      message.success('SDK 任务已删除');
      loadSdkTasks();
      loadSdkStats();
    } catch (err: unknown) {
      message.error(`删除失败: ${(err as Error).message}`);
    }
  };

  const handleRegenerateSdk = async (id: string) => {
    try {
      await developerPortalApi.regenerateSDK(id);
      message.success('重新生成已启动');
      setTimeout(() => {
        loadSdkTasks();
        loadSdkStats();
      }, 1500);
    } catch (err: unknown) {
      message.error(`重新生成失败: ${(err as Error).message}`);
    }
  };

  // ==================== Subscription Handlers ====================

  const handleCreateSub = async (values: any) => {
    setLoading(true);
    try {
      const payload: SubscriptionCreateRequest = {
        apiName: values.apiName as string,
        planName: values.planName as string,
        quotaPerDay: values.quotaPerDay as number,
        quotaPerMonth: values.quotaPerMonth as number,
        reason: values.reason as string,
      };
      await developerPortalApi.createSubscription(payload);
      message.success('订阅申请已提交');
      setCreateSubModal(false);
      createSubForm.resetFields();
      loadSubscriptions();
      loadSubStats();
    } catch (err: unknown) {
      message.error(`提交失败: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveSub = async (id: string) => {
    try {
      await developerPortalApi.approveSubscription(id);
      message.success('订阅已批准');
      loadSubscriptions();
      loadSubStats();
    } catch (err: unknown) {
      message.error(`批准失败: ${(err as Error).message}`);
    }
  };

  const handleRejectSub = async (values: any) => {
    if (!selectedSub) return;
    try {
      await developerPortalApi.rejectSubscription(selectedSub.id, values.reason as string);
      message.success('订阅已拒绝');
      setRejectSubModal(false);
      rejectSubForm.resetFields();
      loadSubscriptions();
      loadSubStats();
    } catch (err: unknown) {
      message.error(`拒绝失败: ${(err as Error).message}`);
    }
  };

  const handleSuspendSub = async (id: string) => {
    try {
      await developerPortalApi.suspendSubscription(id);
      message.success('订阅已暂停');
      loadSubscriptions();
      loadSubStats();
    } catch (err: unknown) {
      message.error(`暂停失败: ${(err as Error).message}`);
    }
  };

  const handleCancelSub = async (id: string) => {
    try {
      await developerPortalApi.cancelSubscription(id);
      message.success('订阅已取消');
      loadSubscriptions();
      loadSubStats();
    } catch (err: unknown) {
      message.error(`取消失败: ${(err as Error).message}`);
    }
  };

  // ==================== Playground Handlers ====================

  const handleExecutePlayground = async (values: any) => {
    setPgExecuting(true);
    setPlaygroundResult(null);
    try {
      const payload: PlaygroundExecuteRequest = {
        method: values.method as string,
        url: values.url as string,
        headers: values.headers ? JSON.parse(values.headers as string) : {},
        queryParams: values.queryParams ? JSON.parse(values.queryParams as string) : {},
        body: values.body as string,
        bodyType: values.bodyType as 'json' | 'form' | 'raw' | 'none',
      };
      const resp = await developerPortalApi.executePlaygroundRequest(payload);
      setPlaygroundResult(resp.data as any);
      message.success(`请求完成 - ${resp.data?.response?.statusCode}`);
      loadPlaygroundRequests();
      loadPgStats();
    } catch (err: unknown) {
      message.error(`请求失败: ${(err as Error).message}`);
    } finally {
      setPgExecuting(false);
    }
  };

  const handleDeletePgRequest = async (id: string) => {
    try {
      await developerPortalApi.deletePlaygroundRequest(id);
      message.success('请求已删除');
      loadPlaygroundRequests();
      loadPgStats();
    } catch (err: unknown) {
      message.error(`删除失败: ${(err as Error).message}`);
    }
  };

  const handleReplayRequest = async (id: string) => {
    setPgExecuting(true);
    try {
      const resp = await developerPortalApi.executeSavedPlaygroundRequest(id);
      setPlaygroundResult(resp.data as any);
      message.success(`重放完成 - ${resp.data?.response?.statusCode}`);
      loadPgStats();
    } catch (err: unknown) {
      message.error(`重放失败: ${(err as Error).message}`);
    } finally {
      setPgExecuting(false);
    }
  };

  const openPgHistory = async (requestId: string) => {
    try {
      const resp = await developerPortalApi.getPlaygroundHistory(requestId);
      setPgHistory((resp.data || []) as any[]);
      setPgHistoryDrawer(true);
    } catch {
      setPgHistory([]);
    }
  };

  const loadSavedRequest = (req: PlaygroundRequest) => {
    playgroundForm.setFieldsValue({
      method: req.method,
      url: req.url,
      headers:
        Object.keys(req.headers || {}).length > 0 ? JSON.stringify(req.headers, null, 2) : '',
      queryParams:
        Object.keys(req.queryParams || {}).length > 0
          ? JSON.stringify(req.queryParams, null, 2)
          : '',
      body: req.body || '',
      bodyType: req.bodyType,
    });
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => message.success('已复制到剪贴板'));
  };


  // ==================== Column Hooks ====================

  const docColumns = useDocColumns({
    onDocDetail: openDocDetail,
    onDocEdit: openDocEdit,
    onPublish: handlePublish,
    onUnpublish: handleUnpublish,
    onDelete: handleDeleteDoc,
  });

  const mockColumns = useMockColumns({
    onToggle: handleToggleMock,
    onEdit: openMockEdit,
    onDelete: handleDeleteMock,
  });

  const sdkColumns = useSdkColumns({
    onDetail: (sdk) => {
      setSelectedSdk(sdk);
      setSdkDetailDrawer(true);
    },
    onRegenerate: handleRegenerateSdk,
    onDelete: handleDeleteSdk,
  });

  const subColumns = useSubColumns({
    onDetail: (sub) => {
      setSelectedSub(sub);
      setSubDetailDrawer(true);
    },
    onApprove: handleApproveSub,
    onReject: (sub) => {
      setSelectedSub(sub);
      setRejectSubModal(true);
    },
    onSuspend: handleSuspendSub,
    onCancel: handleCancelSub,
    onCopyKey: handleCopyToClipboard,
  });

  const pgColumns = usePgColumns({
    onLoad: loadSavedRequest,
    onReplay: handleReplayRequest,
    onHistory: openPgHistory,
    onDelete: handleDeletePgRequest,
  });

  // ==================== Tab Items ====================

  const tabItems = [
    {
      key: TAB_KEYS.DOCS,
      label: (
        <span>
          <FileTextOutlined /> API 文档
        </span>
      ),
    },
    {
      key: TAB_KEYS.MOCK,
      label: (
        <span>
          <ExperimentOutlined /> Mock 服务
        </span>
      ),
    },
    {
      key: TAB_KEYS.SDK,
      label: (
        <span>
          <CodeOutlined /> SDK 生成
        </span>
      ),
    },
    {
      key: TAB_KEYS.SUBSCRIPTIONS,
      label: (
        <span>
          <KeyOutlined /> 订阅管理
        </span>
      ),
    },
    {
      key: TAB_KEYS.PLAYGROUND,
      label: (
        <span>
          <ThunderboltOutlined /> 在线调试
        </span>
      ),
    },
  ];

  return {
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
    handleApproveSub,
    handleCancelSub,
    handleCopyToClipboard,
    handleCreateDoc,
    handleCreateMock,
    handleCreateSdk,
    handleCreateSub,
    handleCreateVersion,
    handleDeleteDoc,
    handleDeleteMock,
    handleDeletePgRequest,
    handleDeleteSdk,
    handleEditDoc,
    handleEditMock,
    handleExecutePlayground,
    handlePublish,
    handleRegenerateSdk,
    handleRejectSub,
    handleReplayRequest,
    handleSuspendSub,
    handleToggleMock,
    handleUnpublish,
    loadDocStats,
    loadDocuments,
    loadMockRules,
    loadMockStats,
    loadPgStats,
    loadPlaygroundRequests,
    loadSavedRequest,
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
    openDocDetail,
    openDocEdit,
    openMockEdit,
    openPgHistory,
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
    setDocPagination,
    setDocSearchText,
    setDocStats,
    setDocVersions,
    setDocuments,
    setEditDocDrawer,
    setEditMockModal,
    setLoading,
    setMockPagination,
    setMockRules,
    setMockStats,
    setNewVersionModal,
    setPgExecuting,
    setPgHistory,
    setPgHistoryDrawer,
    setPgPagination,
    setPgStats,
    setPlaygroundRequests,
    setPlaygroundResult,
    setRejectSubModal,
    setSdkDetailDrawer,
    setSdkPagination,
    setSdkStats,
    setSdkTasks,
    setSelectedDoc,
    setSelectedMock,
    setSelectedSdk,
    setSelectedSub,
    setSubDetailDrawer,
    setSubPagination,
    setSubStats,
    setSubscriptions,
    subColumns,
    subDetailDrawer,
    subPagination,
    subStats,
    subscriptions,
    tabItems,
  };
}

export default useDeveloperPortalState;
