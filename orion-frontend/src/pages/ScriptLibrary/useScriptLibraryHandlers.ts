/**
 * useScriptLibraryHandlers.ts - ScriptLibrary 表单包装器 handlers
 * 抽取自 index.tsx (P2-9 Phase 234)
 *
 * 将 4 个 form.validateFields() 包装器 + 4 个 open modal 包装器 + paramColumns
 * 从 index.tsx 中抽离，让 index.tsx 更聚焦于组合层
 */
import { useMemo } from 'react';
import type { FormInstance } from 'antd';
import { useScriptLibraryState } from './useScriptLibraryState';
import { buildParamColumns } from './columns';

interface Props {
  state: ReturnType<typeof useScriptLibraryState>;
  scriptForm: FormInstance;
  versionForm: FormInstance;
  paramForm: FormInstance;
  executeForm: FormInstance;
}

export function useScriptLibraryHandlers({
  state: s,
  scriptForm,
  versionForm,
  paramForm,
  executeForm,
}: Props) {
  // ==================== Form Wrapper Handlers ====================
  // Modal.onOk 无参数调用；wrapper 负责 validateFields 后委托给 state hook

  const handleSaveScript = async () => {
    try {
      const values = await scriptForm.validateFields();
      await s.handleSaveScript(values);
      scriptForm.resetFields();
    } catch {}
  };

  const handleSaveVersion = async () => {
    try {
      const values = await versionForm.validateFields();
      await s.handleSaveVersion(values);
      versionForm.resetFields();
    } catch {}
  };

  const handleSaveParam = async () => {
    try {
      const values = await paramForm.validateFields();
      await s.handleSaveParam(values);
      paramForm.resetFields();
    } catch {}
  };

  const handleExecute = async () => {
    try {
      const values = await executeForm.validateFields();
      await s.handleExecute(values);
      executeForm.resetFields();
    } catch {}
  };

  // ==================== Form Value Sync Wrappers ====================
  // 编辑脚本/参数时把 record 注入对应表单

  const handleOpenEditScript = (record: Parameters<typeof s.handleEditScript>[0]) => {
    scriptForm.setFieldsValue({
      name: record.name,
      description: record.description,
      scriptType: record.scriptType,
      category: record.category,
      tags: record.tags,
    });
    s.handleEditScript(record);
  };

  const handleOpenEditParam = (param: Parameters<typeof s.handleEditParam>[0]) => {
    paramForm.setFieldsValue({
      paramKey: param.paramKey,
      paramType: param.paramType,
      required: param.required,
      defaultValue: param.defaultValue,
      description: param.description,
    });
    s.handleEditParam(param);
  };

  const handleOpenCreateParam = () => {
    paramForm.resetFields();
    paramForm.setFieldsValue({ paramType: 'string', required: false });
    s.handleAddParam();
  };

  const handleOpenVersion = () => {
    versionForm.resetFields();
    s.handleCreateVersion();
  };

  // ==================== Param Columns for Drawer ====================
  const paramColumns = useMemo(
    () => buildParamColumns({ handleEditParam: handleOpenEditParam, handleDeleteParam: s.handleDeleteParam }),
    [handleOpenEditParam, s.handleDeleteParam]
  );

  return {
    handleSaveScript,
    handleSaveVersion,
    handleSaveParam,
    handleExecute,
    handleOpenEditScript,
    handleOpenEditParam,
    handleOpenCreateParam,
    handleOpenVersion,
    paramColumns,
  };
}
