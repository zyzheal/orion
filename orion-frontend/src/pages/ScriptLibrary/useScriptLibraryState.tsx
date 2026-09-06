/**
 * useScriptLibraryState - Script Library 页面状态 + 加载器 + CRUD/版本/参数/执行/历史处理器
 * 从 index.tsx 抽离，表单 validateFields 由 index.tsx wrapper 负责
 */
import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import {
  listScripts,
  createScript,
  updateScript,
  deleteScript,
  listVersions,
  createVersion,
  rollbackVersion,
  listParameters,
  setParameters,
  executeScript,
  getExecutionHistory,
  type ScriptEntry,
  type ScriptVersion,
  type ScriptParameter,
  type ScriptExecution,
  type CreateScriptInput,
  type CreateVersionInput,
  type CreateParameterInput,
} from '@/api/script-library';

export function useScriptLibraryState() {
  // Script list state
  const [scripts, setScripts] = useState<ScriptEntry[]>([]);
  const [scriptsLoading, setScriptsLoading] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string | undefined>();
  const [filterType, setFilterType] = useState<string | undefined>();

  // Script modal state
  const [scriptModalVisible, setScriptModalVisible] = useState(false);
  const [scriptConfirmLoading, setScriptConfirmLoading] = useState(false);
  const [editingScript, setEditingScript] = useState<ScriptEntry | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedScript, setSelectedScript] = useState<ScriptEntry | null>(null);

  // Version state
  const [versions, setVersions] = useState<ScriptVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionModalVisible, setVersionModalVisible] = useState(false);

  // Parameter state
  const [parameters, setParametersList] = useState<ScriptParameter[]>([]);
  const [paramsLoading, setParamsLoading] = useState(false);
  const [paramModalVisible, setParamModalVisible] = useState(false);
  const [editingParam, setEditingParam] = useState<ScriptParameter | null>(null);

  // Execute state
  const [executeModalVisible, setExecuteModalVisible] = useState(false);
  const [executingScript, setExecutingScript] = useState<ScriptEntry | null>(null);

  // Execution history state
  const [executions, setExecutions] = useState<ScriptExecution[]>([]);
  const [executionsLoading, setExecutionsLoading] = useState(false);
  const [historyScriptId, setHistoryScriptId] = useState<string | undefined>();
  const [execDetailVisible, setExecDetailVisible] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<ScriptExecution | null>(null);

  // Active tab
  const [activeTab, setActiveTab] = useState('scripts');

  // Category options (derived from scripts)
  const categoryOptions = Array.from(
    new Set(scripts.map((s) => s.category).filter(Boolean))
  ) as string[];

  // ==================== Script CRUD ====================

  const fetchScripts = useCallback(async () => {
    setScriptsLoading(true);
    try {
      const res = await listScripts({
        category: filterCategory,
        scriptType: filterType,
      });
      setScripts(res.data ?? []);
    } catch {
      message.error('获取脚本列表失败');
    } finally {
      setScriptsLoading(false);
    }
  }, [filterCategory, filterType]);

  useEffect(() => {
    fetchScripts();
  }, [fetchScripts]);

  const handleCreateScript = () => {
    setEditingScript(null);
    setScriptModalVisible(true);
  };

  const handleEditScript = (record: ScriptEntry) => {
    setEditingScript(record);
    setScriptModalVisible(true);
  };

  const handleSaveScript = async (values: any) => {
    setScriptConfirmLoading(true);
    try {
      const input: CreateScriptInput = {
        name: values.name,
        description: values.description,
        scriptType: values.scriptType,
        category: values.category,
        tags: values.tags ?? [],
      };
      if (editingScript) {
        await updateScript(editingScript.id, input);
        message.success('脚本更新成功');
      } else {
        await createScript(input);
        message.success('脚本创建成功');
      }
      setScriptModalVisible(false);
      fetchScripts();
    } catch {
      message.error('保存失败');
    } finally {
      setScriptConfirmLoading(false);
    }
  };

  const handleDeleteScript = async (id: string) => {
    try {
      await deleteScript(id);
      message.success('删除成功');
      fetchScripts();
    } catch {
      message.error('删除失败');
    }
  };

  // ==================== Detail Drawer ====================

  const handleViewDetail = async (record: ScriptEntry) => {
    setSelectedScript(record);
    setDrawerVisible(true);
    await Promise.all([fetchVersions(record.id), fetchParameters(record.id)]);
  };

  // ==================== Version Management ====================

  const fetchVersions = async (scriptId: string) => {
    setVersionsLoading(true);
    try {
      const res = await listVersions(scriptId);
      setVersions(res.data ?? []);
    } catch {
      message.error('加载版本列表失败');
    } finally {
      setVersionsLoading(false);
    }
  };

  const handleCreateVersion = () => {
    setVersionModalVisible(true);
  };

  const handleSaveVersion = async (values: any) => {
    if (!selectedScript) return;
    try {
      const input: CreateVersionInput = {
        content: values.content,
        changelog: values.changelog,
      };
      await createVersion(selectedScript.id, input);
      message.success('版本创建成功');
      setVersionModalVisible(false);
      fetchVersions(selectedScript.id);
    } catch {
      message.error('版本创建失败');
    }
  };

  const handleRollback = async (version: number) => {
    if (!selectedScript) return;
    try {
      await rollbackVersion(selectedScript.id, version);
      message.success(`已回滚到版本 ${version}`);
      fetchVersions(selectedScript.id);
    } catch {
      message.error('回滚失败');
    }
  };

  // ==================== Parameter Management ====================

  const fetchParameters = async (scriptId: string) => {
    setParamsLoading(true);
    try {
      const res = await listParameters(scriptId);
      setParametersList(res.data ?? []);
    } catch {
      message.error('加载参数列表失败');
      setParametersList([]);
    } finally {
      setParamsLoading(false);
    }
  };

  const handleAddParam = () => {
    setEditingParam(null);
    setParamModalVisible(true);
  };

  const handleEditParam = (param: ScriptParameter) => {
    setEditingParam(param);
    setParamModalVisible(true);
  };

  const handleSaveParam = async (values: any) => {
    if (!selectedScript) return;
    try {
      const newParam: CreateParameterInput = {
        paramKey: values.paramKey,
        paramType: values.paramType,
        required: values.required,
        defaultValue: values.defaultValue,
        description: values.description,
      };

      let updatedParams: CreateParameterInput[];
      if (editingParam) {
        updatedParams = parameters.map((p) =>
          p.paramKey === editingParam.paramKey
            ? newParam
            : {
                paramKey: p.paramKey,
                paramType: p.paramType,
                required: p.required,
                defaultValue: p.defaultValue ?? undefined,
                description: p.description ?? undefined,
              }
        );
      } else {
        updatedParams = [
          ...parameters.map((p) => ({
            paramKey: p.paramKey,
            paramType: p.paramType,
            required: p.required,
            defaultValue: p.defaultValue ?? undefined,
            description: p.description ?? undefined,
          })),
          newParam,
        ];
      }

      await setParameters(selectedScript.id, updatedParams);
      message.success(editingParam ? '参数更新成功' : '参数添加成功');
      setParamModalVisible(false);
      fetchParameters(selectedScript.id);
    } catch {
      message.error('保存参数失败');
    }
  };

  const handleDeleteParam = async (paramKey: string) => {
    if (!selectedScript) return;
    try {
      const remaining = parameters
        .filter((p) => p.paramKey !== paramKey)
        .map((p) => ({
          paramKey: p.paramKey,
          paramType: p.paramType,
          required: p.required,
          defaultValue: p.defaultValue ?? undefined,
          description: p.description ?? undefined,
        }));
      await setParameters(selectedScript.id, remaining);
      message.success('参数删除成功');
      fetchParameters(selectedScript.id);
    } catch {
      message.error('删除参数失败');
    }
  };

  // ==================== Execute Script ====================

  const handleOpenExecute = async (record: ScriptEntry) => {
    setExecutingScript(record);
    setExecuteModalVisible(true);
    try {
      const res = await listParameters(record.id);
      const params = res.data ?? [];
      setParametersList(params);
    } catch {
      // ignore
    }
  };

  const handleExecute = async (values: any) => {
    if (!executingScript) return;
    try {
      await executeScript(executingScript.id, {
        params: values.params ?? {},
        targets: values.targets ? { host: values.targets } : undefined,
      });
      message.success('脚本执行已启动');
      setExecuteModalVisible(false);
    } catch {
      message.error('执行失败');
    }
  };

  // ==================== Execution History ====================

  const fetchExecutions = useCallback(async () => {
    setExecutionsLoading(true);
    try {
      if (historyScriptId) {
        const res = await getExecutionHistory(historyScriptId);
        setExecutions(res.data ?? []);
      }
    } catch {
      message.error('获取执行历史失败');
    } finally {
      setExecutionsLoading(false);
    }
  }, [historyScriptId]);

  useEffect(() => {
    if (activeTab === 'history' && historyScriptId) {
      fetchExecutions();
    }
  }, [activeTab, historyScriptId, fetchExecutions]);

  return {
    // State
    scripts, scriptsLoading, filterCategory, setFilterCategory, filterType, setFilterType,
    scriptModalVisible, setScriptModalVisible, scriptConfirmLoading, setScriptConfirmLoading,
    editingScript, setEditingScript, drawerVisible, setDrawerVisible, selectedScript, setSelectedScript,
    versions, setVersions, versionsLoading, setVersionsLoading, versionModalVisible, setVersionModalVisible,
    parameters, setParametersList, paramsLoading, setParamsLoading,
    paramModalVisible, setParamModalVisible, editingParam, setEditingParam,
    executeModalVisible, setExecuteModalVisible, executingScript, setExecutingScript,
    executions, setExecutions, executionsLoading, setExecutionsLoading,
    historyScriptId, setHistoryScriptId, execDetailVisible, setExecDetailVisible,
    selectedExecution, setSelectedExecution, activeTab, setActiveTab,
    categoryOptions,
    // Handlers
    fetchScripts, handleCreateScript, handleEditScript, handleSaveScript, handleDeleteScript,
    handleViewDetail, fetchVersions, handleCreateVersion, handleSaveVersion, handleRollback,
    fetchParameters, handleAddParam, handleEditParam, handleSaveParam, handleDeleteParam,
    handleOpenExecute, handleExecute, fetchExecutions,
  };
}
