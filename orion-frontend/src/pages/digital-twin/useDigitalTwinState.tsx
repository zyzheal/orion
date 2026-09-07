/**
 * useDigitalTwinState - 数字孪生页面状态 hook
 * 抽取自 index.tsx (P2-9 Phase 116)
 */
import { useState, useEffect, useCallback } from 'react';
import { Form, message } from 'antd';
import { digitalTwinApi, type DigitalTwin, type SandboxEnv, type TrafficRecording, type TrafficReplay, type TwinSnapshot } from '@/api/digital-twin';

export const STATUS_COLORS: Record<string, string> = {
  active: 'green',
  inactive: 'default',
  creating: 'processing',
  stopped: 'default',
  running: 'processing',
  pending: 'orange',
  completed: 'green',
  failed: 'red',
  recording: 'processing',
  ready: 'green',
  restoring: 'warning',
};

export const useDigitalTwinState = () => {
  const [activeTab, setActiveTab] = useState('twins');
  const [loading, setLoading] = useState(false);
  const [twins, setTwins] = useState<DigitalTwin[]>([]);
  const [sandboxes, setSandboxes] = useState<SandboxEnv[]>([]);
  const [snapshots, setSnapshots] = useState<TwinSnapshot[]>([]);
  const [recordings, setRecordings] = useState<TrafficRecording[]>([]);
  const [replays, setReplays] = useState<TrafficReplay[]>([]);
  const [twinModalOpen, setTwinModalOpen] = useState(false);
  const [snapshotModalOpen, setSnapshotModalOpen] = useState(false);
  const [sandboxModalOpen, setSandboxModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTwin, setSelectedTwin] = useState<DigitalTwin | null>(null);
  const [twinForm] = Form.useForm();
  const [snapshotForm] = Form.useForm();
  const [sandboxForm] = Form.useForm();

  const loadTwins = useCallback(async () => {
    setLoading(true);
    try {
      const data = await digitalTwinApi.listTwins();
      const items = Array.isArray(data) ? data : data?.data ?? [];
      setTwins(items);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载数字孪生列表失败');
      setTwins([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSandboxes = useCallback(async () => {
    try {
      const data = await digitalTwinApi.listSnapshots({ environment: 'sandbox' });
      const items = Array.isArray(data) ? data : data?.data ?? [];
      setSandboxes(items as unknown as SandboxEnv[]);
    } catch {
      setSandboxes([]);
    }
  }, []);

  const loadSnapshots = useCallback(async () => {
    try {
      const data = await digitalTwinApi.listSnapshots();
      const items = Array.isArray(data) ? data : data?.data ?? [];
      setSnapshots(items);
    } catch {
      setSnapshots([]);
    }
  }, []);

  const loadRecordings = useCallback(async () => {
    try {
      const data = await digitalTwinApi.listRecordings();
      const items = Array.isArray(data) ? data : data?.data ?? [];
      setRecordings(items);
    } catch {
      setRecordings([]);
    }
  }, []);

  const loadReplays = useCallback(async () => {
    try {
      const data = await digitalTwinApi.listReplays();
      const items = Array.isArray(data) ? data : data?.data ?? [];
      setReplays(items);
    } catch {
      setReplays([]);
    }
  }, []);

  useEffect(() => {
    loadTwins();
  }, [loadTwins]);

  useEffect(() => {
    switch (activeTab) {
      case 'sandboxes': loadSandboxes(); break;
      case 'snapshots': loadSnapshots(); break;
      case 'recordings': loadRecordings(); break;
      case 'replays': loadReplays(); break;
    }
  }, [activeTab, loadSandboxes, loadSnapshots, loadRecordings, loadReplays]);

  const handleCreateTwin = () => {
    twinForm.resetFields();
    setTwinModalOpen(true);
  };

  const handleSubmitTwin = async () => {
    try {
      const values = await twinForm.validateFields();
      setSubmitting(true);
      await digitalTwinApi.registerTwin(values);
      message.success('创建数字孪生成功');
      setTwinModalOpen(false);
      loadTwins();
    } catch (error: unknown) {
      if (error instanceof Error) message.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSnapshot = async () => {
    if (!selectedTwin) return;
    try {
      const values = await snapshotForm.validateFields();
      await digitalTwinApi.createSnapshot(values);
      message.success('创建快照成功');
      setSnapshotModalOpen(false);
      loadSnapshots();
    } catch (error: unknown) {
      if (error instanceof Error) message.error(error.message);
    }
  };

  const handleDeleteSnapshot = async (snapshotId: string) => {
    try {
      await digitalTwinApi.deleteSnapshot(snapshotId);
      message.success('删除快照成功');
      loadSnapshots();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '删除快照失败');
    }
  };

  const handleCreateSandbox = () => {
    sandboxForm.resetFields();
    setSandboxModalOpen(true);
  };

  const handleSubmitSandbox = async () => {
    try {
      const values = await sandboxForm.validateFields();
      await digitalTwinApi.createSandbox(values);
      message.success('创建沙箱成功');
      setSandboxModalOpen(false);
      loadSandboxes();
    } catch (error: unknown) {
      if (error instanceof Error) message.error(error.message);
    }
  };

  const handleViewDetail = async (twin: DigitalTwin) => {
    setSelectedTwin(twin);
  };

  const openSnapshotModal = (record: DigitalTwin) => {
    setSelectedTwin(record);
    setSnapshotModalOpen(true);
    snapshotForm.resetFields();
  };

  return {
    activeTab, setActiveTab,
    loading,
    twins, sandboxes, snapshots, recordings, replays,
    twinModalOpen, setTwinModalOpen,
    snapshotModalOpen, setSnapshotModalOpen,
    sandboxModalOpen, setSandboxModalOpen,
    submitting,
    selectedTwin,
    twinForm, snapshotForm, sandboxForm,
    loadTwins, loadSandboxes, loadSnapshots, loadRecordings, loadReplays,
    handleCreateTwin, handleSubmitTwin,
    handleCreateSnapshot, handleDeleteSnapshot,
    handleCreateSandbox, handleSubmitSandbox,
    handleViewDetail, openSnapshotModal,
  };
};

export type DigitalTwinState = ReturnType<typeof useDigitalTwinState>;
