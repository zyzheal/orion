/**
 * FlowImportExport - 低代码流程导入/导出页面
 *
 * 功能：
 * - 导出流程为 JSON 文件（完整版 + 精简版）
 * - 导入 JSON 文件创建新流程
 * - 预览导入内容
 * - 导入前校验
 *
 * 拆分自原单文件 (P2-9 Phase 138)
 */
import React from 'react';
import { Row, Col } from 'antd';
import { spacing } from '@/tokens';
import { useFlowImportExportState } from './useFlowImportExportState';
import { FlowImportExportHeader } from './Components/FlowImportExportHeader';
import { ExportCard } from './Components/ExportCard';
import { ImportCard } from './Components/ImportCard';
import { ExportPreviewModal } from './Components/ExportPreviewModal';
import { ImportConfirmModal } from './Components/ImportConfirmModal';

const FlowImportExportPage: React.FC = () => {
  const state = useFlowImportExportState();

  return (
    <div style={{ padding: spacing.lg }}>
      <FlowImportExportHeader />

      <Row gutter={spacing.md}>
        <Col xs={24} lg={12}>
          <ExportCard
            flows={state.flows}
            loading={state.loading}
            exporting={state.exporting}
            selectedFlow={state.selectedFlow}
            setSelectedFlow={state.setSelectedFlow}
            handleExport={state.handleExport}
            loadFlows={state.loadFlows}
          />
        </Col>

        <Col xs={24} lg={12}>
          <ImportCard
            fileList={state.fileList}
            importPreview={state.importPreview}
            validateResult={state.validateResult}
            handleFileChange={state.handleFileChange}
            handleImportDrop={state.handleImportDrop}
            openImportModal={state.openImportModal}
          />
        </Col>
      </Row>

      <ExportPreviewModal
        open={state.exportModalVisible}
        exportData={state.exportData}
        selectedFlow={state.selectedFlow}
        onClose={state.closeExportModal}
        onDownload={state.handleDownloadJson}
      />

      <ImportConfirmModal
        open={state.importModalVisible}
        importing={state.importing}
        importPreview={state.importPreview}
        importName={state.importName}
        setImportName={state.setImportName}
        importDescription={state.importDescription}
        setImportDescription={state.setImportDescription}
        validateResult={state.validateResult}
        importResult={state.importResult}
        onOk={state.handleImport}
        onCancel={state.closeImportModal}
      />
    </div>
  );
};

export default FlowImportExportPage;
