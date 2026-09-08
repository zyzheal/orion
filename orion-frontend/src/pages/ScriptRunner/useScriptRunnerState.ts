/**
 * useScriptRunnerState.ts - ScriptRunner 状态管理 Hook
 * 抽取自 index.tsx (P2-9 Phase 230)
 */
import { useState, useCallback } from 'react';
import { Form, message } from 'antd';
import {
  scanScript,
  executeScript,
  type ScriptConfig,
  type ScriptScanResult,
  type ScriptExecutionResult,
} from '@/api/scripts';

export function useScriptRunnerState() {
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScriptScanResult | null>(null);
  const [execResult, setExecResult] = useState<ScriptExecutionResult | null>(null);
  const [form] = Form.useForm<ScriptConfig>();

  const handleScan = useCallback(async () => {
    const values = form.getFieldsValue();
    if (!values.code) {
      message.warning('请先输入脚本代码');
      return;
    }

    setScanning(true);
    try {
      const res = await scanScript(values as ScriptConfig);
      setScanResult(res.data || null);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '扫描失败');
    } finally {
      setScanning(false);
    }
  }, [form]);

  const handleExecute = useCallback(async () => {
    const values = await form.validateFields();
    setLoading(true);
    setExecResult(null);

    try {
      const res = await executeScript(
        `task-${Date.now()}`,
        'manual-run',
        'standalone',
        values as ScriptConfig
      );
      const data = res.data;
      setExecResult(data || null);
      if (data?.success) {
        message.success('执行成功');
      } else {
        message.error('执行失败');
      }
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '执行失败');
    } finally {
      setLoading(false);
    }
  }, [form]);

  return {
    // State
    loading,
    scanning,
    scanResult,
    execResult,
    form,
    // Actions
    handleScan,
    handleExecute,
  };
}
