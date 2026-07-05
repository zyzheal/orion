/**
 * FlowImportExport - 低代码流程导入/导出页面
 *
 * 功能：
 * - 导出流程为 JSON 文件（完整版 + 精简版）
 * - 导入 JSON 文件创建新流程
 * - 预览导入内容
 * - 导入前校验
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Button, Space, Tag, message, Modal, Input, Select,
  Empty, Card, Upload, Divider, Statistic, Row, Col, Alert, Descriptions,
} from 'antd';
import { Typography } from 'antd';
import {
  DownloadOutlined, UploadOutlined, FileTextOutlined, InboxOutlined, CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { lowcodeApi, type LowcodeFlow } from '@/api/lowcode';
import type { UploadFile } from 'antd/es/upload/interface';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Option } = Select;
const { Dragger } = Upload;

// ==================== Types ====================

interface ExportFormat {
  schemaVersion: string;
  exportedAt: string;
  type: string;
  definition: {
    name: string;
    description?: string;
    version: string;
    nodes: Array<Record<string, unknown>>;
    edges: Array<Record<string, unknown>>;
    config?: Record<string, unknown>;
  };
  versionHistory: Array<{
    version: string;
    nodes: Array<Record<string, unknown>>;
    edges: Array<Record<string, unknown>>;
    commitMessage?: string;
    createdBy: string;
    createdAt: string;
  }>;
}

interface ImportPreview {
  name: string;
  description?: string;
  version?: string;
  nodeCount: number;
  edgeCount: number;
  exportedAt?: string;
  versionHistoryLength?: number;
}

// ==================== Component ====================

const FlowImportExportPage: React.FC = () => {
  // Flows list
  const [flows, setFlows] = useState<LowcodeFlow[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  // Export
  const [selectedFlow, setSelectedFlow] = useState<LowcodeFlow | null>(null);
  const [exportData, setExportData] = useState<ExportFormat | null>(null);
  const [exportModalVisible, setExportModalVisible] = useState(false);

  // Import
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [validateResult, setValidateResult] = useState<{ valid: boolean; errors: string[]; warnings: string[] } | null>(null);
  const [importName, setImportName] = useState('');
  const [importDescription, setImportDescription] = useState('');
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message?: string } | null>(null);

  // ==================== Load flows ====================

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

  // ==================== Export ====================

  const handleExport = async (flow: LowcodeFlow, fullVersion: boolean = true) => {
    setExporting(true);
    try {
      const res = await lowcodeApi.exportWorkflow(flow.id);
      const data = res.data as unknown as ExportFormat;
      setExportData(data);
      setSelectedFlow(flow);
      setExportModalVisible(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '导出失败';
      message.error(msg);
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadJson = () => {
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
  };

  // ==================== Import ====================

  const handleFileChange = useCallback((info: { file: UploadFile; fileList: UploadFile[] }) => {
    const file = info.file;
    if (file.originFileObj) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const json = JSON.parse(content) as ExportFormat & { name?: string; nodes?: unknown[]; edges?: unknown[] };
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
          // Run validation
          const nodes = json.definition?.nodes || json.nodes || [];
          const edges = json.definition?.edges || json.edges || [];
          const name = json.name || json.definition?.name || '';
          const validation = validateWorkflowJson({ name, nodes, edges, version: json.version });
          setValidateResult(validation);
        } catch {
          setImportPreview(null);
          setValidateResult({ valid: false, errors: ['JSON 解析失败，请检查文件格式'], warnings: [] });
        }
      };
      reader.readAsText(file.originFileObj);
    }
    setFileList([file]);
  }, []);

  const handleImport = async () => {
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
        exportedAt: json.exportedAt || new Date().toISOString(),
        versions: json.versionHistory?.map((v) => ({
          id: v.version,
          workflowId: '',
          version: v.version,
          changeLog: v.commitMessage,
          snapshot: { nodes: v.nodes, edges: v.edges },
          createdBy: v.createdBy,
          createdAt: v.createdAt,
        })) || [],
        currentDefinition: {
          nodes: json.definition?.nodes || [],
          edges: json.definition?.edges || [],
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
  };

  const openImportModal = () => {
    if (fileList.length === 0) {
      message.warning('请先选择要导入的文件');
      return;
    }
    setImportModalVisible(true);
    setImportResult(null);
  };

  const handleImportDrop = (e: React.DragEvent) => {
    // Let antd Dragger handle this
  };

  // ==================== Validation helper ====================

  function validateWorkflowJson(data: {
    name: string;
    nodes: Array<Record<string, unknown>>;
    edges: Array<Record<string, unknown>>;
    version?: string;
  }): { valid: boolean; errors: string[]; warnings: string[] } {
    const result = { valid: true, errors: [] as string[], warnings: [] as string[] } as { valid: boolean; errors: string[]; warnings: string[] };
    if (!data.name || data.name.trim().length === 0) {
      result.valid = false;
      result.errors.push('流程名称不能为空');
    }
    if (!Array.isArray(data.nodes)) {
      result.valid = false;
      result.errors.push('nodes 必须是数组');
    } else if (data.nodes.length === 0) {
      result.warnings.push('nodes 数组为空，流程没有节点');
    }
    if (!Array.isArray(data.edges)) {
      result.valid = false;
      result.errors.push('edges 必须是数组');
    }
    return result;
  }

  // ==================== Render ====================

  return (
    <div style={{ padding: spacing.lg }}>
      <Typography.Title level={2} style={{ marginBottom: spacing.md }}>
        <FileTextOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        流程导入/导出
      </Typography.Title>

      <Row gutter={spacing.md}>
        {/* Export section */}
        <Col xs={24} lg={12}>
          <Card
            title="导出流程"
            style={{ height: '100%' }}
            extra={
              <Button
                icon={<ReloadOutlined />}
                size="small"
                onClick={loadFlows}
              >
                刷新
              </Button>
            }
          >
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
              选择流程并导出为 JSON 文件，可用于备份或迁移
            </Typography.Text>
            <Select
              placeholder="选择要导出的流程"
              style={{ width: '100%', marginBottom: spacing.sm }}
              value={selectedFlow?.id}
              onChange={(id) => {
                const flow = flows.find((f) => f.id === id) || null;
                setSelectedFlow(flow);
              }}
              showSearch
              optionFilterProp="children"
              loading={loading}
            >
              {flows.map((flow) => (
                <Option key={flow.id} value={flow.id}>
                  {flow.name} (v{flow.version})
                </Option>
              ))}
            </Select>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                block
                loading={exporting}
                disabled={!selectedFlow}
                onClick={() => selectedFlow && handleExport(selectedFlow, true)}
              >
                导出完整版（含版本历史）
              </Button>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                完整版包含流程定义 + 完整版本历史记录
              </Typography.Text>
            </Space>
          </Card>
        </Col>

        {/* Import section */}
        <Col xs={24} lg={12}>
          <Card
            title="导入流程"
            style={{ height: '100%' }}
            extra={
              <Button
                size="small"
                type="primary"
                icon={<UploadOutlined />}
                onClick={openImportModal}
                disabled={fileList.length === 0}
              >
                开始导入
              </Button>
            }
          >
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
              选择 JSON 文件导入流程定义
            </Typography.Text>
            <Dragger
              fileList={fileList}
              beforeUpload={() => false}
              onChange={handleFileChange}
              onDrop={handleImportDrop}
              accept=".json"
              maxCount={1}
              showUploadList={{ showRemoveIcon: true }}
              style={{ padding: spacing.sm }}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined style={{ color: colors.primary[500], fontSize: 48 }} />
              </p>
              <p className="ant-upload-text">点击或拖拽 JSON 文件到此处</p>
              <p className="ant-upload-hint">
                支持导出时生成的 JSON 文件格式
              </p>
            </Dragger>

            {/* Import preview */}
            {importPreview && (
              <Card size="small" style={{ marginTop: spacing.sm, background: '#f5f5f7' }}>
                <Statistic
                  title="流程名称"
                  value={importPreview.name}
                  valueStyle={{ fontSize: 14 }}
                />
                <Divider style={{ margin: `${spacing.sm} 0` }} />
                <Row gutter={12}>
                  <Col span={8}>
                    <Statistic title="节点数" value={importPreview.nodeCount} />
                  </Col>
                  <Col span={8}>
                    <Statistic title="连线数" value={importPreview.edgeCount} />
                  </Col>
                  <Col span={8}>
                    <Statistic title="版本历史" value={importPreview.versionHistoryLength || 0} />
                  </Col>
                </Row>
                {importPreview.exportedAt && (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    导出时间: {dayjs(importPreview.exportedAt).format('YYYY-MM-DD HH:mm')}
                  </Typography.Text>
                )}

                {/* Validation result */}
                {validateResult && (
                  <div style={{ marginTop: spacing.sm }}>
                    {validateResult.errors.length > 0 && (
                      <Alert
                        type="error"
                        message={`校验失败: ${validateResult.errors.join(', ')}`}
                        showIcon
                        icon={<CloseCircleOutlined />}
                        style={{ marginBottom: 4 }}
                      />
                    )}
                    {validateResult.warnings.length > 0 && (
                      <Alert
                        type="warning"
                        message={`警告: ${validateResult.warnings.join(', ')}`}
                        showIcon
                      />
                    )}
                    {validateResult.valid && validateResult.errors.length === 0 && (
                      <Alert
                        type="success"
                        message="文件校验通过，可以导入"
                        showIcon
                        icon={<CheckCircleOutlined />}
                      />
                    )}
                  </div>
                )}
              </Card>
            )}
          </Card>
        </Col>
      </Row>

      {/* Export Preview Modal */}
      <Modal
        title={`导出预览: ${exportData?.definition.name}`}
        open={exportModalVisible}
        onCancel={() => { setExportModalVisible(false); setExportData(null); setSelectedFlow(null); }}
        width={700}
        footer={
          <Space>
            <Button onClick={() => { setExportModalVisible(false); setExportData(null); setSelectedFlow(null); }}>
              关闭
            </Button>
            <Button type="primary" icon={<DownloadOutlined />} onClick={handleDownloadJson}>
              下载 JSON 文件
            </Button>
          </Space>
        }
      >
        {exportData && selectedFlow && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="流程名称">{exportData.definition.name}</Descriptions.Item>
            <Descriptions.Item label="描述">{exportData.definition.description || '无'}</Descriptions.Item>
            <Descriptions.Item label="版本">{exportData.definition.version}</Descriptions.Item>
            <Descriptions.Item label="节点数">{exportData.definition.nodes?.length || 0}</Descriptions.Item>
            <Descriptions.Item label="连线数">{exportData.definition.edges?.length || 0}</Descriptions.Item>
            <Descriptions.Item label="导出时间">
              {dayjs(exportData.exportedAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="版本历史记录数">
              {exportData.versionHistory?.length || 0}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* Import Confirm Modal */}
      <Modal
        title="确认导入"
        open={importModalVisible}
        onCancel={() => { setImportModalVisible(false); setImportResult(null); }}
        onOk={handleImport}
        confirmLoading={importing}
        okText={importing ? '导入中...' : '确认导入'}
        cancelText="取消"
      >
        {importPreview && (
          <div>
            <Descriptions bordered column={1} size="small" style={{ marginBottom: spacing.md }}>
              <Descriptions.Item label="流程名称">
                <Input value={importName} onChange={(e) => setImportName(e.target.value)} />
              </Descriptions.Item>
              <Descriptions.Item label="描述">
                <TextArea
                  value={importDescription}
                  onChange={(e) => setImportDescription(e.target.value)}
                  rows={2}
                />
              </Descriptions.Item>
              <Descriptions.Item label="节点数">{importPreview.nodeCount}</Descriptions.Item>
              <Descriptions.Item label="连线数">{importPreview.edgeCount}</Descriptions.Item>
            </Descriptions>

            {validateResult && validateResult.errors.length > 0 && (
              <Alert
                type="error"
                message={`校验错误: ${validateResult.errors.join(', ')}`}
                showIcon
                icon={<CloseCircleOutlined />}
                style={{ marginBottom: spacing.sm }}
              />
            )}
            {validateResult && validateResult.warnings.length > 0 && (
              <Alert
                type="warning"
                message={`警告: ${validateResult.warnings.join(', ')}`}
                showIcon
                style={{ marginBottom: spacing.sm }}
              />
            )}

            {importResult && (
              <Alert
                type={importResult.success ? 'success' : 'error'}
                message={importResult.success ? '导入成功' : `导入失败: ${importResult.message}`}
                showIcon
                icon={importResult.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FlowImportExportPage;
