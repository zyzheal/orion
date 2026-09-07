/**
 * FlowVersions useFlowVersionsState
 * 抽取自 index.tsx (P2-9 Phase 184)
 */
import { useState, useEffect } from 'react';
import { Form, message } from 'antd';
import { lowcodeApi, type LowcodeFlow, type LowcodeFlowVersion } from '@/api/lowcode';

export interface VersionCreateInput {
  changeLog: string;
}

export const useFlowVersionsState = () => {
  const [flows, setFlows] = useState<LowcodeFlow[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<LowcodeFlow | null>(null);
  const [versions, setVersions] = useState<LowcodeFlowVersion[]>([]);
  const [totalVersions, setTotalVersions] = useState(0);
  const [loading, setLoading] = useState(false);
  const [versionLoading, setVersionLoading] = useState(false);

  const [createVisible, setCreateVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<LowcodeFlowVersion | null>(null);

  const [createForm] = Form.useForm();

  const loadFlows = async () => {
    setLoading(true);
    try {
      const result = await lowcodeApi.listFlows();
      setFlows(result.flows || []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '加载流程列表失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFlows();
  }, []);

  const loadVersions = async (flowId: string) => {
    setVersionLoading(true);
    try {
      const res = (await lowcodeApi.listWorkflowVersions(flowId)) as unknown as {
        versions?: LowcodeFlowVersion[];
        total?: number;
      };
      setVersions(res.versions || []);
      setTotalVersions(res.total || 0);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '加载版本历史失败';
      message.error(msg);
    } finally {
      setVersionLoading(false);
    }
  };

  const handleSelectFlow = (flow: LowcodeFlow) => {
    setSelectedFlow(flow);
    loadVersions(flow.id);
  };

  const handleCreateVersion = async (_values: VersionCreateInput) => {
    if (!selectedFlow) return;
    try {
      await lowcodeApi.createWorkflowVersion(selectedFlow.id);
      message.success('版本快照创建成功');
      setCreateVisible(false);
      createForm.resetFields();
      loadVersions(selectedFlow.id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '创建版本失败';
      message.error(msg);
    }
  };

  const handleViewVersion = (version: LowcodeFlowVersion) => {
    setSelectedVersion(version);
    setDetailVisible(true);
  };

  const handleRestoreVersion = async (version: LowcodeFlowVersion) => {
    if (!selectedFlow) return;
    try {
      const nodes = version.snapshot?.nodes || [];
      const edges = version.snapshot?.edges || [];
      await lowcodeApi.updateFlow(selectedFlow.id, {
        nodes: JSON.stringify(nodes),
        edges: JSON.stringify(edges),
      });
      message.success(`已恢复到版本 ${version.version}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '恢复版本失败';
      message.error(msg);
    }
  };

  const closeCreate = () => {
    setCreateVisible(false);
    createForm.resetFields();
  };

  const closeDetail = () => {
    setDetailVisible(false);
    setSelectedVersion(null);
  };

  return {
    // state
    flows,
    selectedFlow,
    setSelectedFlow,
    versions,
    totalVersions,
    loading,
    versionLoading,
    createVisible,
    setCreateVisible,
    detailVisible,
    setDetailVisible,
    selectedVersion,
    setSelectedVersion,
    createForm,
    // handlers
    loadFlows,
    loadVersions,
    handleSelectFlow,
    handleCreateVersion,
    handleViewVersion,
    handleRestoreVersion,
    closeCreate,
    closeDetail,
  };
};
