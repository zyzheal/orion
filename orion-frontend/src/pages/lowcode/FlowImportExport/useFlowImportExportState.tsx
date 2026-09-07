/**
 * FlowImportExport state hook
 * 抽取自 index.tsx (P2-9 Phase 138)
 */
import { useCallback, useEffect, useState } from 'react';
import { message } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { lowcodeApi, type LowcodeFlow } from '@/api/lowcode';
import dayjs from 'dayjs';
import { validateWorkflowJson } from './helpers';
import type { ExportFormat, ImportPreview, ImportResult, ValidateResult } from './types';

export const useFlowImportExportState = () => {
  const [flows, setFlows] = useState<LowcodeFlow[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const [selectedFlow, setSelectedFlow] = useState<LowcodeFlow | null>(null);
  const [exportData, setExportData] = useState<ExportFormat | null>(null);
  const [exportModalVisible, setExportModalVisible] = useState(false);

  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [validateResult, setValidateResult] = useState<ValidateResult | null>(null);
  const [importName, setImportName] = useState('');
  const [importDescription, setImportDescription] = useState('');
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const loadFlows = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    loadFlows();
  }, [loadFlows]);

  const handleExport = useCallback(async (flow: LowcodeFlow) => {
    setExporting(true);
    try {
      const res = await lowcodeApi.exportWorkflow(flow.id);
      const data = res as unknown as ExportFormat;
      setExportData(data);
      setSelectedFlow(flow);
      setExportModalVisible(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '导出失败';
      message.error(msg);
    } finally {
      setExporting(false);
    }
  }, []);

  const closeExportModal = useCallback(() => {
    setExportModalVisible(false);
    setExportData(null);
    setSelectedFlow(null);
  }, []);

  const handleDownloadJson = useCallback(() => {
    if (!exportData) return;
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportData.definition.name || 'workflow'}_v${exportData.definition.version}_${dayjs().format('YYYYMMDD_HHmmss')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    message.success('文件下载已开始');
  }, [exportData]);

  const handleFileChange = useCallback((info: { file: UploadFile; fileList: UploadFile[] }) => {
    const file = info.file;
    if (file.originFileObj) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const json = JSON.parse(content) as ExportFormat & {
            name?: string;
            description?: string;
            version?: string;
            nodes?: unknown[];
            edges?: unknown[];
          };
          setImportPreview({
            name: json.name || json.definition?.name || '未知流程',
            description: json.description || json.definition?.description,
            version: json.version || json.definition?.version || '1.0.0',
            nodeCount: (json.nodes || json.definition?.nodes || []).length,
            edgeCount: (json.edges || json.definition?.edges || []).length,
            exportedAt: json.exportedAt,
            versionHistoryLength: json.versionHistory?.length || 0,
          });
          setImportName(json.name || json.definition?.name || '');
          setImportDescription(json.description || json.definition?.description || '');
          const nodes = json.definition?.nodes || json.nodes || [];
          const edges = json.definition?.edges || json.edges || [];
          const name = json.name || json.definition?.name || '';
          const validation = validateWorkflowJson({ name, nodes, edges, version: json.version });
          setValidateResult(validation);
        } catch {
          setImportPreview(null);
          setValidateResult({
            valid: false,
            errors: ['JSON 解析失败，请检查文件格式'],
            warnings: [],
          });
        }
      };
      reader.readAsText(file.originFileObj);
    }
    setFileList([file]);
  }, []);

  const handleImport = useCallback(async () => {
    if (!importPreview || !fileList[0]?.originFileObj) return;
    setImporting(true);
    try {
      const file = fileList[0].originFileObj;
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => reject(new Error('读取文件失败'));
        reader.readAsText(file);
      });
      const json = JSON.parse(content) as ExportFormat;

      await lowcodeApi.importWorkflow({
        name: importName || json.definition?.name || 'Imported Workflow',
        description: importDescription || json.definition?.description || '',
        currentDefinition: {
          nodes: JSON.stringify(json.definition?.nodes || []),
          edges: JSON.stringify(json.definition?.edges || []),
        },
      });

      message.success(`流程 "${importName}" 导入成功`);
      setImportModalVisible(false);
      setImportResult({ success: true });
      setFileList([]);
      setImportPreview(null);
      setValidateResult(null);
      setImportName('');
      setImportDescription('');
      loadFlows();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '导入失败';
      message.error(msg);
      setImportResult({ success: false, message: msg });
    } finally {
      setImporting(false);
    }
  }, [importPreview, fileList, importName, importDescription, loadFlows]);

  const closeImportModal = useCallback(() => {
    setImportModalVisible(false);
    setImportResult(null);
  }, []);

  const openImportModal = useCallback(() => {
    if (fileList.length === 0) {
      message.warning('请先选择要导入的文件');
      return;
    }
    setImportModalVisible(true);
    setImportResult(null);
  }, [fileList.length]);

  const handleImportDrop = useCallback((_e: React.DragEvent) => {
    // Let antd Dragger handle this
  }, []);

  return {
    flows,
    loading,
    exporting,
    importing,
    selectedFlow,
    setSelectedFlow,
    exportData,
    exportModalVisible,
    closeExportModal,
    fileList,
    importPreview,
    validateResult,
    importName,
    setImportName,
    importDescription,
    setImportDescription,
    importModalVisible,
    importResult,
    loadFlows,
    handleExport,
    handleDownloadJson,
    handleFileChange,
    handleImport,
    closeImportModal,
    openImportModal,
    handleImportDrop,
  };
};

export type FlowImportExportState = ReturnType<typeof useFlowImportExportState>;
