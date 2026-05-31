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
  Badge,
  Input,
  message,
  Descriptions,
  Typography,
  Space,
  Modal,
  Form,
  Select,
  Drawer,
  Row,
  Col,
  Statistic,
  Empty,
  Popconfirm,
  Switch,
  Tooltip,
  InputNumber,
  Spin,
  Divider,
} from 'antd';
import {
  ApiOutlined,
  CodeOutlined,
  SearchOutlined,
  PlusOutlined,
  ReloadOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  CloudUploadOutlined,
  StarOutlined,
  ThunderboltOutlined,
  RocketOutlined,
  DownloadOutlined,
  FileTextOutlined,
  ExperimentOutlined,
  BellOutlined,
  SendOutlined,
  CopyOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  ClockCircleOutlined,
  StopOutlined,
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
} from '../../api/developer-portal';
import type { ColumnsType } from 'antd/es/table';
import { colors } from '@/tokens';

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;
const { TextArea } = Input;

// ==================== Config ====================

const documentTypeConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  api_doc: { label: 'API 文档', color: 'blue', icon: <ApiOutlined /> },
  sdk: { label: 'SDK', color: 'green', icon: <DownloadOutlined /> },
  guide: { label: '指南', color: 'orange', icon: <RocketOutlined /> },
  tutorial: { label: '教程', color: 'purple', icon: <FileTextOutlined /> },
  reference: { label: '参考', color: 'cyan', icon: <FileTextOutlined /> },
  sample: { label: '示例', color: 'gold', icon: <ThunderboltOutlined /> },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  published: { label: '已发布', color: 'green' },
  draft: { label: '草稿', color: 'default' },
};

const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

const languageOptions: { value: SDKLanguage; label: string }[] = [
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'go', label: 'Go' },
  { value: 'java', label: 'Java' },
  { value: 'csharp', label: 'C#' },
];

const subscriptionStatusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '待审批', color: 'orange' },
  approved: { label: '已通过', color: 'green' },
  rejected: { label: '已拒绝', color: 'red' },
  suspended: { label: '已暂停', color: 'default' },
  cancelled: { label: '已取消', color: 'default' },
};

const sdkStatusMap: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: '等待中', color: 'default', icon: <ClockCircleOutlined /> },
  generating: { label: '生成中', color: 'processing', icon: <SyncOutlined spin /> },
  completed: { label: '已完成', color: 'success', icon: <CheckCircleOutlined /> },
  failed: { label: '失败', color: 'error', icon: <CloseCircleOutlined /> },
};

const TAB_KEYS = {
  DOCS: 'docs',
  MOCK: 'mock',
  SDK: 'sdk',
  SUBSCRIPTIONS: 'subscriptions',
  PLAYGROUND: 'playground',
};

// ==================== Component ====================

const DeveloperPortalPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState(TAB_KEYS.DOCS);

  // ---- Shared state ----
  const [loading, setLoading] = useState(false);

  // ---- Document state ----
  const [documents, setDocuments] = useState<PortalDocument[]>([]);
  const [docStats, setDocStats] = useState({ total: 0, published: 0, draft: 0, inReview: 0, totalViews: 0, totalHelpful: 0 });
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
  const [subStats, setSubStats] = useState({ totalSubscriptions: 0, approved: 0, pending: 0, rejected: 0, suspended: 0 });
  const [subPagination, setSubPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [createSubModal, setCreateSubModal] = useState(false);
  const [subDetailDrawer, setSubDetailDrawer] = useState(false);
  const [selectedSub, setSelectedSub] = useState<APISubscription | null>(null);
  const [createSubForm] = Form.useForm();
  const [rejectSubModal, setRejectSubModal] = useState(false);
  const [rejectSubForm] = Form.useForm();

  // ---- Playground state ----
  const [playgroundRequests, setPlaygroundRequests] = useState<PlaygroundRequest[]>([]);
  const [playgroundResult, setPlaygroundResult] = useState<{ request: PlaygroundRequest; response: { statusCode: number; statusText: string; headers: Record<string, string>; body: string; latencyMs: number } } | null>(null);
  const [pgPagination, setPgPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [pgExecuting, setPgExecuting] = useState(false);
  const [pgHistoryDrawer, setPgHistoryDrawer] = useState(false);
  const [pgHistory, setPgHistory] = useState<Array<{ id: string; statusCode: number; latencyMs: number; timestamp: string }>>([]);
  const [playgroundForm] = Form.useForm();
  const [pgStats, setPgStats] = useState({ totalRequests: 0, totalExecutions: 0, avgLatency: 0 });

  // ==================== Data Loading ====================

  const loadDocuments = useCallback(async (page = 1, search?: string) => {
    setLoading(true);
    try {
      if (search) {
        const resp = await developerPortalApi.searchDocuments(search);
        setDocuments(resp.data || []);
        setDocPagination((p) => ({ ...p, current: 1, total: resp.total || 0 }));
      } else {
        const resp = await developerPortalApi.listDocuments({ page, perPage: docPagination.pageSize });
        setDocuments(resp.data || []);
        setDocPagination((p) => ({ ...p, current: page, total: resp.total || 0 }));
      }
    } catch (err: unknown) {
      message.error(`加载文档失败: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [docPagination.pageSize]);

  const loadDocStats = useCallback(async () => {
    try {
      const resp = await developerPortalApi.getDocumentStats();
      if (resp.data) setDocStats(resp.data);
    } catch { /* non-critical */ }
  }, []);

  const loadMockRules = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const resp = await developerPortalApi.listMockRules({ page, pageSize: mockPagination.pageSize });
      setMockRules(resp.data || []);
      setMockPagination((p) => ({ ...p, current: page, total: resp.total || 0 }));
    } catch (err: unknown) {
      message.error(`加载Mock规则失败: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [mockPagination.pageSize]);

  const loadMockStats = useCallback(async () => {
    try {
      const resp = await developerPortalApi.getMockStats();
      if (resp.data) setMockStats(resp.data);
    } catch { /* non-critical */ }
  }, []);

  const loadSdkTasks = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const resp = await developerPortalApi.listSDKTasks({ page, pageSize: sdkPagination.pageSize });
      setSdkTasks(resp.data || []);
      setSdkPagination((p) => ({ ...p, current: page, total: resp.total || 0 }));
    } catch (err: unknown) {
      message.error(`加载SDK任务失败: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [sdkPagination.pageSize]);

  const loadSdkStats = useCallback(async () => {
    try {
      const resp = await developerPortalApi.getSDKStats();
      if (resp.data) setSdkStats(resp.data);
    } catch { /* non-critical */ }
  }, []);

  const loadSubscriptions = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const resp = await developerPortalApi.listSubscriptions({ page, pageSize: subPagination.pageSize });
      setSubscriptions(resp.data || []);
      setSubPagination((p) => ({ ...p, current: page, total: resp.total || 0 }));
    } catch (err: unknown) {
      message.error(`加载订阅失败: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [subPagination.pageSize]);

  const loadSubStats = useCallback(async () => {
    try {
      const resp = await developerPortalApi.getSubscriptionStats();
      if (resp.data) setSubStats(resp.data);
    } catch { /* non-critical */ }
  }, []);

  const loadPlaygroundRequests = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const resp = await developerPortalApi.listPlaygroundRequests({ page, pageSize: pgPagination.pageSize });
      setPlaygroundRequests(resp.data || []);
      setPgPagination((p) => ({ ...p, current: page, total: resp.total || 0 }));
    } catch (err: unknown) {
      message.error(`加载请求历史失败: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [pgPagination.pageSize]);

  const loadPgStats = useCallback(async () => {
    try {
      const resp = await developerPortalApi.getPlaygroundStats();
      if (resp.data) setPgStats(resp.data);
    } catch { /* non-critical */ }
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

  const handleCreateDoc = async (values: Record<string, unknown>) => {
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

  const handleEditDoc = async (values: Record<string, unknown>) => {
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

  const handleCreateVersion = async (values: Record<string, unknown>) => {
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

  const handleCreateMock = async (values: Record<string, unknown>) => {
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

  const handleEditMock = async (values: Record<string, unknown>) => {
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

  const handleCreateSdk = async (values: Record<string, unknown>) => {
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
      setTimeout(() => { loadSdkTasks(); loadSdkStats(); }, 1500);
    } catch (err: unknown) {
      message.error(`重新生成失败: ${(err as Error).message}`);
    }
  };

  // ==================== Subscription Handlers ====================

  const handleCreateSub = async (values: Record<string, unknown>) => {
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

  const handleRejectSub = async (values: Record<string, unknown>) => {
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

  const handleExecutePlayground = async (values: Record<string, unknown>) => {
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
      headers: Object.keys(req.headers || {}).length > 0 ? JSON.stringify(req.headers, null, 2) : '',
      queryParams: Object.keys(req.queryParams || {}).length > 0 ? JSON.stringify(req.queryParams, null, 2) : '',
      body: req.body || '',
      bodyType: req.bodyType,
    });
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => message.success('已复制到剪贴板'));
  };

  // ==================== Document Columns ====================

  const docColumns: ColumnsType<PortalDocument> = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 250,
      render: (text: string, record: PortalDocument) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ cursor: 'pointer', color: colors.primary[500] }} onClick={() => openDocDetail(record)}>
            {documentTypeConfig[record.documentType]?.icon}
            <span style={{ marginLeft: 6 }}>{text}</span>
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.slug}</Text>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'documentType',
      key: 'documentType',
      width: 100,
      render: (type: string) => {
        const cfg = documentTypeConfig[type] || { label: type, color: 'default' };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 80,
      render: (v: string) => v || '-',
    },
    {
      title: '状态',
      dataIndex: 'published',
      key: 'published',
      width: 90,
      render: (published: boolean) => {
        const cfg = published ? statusConfig.published : statusConfig.draft;
        return <Badge status={published ? 'success' : 'default'} text={cfg.label} />;
      },
    },
    {
      title: '浏览',
      dataIndex: 'viewCount',
      key: 'viewCount',
      width: 70,
      render: (n: number) => n || 0,
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: unknown, record: PortalDocument) => (
        <Space size="small">
          <Tooltip title="查看"><Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDocDetail(record)} /></Tooltip>
          <Tooltip title="编辑"><Button type="link" size="small" icon={<EditOutlined />} onClick={() => openDocEdit(record)} /></Tooltip>
          {record.published ? (
            <Tooltip title="取消发布"><Button type="link" size="small" onClick={() => handleUnpublish(record.id)}>下架</Button></Tooltip>
          ) : (
            <Tooltip title="发布"><Button type="link" size="small" onClick={() => handlePublish(record.id)}>发布</Button></Tooltip>
          )}
          <Popconfirm title="确认删除此文档？" onConfirm={() => handleDeleteDoc(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ==================== Mock Columns ====================

  const mockColumns: ColumnsType<MockRule> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      render: (text: string, record: MockRule) => (
        <Space direction="vertical" size={0}>
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.description}</Text>
        </Space>
      ),
    },
    {
      title: '方法',
      dataIndex: 'method',
      key: 'method',
      width: 80,
      render: (m: string) => {
        const colorMap: Record<string, string> = { GET: 'green', POST: 'blue', PUT: 'orange', DELETE: 'red', PATCH: 'purple' };
        return <Tag color={colorMap[m] || 'default'}>{m}</Tag>;
      },
    },
    {
      title: '路径',
      dataIndex: 'path',
      key: 'path',
      width: 200,
      render: (p: string) => <Text code>{p}</Text>,
    },
    {
      title: '匹配类型',
      dataIndex: 'matchType',
      key: 'matchType',
      width: 100,
      render: (t: string) => <Tag>{t === 'exact' ? '精确' : t === 'prefix' ? '前缀' : '正则'}</Tag>,
    },
    {
      title: '状态码',
      dataIndex: 'statusCode',
      key: 'statusCode',
      width: 80,
      render: (code: number) => <Tag color={code < 300 ? 'green' : code < 400 ? 'blue' : code < 500 ? 'orange' : 'red'}>{code}</Tag>,
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (enabled: boolean, record: MockRule) => (
        <Switch checked={enabled} size="small" onChange={() => handleToggleMock(record.id)} />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: MockRule) => (
        <Space size="small">
          <Tooltip title="编辑"><Button type="link" size="small" icon={<EditOutlined />} onClick={() => openMockEdit(record)} /></Tooltip>
          <Popconfirm title="确认删除此规则？" onConfirm={() => handleDeleteMock(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ==================== SDK Columns ====================

  const sdkColumns: ColumnsType<SDKGenerationTask> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: '语言',
      dataIndex: 'language',
      key: 'language',
      width: 120,
      render: (lang: string) => <Tag color="blue">{lang}</Tag>,
    },
    {
      title: '包名',
      dataIndex: 'packageName',
      key: 'packageName',
      width: 200,
      render: (n: string) => <Text code>{n}</Text>,
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 80,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const cfg = sdkStatusMap[status] || sdkStatusMap.pending;
        return <Tag icon={cfg.icon} color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_: unknown, record: SDKGenerationTask) => (
        <Space size="small">
          <Tooltip title="查看代码"><Button type="link" size="small" icon={<EyeOutlined />} onClick={() => { setSelectedSdk(record); setSdkDetailDrawer(true); }} /></Tooltip>
          {record.status === 'failed' && (
            <Tooltip title="重新生成"><Button type="link" size="small" icon={<SyncOutlined />} onClick={() => handleRegenerateSdk(record.id)} /></Tooltip>
          )}
          <Popconfirm title="确认删除？" onConfirm={() => handleDeleteSdk(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ==================== Subscription Columns ====================

  const subColumns: ColumnsType<APISubscription> = [
    {
      title: 'API 名称',
      dataIndex: 'apiName',
      key: 'apiName',
      width: 200,
      render: (name: string, record: APISubscription) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ cursor: 'pointer', color: colors.primary[500] }} onClick={() => { setSelectedSub(record); setSubDetailDrawer(true); }}>{name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.planName}</Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const cfg = subscriptionStatusMap[status] || { label: status, color: 'default' };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '日用量',
      key: 'dailyUsage',
      width: 120,
      render: (_: unknown, record: APISubscription) => (
        <Text>{record.usedToday} / {record.quotaPerDay}</Text>
      ),
    },
    {
      title: '月用量',
      key: 'monthlyUsage',
      width: 120,
      render: (_: unknown, record: APISubscription) => (
        <Text>{record.usedThisMonth} / {record.quotaPerMonth}</Text>
      ),
    },
    {
      title: 'API Key',
      dataIndex: 'apiKey',
      key: 'apiKey',
      width: 160,
      render: (key: string) => (
        <Space>
          <Text code style={{ fontSize: 11 }}>{key?.substring(0, 16)}...</Text>
          <Tooltip title="复制"><Button type="link" size="small" icon={<CopyOutlined />} onClick={() => handleCopyToClipboard(key)} /></Tooltip>
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: unknown, record: APISubscription) => (
        <Space size="small">
          <Tooltip title="详情"><Button type="link" size="small" icon={<EyeOutlined />} onClick={() => { setSelectedSub(record); setSubDetailDrawer(true); }} /></Tooltip>
          {record.status === 'pending' && (
            <>
              <Button type="link" size="small" onClick={() => handleApproveSub(record.id)}>批准</Button>
              <Button type="link" size="small" danger onClick={() => { setSelectedSub(record); setRejectSubModal(true); }}>拒绝</Button>
            </>
          )}
          {record.status === 'approved' && (
            <>
              <Popconfirm title="确认暂停？" onConfirm={() => handleSuspendSub(record.id)}>
                <Button type="link" size="small">暂停</Button>
              </Popconfirm>
              <Popconfirm title="确认取消？" onConfirm={() => handleCancelSub(record.id)}>
                <Button type="link" size="small" danger>取消</Button>
              </Popconfirm>
            </>
          )}
          {(record.status === 'suspended' || record.status === 'rejected') && (
            <Popconfirm title="确认取消？" onConfirm={() => handleCancelSub(record.id)}>
              <Button type="link" size="small" danger>取消</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  // ==================== Playground Columns ====================

  const pgColumns: ColumnsType<PlaygroundRequest> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: '方法',
      dataIndex: 'method',
      key: 'method',
      width: 80,
      render: (m: string) => {
        const colorMap: Record<string, string> = { GET: 'green', POST: 'blue', PUT: 'orange', DELETE: 'red', PATCH: 'purple' };
        return <Tag color={colorMap[m] || 'default'}>{m}</Tag>;
      },
    },
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
      width: 300,
      ellipsis: true,
      render: (url: string) => <Text code>{url}</Text>,
    },
    {
      title: 'Body 类型',
      dataIndex: 'bodyType',
      key: 'bodyType',
      width: 90,
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: unknown, record: PlaygroundRequest) => (
        <Space size="small">
          <Tooltip title="加载到表单"><Button type="link" size="small" icon={<DownloadOutlined />} onClick={() => loadSavedRequest(record)} /></Tooltip>
          <Tooltip title="重放"><Button type="link" size="small" icon={<SendOutlined />} onClick={() => handleReplayRequest(record.id)} /></Tooltip>
          <Tooltip title="响应历史"><Button type="link" size="small" icon={<HistoryOutlined />} onClick={() => openPgHistory(record.id)} /></Tooltip>
          <Popconfirm title="确认删除？" onConfirm={() => handleDeletePgRequest(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ==================== Tab Items ====================

  const tabItems = [
    { key: TAB_KEYS.DOCS, label: <span><FileTextOutlined /> API 文档</span> },
    { key: TAB_KEYS.MOCK, label: <span><ExperimentOutlined /> Mock 服务</span> },
    { key: TAB_KEYS.SDK, label: <span><CodeOutlined /> SDK 生成</span> },
    { key: TAB_KEYS.SUBSCRIPTIONS, label: <span><KeyOutlined /> 订阅管理</span> },
    { key: TAB_KEYS.PLAYGROUND, label: <span><ThunderboltOutlined /> 在线调试</span> },
  ];

  // ==================== Render ====================

  return (
    <div style={{ padding: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <CodeOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            开发者门户
          </Title>
          <Text type="secondary">API 文档、Mock 服务、SDK 生成、订阅管理与在线调试</Text>
        </div>
        <Space>
          {activeTab === TAB_KEYS.DOCS && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { createDocForm.resetFields(); setCreateDocModal(true); }}>
              创建文档
            </Button>
          )}
          {activeTab === TAB_KEYS.MOCK && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { createMockForm.resetFields(); setCreateMockModal(true); }}>
              添加规则
            </Button>
          )}
          {activeTab === TAB_KEYS.SDK && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { createSdkForm.resetFields(); setCreateSdkModal(true); }}>
              生成 SDK
            </Button>
          )}
          {activeTab === TAB_KEYS.SUBSCRIPTIONS && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { createSubForm.resetFields(); setCreateSubModal(true); }}>
              申请订阅
            </Button>
          )}
          <Button icon={<ReloadOutlined />} onClick={() => {
            switch (activeTab) {
              case TAB_KEYS.DOCS: loadDocuments(); loadDocStats(); break;
              case TAB_KEYS.MOCK: loadMockRules(); loadMockStats(); break;
              case TAB_KEYS.SDK: loadSdkTasks(); loadSdkStats(); break;
              case TAB_KEYS.SUBSCRIPTIONS: loadSubscriptions(); loadSubStats(); break;
              case TAB_KEYS.PLAYGROUND: loadPlaygroundRequests(); loadPgStats(); break;
            }
          }} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      {/* Main Tabs */}
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} style={{ marginBottom: 16 }} />

      {/* ==================== Tab: API Documents ==================== */}
      {activeTab === TAB_KEYS.DOCS && (
        <>
          {/* Stats */}
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={4}><Card size="small"><Statistic title="文档总数" value={docStats.total} /></Card></Col>
            <Col span={4}><Card size="small"><Statistic title="已发布" value={docStats.published} valueStyle={{ color: colors.success[500] }} /></Card></Col>
            <Col span={4}><Card size="small"><Statistic title="草稿" value={docStats.draft} valueStyle={{ color: colors.neutral[500] }} /></Card></Col>
            <Col span={4}><Card size="small"><Statistic title="审核中" value={docStats.inReview} valueStyle={{ color: colors.warning[500] }} /></Card></Col>
            <Col span={4}><Card size="small"><Statistic title="总浏览" value={docStats.totalViews} /></Card></Col>
            <Col span={4}><Card size="small"><Statistic title="总点赞" value={docStats.totalHelpful} prefix={<StarOutlined style={{ color: colors.warning[500] }} />} /></Card></Col>
          </Row>

          <Card>
            <div style={{ marginBottom: 16 }}>
              <Search
                placeholder="搜索文档..."
                allowClear
                style={{ width: 400 }}
                value={docSearchText}
                onChange={(e) => setDocSearchText(e.target.value)}
                onSearch={(v) => { if (v.trim()) loadDocuments(1, v.trim()); else loadDocuments(1); }}
              />
            </div>
            <Table
              columns={docColumns}
              dataSource={documents}
              rowKey="id"
              loading={loading}
              pagination={{ ...docPagination, showSizeChanger: true, showTotal: (t) => `共 ${t} 条`, onChange: (p) => loadDocuments(p) }}
              locale={{ emptyText: <Empty description={'暂无文档，点击"创建文档"开始添加'}><Button type="primary" icon={<PlusOutlined />} onClick={() => { createDocForm.resetFields(); setCreateDocModal(true); }}>创建文档</Button></Empty> }}
            />
          </Card>
        </>
      )}

      {/* ==================== Tab: Mock Service ==================== */}
      {activeTab === TAB_KEYS.MOCK && (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}><Card size="small"><Statistic title="规则总数" value={mockStats.total} /></Card></Col>
            <Col span={8}><Card size="small"><Statistic title="已启用" value={mockStats.enabled} valueStyle={{ color: colors.success[500] }} /></Card></Col>
            <Col span={8}><Card size="small"><Statistic title="已禁用" value={mockStats.disabled} valueStyle={{ color: colors.neutral[500] }} /></Card></Col>
          </Row>

          <Card>
            <Table
              columns={mockColumns}
              dataSource={mockRules}
              rowKey="id"
              loading={loading}
              pagination={{ ...mockPagination, showSizeChanger: true, showTotal: (t) => `共 ${t} 条`, onChange: (p) => loadMockRules(p) }}
              locale={{ emptyText: <Empty description="暂无 Mock 规则"><Button type="primary" icon={<PlusOutlined />} onClick={() => { createMockForm.resetFields(); setCreateMockModal(true); }}>添加规则</Button></Empty> }}
            />
          </Card>
        </>
      )}

      {/* ==================== Tab: SDK Generator ==================== */}
      {activeTab === TAB_KEYS.SDK && (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}><Card size="small"><Statistic title="任务总数" value={sdkStats.total} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="已完成" value={sdkStats.completed} valueStyle={{ color: colors.success[500] }} prefix={<CheckCircleOutlined />} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="生成中" value={sdkStats.pending} valueStyle={{ color: colors.primary[500] }} prefix={<SyncOutlined spin />} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="失败" value={sdkStats.failed} valueStyle={{ color: colors.error[500] }} prefix={<CloseCircleOutlined />} /></Card></Col>
          </Row>

          <Card>
            <Table
              columns={sdkColumns}
              dataSource={sdkTasks}
              rowKey="id"
              loading={loading}
              pagination={{ ...sdkPagination, showSizeChanger: true, showTotal: (t) => `共 ${t} 条`, onChange: (p) => loadSdkTasks(p) }}
              locale={{ emptyText: <Empty description="暂无 SDK 任务"><Button type="primary" icon={<PlusOutlined />} onClick={() => { createSdkForm.resetFields(); setCreateSdkModal(true); }}>生成 SDK</Button></Empty> }}
            />
          </Card>
        </>
      )}

      {/* ==================== Tab: Subscriptions ==================== */}
      {activeTab === TAB_KEYS.SUBSCRIPTIONS && (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={5}><Card size="small"><Statistic title="订阅总数" value={subStats.totalSubscriptions} /></Card></Col>
            <Col span={5}><Card size="small"><Statistic title="已通过" value={subStats.approved} valueStyle={{ color: colors.success[500] }} /></Card></Col>
            <Col span={5}><Card size="small"><Statistic title="待审批" value={subStats.pending} valueStyle={{ color: colors.warning[500] }} prefix={<ClockCircleOutlined />} /></Card></Col>
            <Col span={5}><Card size="small"><Statistic title="已拒绝" value={subStats.rejected} valueStyle={{ color: colors.error[500] }} /></Card></Col>
            <Col span={4}><Card size="small"><Statistic title="已暂停" value={subStats.suspended} /></Card></Col>
          </Row>

          <Card>
            <Table
              columns={subColumns}
              dataSource={subscriptions}
              rowKey="id"
              loading={loading}
              pagination={{ ...subPagination, showSizeChanger: true, showTotal: (t) => `共 ${t} 条`, onChange: (p) => loadSubscriptions(p) }}
              locale={{ emptyText: <Empty description="暂无订阅"><Button type="primary" icon={<PlusOutlined />} onClick={() => { createSubForm.resetFields(); setCreateSubModal(true); }}>申请订阅</Button></Empty> }}
            />
          </Card>
        </>
      )}

      {/* ==================== Tab: Playground ==================== */}
      {activeTab === TAB_KEYS.PLAYGROUND && (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}><Card size="small"><Statistic title="保存的请求" value={pgStats.totalRequests} /></Card></Col>
            <Col span={8}><Card size="small"><Statistic title="总执行次数" value={pgStats.totalExecutions} /></Card></Col>
            <Col span={8}><Card size="small"><Statistic title="平均延迟" value={pgStats.avgLatency} suffix="ms" /></Card></Col>
          </Row>

          <Row gutter={16}>
            {/* Request Form */}
            <Col span={12}>
              <Card title={<><SendOutlined style={{ marginRight: 8 }} />请求构建器</>} style={{ marginBottom: 16 }}>
                <Form form={playgroundForm} layout="vertical" onFinish={handleExecutePlayground} initialValues={{ method: 'GET', bodyType: 'json' }}>
                  <Row gutter={12}>
                    <Col span={6}>
                      <Form.Item name="method" label="方法" rules={[{ required: true }]}>
                        <Select options={httpMethods.map((m) => ({ value: m, label: m }))} />
                      </Form.Item>
                    </Col>
                    <Col span={18}>
                      <Form.Item name="url" label="URL" rules={[{ required: true, message: '请输入 URL' }]}>
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
                        <Select options={[{ value: 'none', label: 'None' }, { value: 'json', label: 'JSON' }, { value: 'form', label: 'Form' }, { value: 'raw', label: 'Raw' }]} />
                      </Form.Item>
                    </Col>
                    <Col span={18}>
                      <Form.Item name="body" label="Body">
                        <TextArea rows={4} placeholder='{"key": "value"}' />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item>
                    <Button type="primary" htmlType="submit" icon={<SendOutlined />} loading={pgExecuting} block>
                      发送请求
                    </Button>
                  </Form.Item>
                </Form>
              </Card>
            </Col>

            {/* Response */}
            <Col span={12}>
              <Card
                title={<><ThunderboltOutlined style={{ marginRight: 8 }} />响应结果</>}
                style={{ marginBottom: 16 }}
                extra={playgroundResult && (
                  <Space>
                    <Tag color={playgroundResult.response.statusCode < 300 ? 'green' : playgroundResult.response.statusCode < 400 ? 'blue' : 'red'}>
                      {playgroundResult.response.statusCode} {playgroundResult.response.statusText}
                    </Tag>
                    <Tag>{playgroundResult.response.latencyMs}ms</Tag>
                    <Tooltip title="复制响应">
                      <Button type="link" size="small" icon={<CopyOutlined />} onClick={() => handleCopyToClipboard(playgroundResult.response.body)} />
                    </Tooltip>
                  </Space>
                )}
              >
                {pgExecuting ? (
                  <div style={{ textAlign: 'center', padding: 40 }}><Spin tip="请求中..." /></div>
                ) : playgroundResult ? (
                  <div>
                    <Divider style={{ margin: '8px 0' }}>响应 Headers</Divider>
                    <div style={{ marginBottom: 8 }}>
                      {Object.entries(playgroundResult.response.headers).map(([k, v]) => (
                        <Tag key={k} style={{ marginBottom: 4 }}><Text code style={{ fontSize: 11 }}>{k}: {v}</Text></Tag>
                      ))}
                    </div>
                    <Divider style={{ margin: '8px 0' }}>响应 Body</Divider>
                    <pre style={{ background: colors.light.bg.tertiary, padding: 12, borderRadius: 8, maxHeight: 300, overflow: 'auto', fontSize: 12 }}>
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
          <Card title={<><HistoryOutlined style={{ marginRight: 8 }} />保存的请求</>}>
            <Table
              columns={pgColumns}
              dataSource={playgroundRequests}
              rowKey="id"
              loading={loading}
              size="small"
              pagination={{ ...pgPagination, showSizeChanger: true, showTotal: (t) => `共 ${t} 条`, onChange: (p) => loadPlaygroundRequests(p) }}
              locale={{ emptyText: <Empty description="暂无保存的请求" /> }}
            />
          </Card>
        </>
      )}

      {/* ==================== Modals & Drawers ==================== */}

      {/* Create Document Modal */}
      <Modal title={<><CloudUploadOutlined style={{ marginRight: 8, color: colors.primary[500] }} />创建文档</>} open={createDocModal} onCancel={() => setCreateDocModal(false)} onOk={() => createDocForm.submit()} confirmLoading={loading} width={720} destroyOnClose>
        <Form form={createDocForm} layout="vertical" onFinish={handleCreateDoc}>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}><Input placeholder="如: Orion Pipeline API 参考" /></Form.Item>
          <Form.Item name="slug" label="URL 别名" rules={[{ required: true, message: '请输入 URL 别名' }]}><Input placeholder="如: pipeline-api-reference" /></Form.Item>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="documentType" label="文档类型" rules={[{ required: true }]}><Select options={Object.entries(documentTypeConfig).map(([k, v]) => ({ value: k, label: v.label }))} /></Form.Item></Col>
            <Col span={8}><Form.Item name="category" label="分类"><Input placeholder="如: 持续集成" /></Form.Item></Col>
            <Col span={8}><Form.Item name="version" label="版本"><Input placeholder="v1.0.0" /></Form.Item></Col>
          </Row>
          <Form.Item name="contentFormat" label="内容格式" initialValue="markdown"><Select options={[{ value: 'markdown', label: 'Markdown' }, { value: 'html', label: 'HTML' }, { value: 'plain', label: '纯文本' }]} /></Form.Item>
          <Form.Item name="content" label="内容" rules={[{ required: true, message: '请输入内容' }]}><TextArea rows={6} placeholder="输入文档内容（支持 Markdown）..." /></Form.Item>
          <Form.Item name="tags" label="标签"><Select mode="tags" placeholder="输入标签后回车" /></Form.Item>
        </Form>
      </Modal>

      {/* Edit Document Drawer */}
      <Drawer title={<><EditOutlined style={{ marginRight: 8 }} />编辑文档</>} open={editDocDrawer} onClose={() => setEditDocDrawer(false)} width={720} destroyOnClose extra={<Space>
        {selectedDoc && (selectedDoc.published ? <Button onClick={() => handleUnpublish(selectedDoc.id)}>取消发布</Button> : <Button type="primary" onClick={() => handlePublish(selectedDoc.id)}>发布</Button>)}
        <Button onClick={() => editDocForm.submit()} loading={loading} type="primary">保存</Button>
      </Space>}>
        <Form form={editDocForm} layout="vertical" onFinish={handleEditDoc}>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="slug" label="URL 别名" rules={[{ required: true }]}><Input /></Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="documentType" label="文档类型" rules={[{ required: true }]}><Select options={Object.entries(documentTypeConfig).map(([k, v]) => ({ value: k, label: v.label }))} /></Form.Item></Col>
            <Col span={12}><Form.Item name="category" label="分类"><Input /></Form.Item></Col>
          </Row>
          <Form.Item name="content" label="内容" rules={[{ required: true }]}><TextArea rows={10} /></Form.Item>
          <Form.Item name="tags" label="标签"><Select mode="tags" /></Form.Item>
        </Form>
      </Drawer>

      {/* Document Detail Drawer */}
      <Drawer title={selectedDoc?.title || '文档详情'} open={detailDocDrawer} onClose={() => setDetailDocDrawer(false)} width={720} destroyOnClose extra={<Space>
        {selectedDoc && <Button icon={<EditOutlined />} onClick={() => { setDetailDocDrawer(false); openDocEdit(selectedDoc); }}>编辑</Button>}
        {selectedDoc && <Button icon={<PlusOutlined />} onClick={() => { newVersionForm.resetFields(); setNewVersionModal(true); }}>新建版本</Button>}
      </Space>}>
        {selectedDoc && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="标题" span={2}>{selectedDoc.title}</Descriptions.Item>
              <Descriptions.Item label="URL 别名" span={2}><Text code>{selectedDoc.slug}</Text></Descriptions.Item>
              <Descriptions.Item label="文档类型"><Tag color={documentTypeConfig[selectedDoc.documentType]?.color}>{documentTypeConfig[selectedDoc.documentType]?.label || selectedDoc.documentType}</Tag></Descriptions.Item>
              <Descriptions.Item label="状态">{selectedDoc.published ? <Tag color="green">已发布</Tag> : <Tag>草稿</Tag>}</Descriptions.Item>
              <Descriptions.Item label="分类">{selectedDoc.category || '未分类'}</Descriptions.Item>
              <Descriptions.Item label="版本">{selectedDoc.version || '-'}</Descriptions.Item>
              <Descriptions.Item label="标签" span={2}><Space wrap>{(selectedDoc.tags || []).map((t, i) => <Tag key={i}>{t}</Tag>)}</Space></Descriptions.Item>
              <Descriptions.Item label="浏览">{selectedDoc.viewCount || 0}</Descriptions.Item>
              <Descriptions.Item label="点赞"><StarOutlined style={{ color: colors.warning[500], marginRight: 4 }} />{selectedDoc.helpfulCount || 0}</Descriptions.Item>
              <Descriptions.Item label="作者">{selectedDoc.authorId}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{new Date(selectedDoc.createdAt).toLocaleString()}</Descriptions.Item>
            </Descriptions>
            <Card size="small" title="内容预览"><Paragraph>{selectedDoc.content?.substring(0, 500) || '无内容'}{(selectedDoc.content?.length || 0) > 500 && '...'}</Paragraph></Card>
            {docVersions.length > 1 && (
              <Card size="small" title={`版本历史 (${docVersions.length})`}>
                <Table dataSource={docVersions} rowKey="id" size="small" pagination={false} columns={[
                  { title: '版本', dataIndex: 'version', key: 'version', width: 100 },
                  { title: '状态', dataIndex: 'published', key: 'published', width: 100, render: (p: boolean) => p ? <Tag color="green">已发布</Tag> : <Tag>草稿</Tag> },
                  { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', render: (t: string) => new Date(t).toLocaleString() },
                ]} />
              </Card>
            )}
          </Space>
        )}
      </Drawer>

      {/* New Version Modal */}
      <Modal title="创建新版本" open={newVersionModal} onCancel={() => setNewVersionModal(false)} onOk={() => newVersionForm.submit()} confirmLoading={loading} destroyOnClose>
        <Form form={newVersionForm} layout="vertical" onFinish={handleCreateVersion}>
          <Form.Item name="version" label="新版本号" rules={[{ required: true, message: '请输入版本号' }]}><Input placeholder="如: 2.0.0" /></Form.Item>
        </Form>
      </Modal>

      {/* Create Mock Rule Modal */}
      <Modal title={<><ExperimentOutlined style={{ marginRight: 8 }} />添加 Mock 规则</>} open={createMockModal} onCancel={() => setCreateMockModal(false)} onOk={() => createMockForm.submit()} confirmLoading={loading} width={720} destroyOnClose>
        <Form form={createMockForm} layout="vertical" onFinish={handleCreateMock}>
          <Form.Item name="name" label="规则名称" rules={[{ required: true }]}><Input placeholder="如: 用户列表 Mock" /></Form.Item>
          <Form.Item name="description" label="描述"><Input placeholder="规则描述" /></Form.Item>
          <Row gutter={16}>
            <Col span={6}><Form.Item name="method" label="HTTP 方法" rules={[{ required: true }]}><Select options={httpMethods.map((m) => ({ value: m, label: m }))} /></Form.Item></Col>
            <Col span={12}><Form.Item name="path" label="路径" rules={[{ required: true }]}><Input placeholder="/api/v1/users" /></Form.Item></Col>
            <Col span={6}><Form.Item name="matchType" label="匹配类型" initialValue="exact"><Select options={[{ value: 'exact', label: '精确' }, { value: 'prefix', label: '前缀' }, { value: 'regex', label: '正则' }]} /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="statusCode" label="状态码" initialValue={200}><InputNumber min={100} max={599} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="delay" label="延迟 (ms)" initialValue={0}><InputNumber min={0} max={30000} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="priority" label="优先级" initialValue={0}><InputNumber min={0} max={100} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Form.Item name="body" label="响应 Body (JSON)"><TextArea rows={4} placeholder='{"data": []}' /></Form.Item>
        </Form>
      </Modal>

      {/* Edit Mock Rule Modal */}
      <Modal title={<><EditOutlined style={{ marginRight: 8 }} />编辑 Mock 规则</>} open={editMockModal} onCancel={() => setEditMockModal(false)} onOk={() => editMockForm.submit()} confirmLoading={loading} width={720} destroyOnClose>
        <Form form={editMockForm} layout="vertical" onFinish={handleEditMock}>
          <Form.Item name="name" label="规则名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="描述"><Input /></Form.Item>
          <Row gutter={16}>
            <Col span={6}><Form.Item name="method" label="HTTP 方法" rules={[{ required: true }]}><Select options={httpMethods.map((m) => ({ value: m, label: m }))} /></Form.Item></Col>
            <Col span={12}><Form.Item name="path" label="路径" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={6}><Form.Item name="matchType" label="匹配类型"><Select options={[{ value: 'exact', label: '精确' }, { value: 'prefix', label: '前缀' }, { value: 'regex', label: '正则' }]} /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="statusCode" label="状态码"><InputNumber min={100} max={599} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="delay" label="延迟 (ms)"><InputNumber min={0} max={30000} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="priority" label="优先级"><InputNumber min={0} max={100} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Form.Item name="body" label="响应 Body (JSON)"><TextArea rows={4} /></Form.Item>
        </Form>
      </Modal>

      {/* Create SDK Task Modal */}
      <Modal title={<><CodeOutlined style={{ marginRight: 8 }} />生成 SDK</>} open={createSdkModal} onCancel={() => setCreateSdkModal(false)} onOk={() => createSdkForm.submit()} confirmLoading={loading} width={720} destroyOnClose>
        <Form form={createSdkForm} layout="vertical" onFinish={handleCreateSdk}>
          <Form.Item name="name" label="任务名称" rules={[{ required: true }]}><Input placeholder="如: Orion Pipeline SDK" /></Form.Item>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="language" label="目标语言" rules={[{ required: true }]}><Select options={languageOptions} /></Form.Item></Col>
            <Col span={8}><Form.Item name="packageName" label="包名" rules={[{ required: true }]}><Input placeholder="orion-pipeline-sdk" /></Form.Item></Col>
            <Col span={8}><Form.Item name="version" label="版本" initialValue="1.0.0"><Input /></Form.Item></Col>
          </Row>
          <Form.Item name="apiSpec" label="API 规范 (OpenAPI/Swagger JSON 或 YAML)" rules={[{ required: true }]}><TextArea rows={6} placeholder='{"openapi": "3.0.0", ...}' /></Form.Item>
        </Form>
      </Modal>

      {/* SDK Detail Drawer */}
      <Drawer title={`SDK 代码 - ${selectedSdk?.name || ''}`} open={sdkDetailDrawer} onClose={() => setSdkDetailDrawer(false)} width={800} destroyOnClose extra={selectedSdk?.output && <Button icon={<CopyOutlined />} onClick={() => handleCopyToClipboard(selectedSdk.output)}>复制代码</Button>}>
        {selectedSdk && (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="语言"><Tag color="blue">{selectedSdk.language}</Tag></Descriptions.Item>
              <Descriptions.Item label="包名"><Text code>{selectedSdk.packageName}</Text></Descriptions.Item>
              <Descriptions.Item label="版本">{selectedSdk.version}</Descriptions.Item>
              <Descriptions.Item label="状态"><Tag color={sdkStatusMap[selectedSdk.status]?.color}>{sdkStatusMap[selectedSdk.status]?.label}</Tag></Descriptions.Item>
            </Descriptions>
            {selectedSdk.status === 'completed' && selectedSdk.output ? (
              <Card size="small" title="生成的代码">
                <pre style={{ background: colors.light.bg.tertiary, padding: 16, borderRadius: 8, maxHeight: 500, overflow: 'auto', fontSize: 12, lineHeight: 1.5 }}>
                  {selectedSdk.output}
                </pre>
              </Card>
            ) : selectedSdk.status === 'failed' ? (
              <Card size="small" title="错误信息"><Text type="danger">{selectedSdk.error}</Text></Card>
            ) : (
              <Card size="small"><Spin tip="生成中..." /></Card>
            )}
          </Space>
        )}
      </Drawer>

      {/* Create Subscription Modal */}
      <Modal title={<><KeyOutlined style={{ marginRight: 8 }} />申请 API 订阅</>} open={createSubModal} onCancel={() => setCreateSubModal(false)} onOk={() => createSubForm.submit()} confirmLoading={loading} width={600} destroyOnClose>
        <Form form={createSubForm} layout="vertical" onFinish={handleCreateSub}>
          <Form.Item name="apiName" label="API 名称" rules={[{ required: true }]}><Input placeholder="如: Pipeline API" /></Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="planName" label="套餐" initialValue="standard"><Select options={[{ value: 'free', label: '免费版' }, { value: 'standard', label: '标准版' }, { value: 'premium', label: '高级版' }]} /></Form.Item></Col>
            <Col span={6}><Form.Item name="quotaPerDay" label="日配额" initialValue={1000}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={6}><Form.Item name="quotaPerMonth" label="月配额" initialValue={30000}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Form.Item name="reason" label="申请理由"><TextArea rows={3} placeholder="请说明使用场景和目的" /></Form.Item>
        </Form>
      </Modal>

      {/* Subscription Detail Drawer */}
      <Drawer title={`订阅详情 - ${selectedSub?.apiName || ''}`} open={subDetailDrawer} onClose={() => setSubDetailDrawer(false)} width={600} destroyOnClose>
        {selectedSub && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="API 名称" span={2}>{selectedSub.apiName}</Descriptions.Item>
              <Descriptions.Item label="套餐">{selectedSub.planName}</Descriptions.Item>
              <Descriptions.Item label="状态"><Tag color={subscriptionStatusMap[selectedSub.status]?.color}>{subscriptionStatusMap[selectedSub.status]?.label}</Tag></Descriptions.Item>
              <Descriptions.Item label="日用量">{selectedSub.usedToday} / {selectedSub.quotaPerDay}</Descriptions.Item>
              <Descriptions.Item label="月用量">{selectedSub.usedThisMonth} / {selectedSub.quotaPerMonth}</Descriptions.Item>
              <Descriptions.Item label="API Key" span={2}>
                <Space><Text code copyable>{selectedSub.apiKey}</Text></Space>
              </Descriptions.Item>
              <Descriptions.Item label="申请人">{selectedSub.userId}</Descriptions.Item>
              <Descriptions.Item label="审批人">{selectedSub.approvedBy || '-'}</Descriptions.Item>
              <Descriptions.Item label="申请理由" span={2}>{selectedSub.reason || '-'}</Descriptions.Item>
              {selectedSub.rejectReason && <Descriptions.Item label="拒绝原因" span={2}><Text type="danger">{selectedSub.rejectReason}</Text></Descriptions.Item>}
              <Descriptions.Item label="到期时间">{selectedSub.expiresAt ? new Date(selectedSub.expiresAt).toLocaleDateString() : '-'}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{new Date(selectedSub.createdAt).toLocaleString()}</Descriptions.Item>
            </Descriptions>

            <Card size="small" title="用量趋势">
              <div style={{ textAlign: 'center', padding: 20 }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <Statistic title="日配额使用率" value={selectedSub.quotaPerDay > 0 ? Math.round((selectedSub.usedToday / selectedSub.quotaPerDay) * 100) : 0} suffix="%" valueStyle={{ color: selectedSub.usedToday / selectedSub.quotaPerDay > 0.8 ? colors.error[500] : colors.success[500] }} />
                  </Col>
                  <Col span={12}>
                    <Statistic title="月配额使用率" value={selectedSub.quotaPerMonth > 0 ? Math.round((selectedSub.usedThisMonth / selectedSub.quotaPerMonth) * 100) : 0} suffix="%" valueStyle={{ color: selectedSub.usedThisMonth / selectedSub.quotaPerMonth > 0.8 ? colors.error[500] : colors.success[500] }} />
                  </Col>
                </Row>
              </div>
            </Card>
          </Space>
        )}
      </Drawer>

      {/* Reject Subscription Modal */}
      <Modal title="拒绝订阅" open={rejectSubModal} onCancel={() => setRejectSubModal(false)} onOk={() => rejectSubForm.submit()} destroyOnClose>
        <Form form={rejectSubForm} layout="vertical" onFinish={handleRejectSub}>
          <Form.Item name="reason" label="拒绝原因" rules={[{ required: true, message: '请输入拒绝原因' }]}><TextArea rows={3} placeholder="请说明拒绝原因" /></Form.Item>
        </Form>
      </Modal>

      {/* Playground History Drawer */}
      <Drawer title="响应历史" open={pgHistoryDrawer} onClose={() => setPgHistoryDrawer(false)} width={500} destroyOnClose>
        <Table dataSource={pgHistory} rowKey="id" size="small" pagination={false} columns={[
          { title: '状态码', dataIndex: 'statusCode', key: 'statusCode', width: 80, render: (c: number) => <Tag color={c < 300 ? 'green' : c < 400 ? 'blue' : 'red'}>{c}</Tag> },
          { title: '延迟', dataIndex: 'latencyMs', key: 'latencyMs', width: 80, render: (ms: number) => `${ms}ms` },
          { title: '时间', dataIndex: 'timestamp', key: 'timestamp', render: (t: string) => new Date(t).toLocaleString() },
        ]} locale={{ emptyText: <Empty description="暂无响应历史" /> }} />
      </Drawer>
    </div>
  );
};

export default DeveloperPortalPage;
