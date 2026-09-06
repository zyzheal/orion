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

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Tabs,
  Tag,
  Input,
  message,
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
  FileTextOutlined,
  CodeOutlined,
  PlusOutlined,
  ReloadOutlined,
  StarOutlined,
  ThunderboltOutlined,
  ExperimentOutlined,
  SendOutlined,
  CopyOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  ClockCircleOutlined,
  KeyOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import {
  developerPortalApi,
  PortalDocument,
  PortalDocumentCreateRequest,
  PortalDocumentUpdateRequest,
  MockRule,
  MockRuleCreateRequest,
  SDKGenerationTask,
  SDKGenerateRequest,
  SDKLanguage,
  APISubscription,
  SubscriptionCreateRequest,
  PlaygroundRequest,
  PlaygroundExecuteRequest,
} from '@/api/developer-portal';
import { colors, spacing, themeVars } from '@/tokens';

const { Title, Text } = Typography;
const { Search } = Input;
const { TextArea } = Input;

import { DeveloperPortalModals } from './DeveloperPortalModals';

import {
  httpMethods,
  TAB_KEYS,
} from './constants';
import type { TabKey } from './types';
import {
  useDocColumns,
  useMockColumns,
  useSdkColumns,
  useSubColumns,
  usePgColumns,
} from './columns';

// ==================== Component ====================

const DeveloperPortalPage: React.FC = () => {
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

  // ==================== Render ====================

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
