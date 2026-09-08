/**
 * Artifact Version Browser (GAP-CN-06)
 * Version table with traceability chain, version comparison, and deployment
 *
 * 拆分自 index.tsx (P2-9 Phase 222)
 * - useArtifactBrowserState.ts: state + effects + handlers + pipelineOptions
 * - Components/PageHeader.tsx: 标题 + 刷新按钮
 * - VersionTable.tsx / TraceabilityChainView.tsx / VersionCompareDrawer.tsx / DeployVersionModal.tsx: 保持原状
 * - index.tsx: 组合层
 */
import { Card, Drawer } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useArtifactBrowserState, pipelineOptions } from './useArtifactBrowserState';
import { PageHeader } from './Components/PageHeader';
import VersionTable from './VersionTable';
import TraceabilityChainView from './TraceabilityChainView';
import VersionCompareDrawer from './VersionCompareDrawer';
import DeployVersionModal from './DeployVersionModal';

dayjs.extend(relativeTime);

const ArtifactBrowser = () => {
  const {
    loading,
    versions,
    traceChain,
    traceLoading,
    diff,
    diffLoading,
    currentPage,
    pageSize,
    total,
    traceDrawerVisible,
    compareDrawerVisible,
    deployModalVisible,
    selectedVersion,
    compareVersionA,
    compareVersionB,
    deployVersionItem,
    deployForm,
    deploySubmitting,
    isInitialLoading,
    loadVersions,
    setTraceDrawerVisible,
    setCompareDrawerVisible,
    setDeployModalVisible,
    handleViewTraceability,
    handleCompare,
    handleFilter,
    handleDeploy,
    handleDeploySubmit,
    handlePaginationChange,
  } = useArtifactBrowserState();

  if (isInitialLoading) {
    return (
      <div style={{ padding: 0 }}>
        <Card loading />
      </div>
    );
  }

  return (
    <div style={{ padding: 0 }}>
      <PageHeader loading={loading} onRefresh={loadVersions} />

      <Card>
        <VersionTable
          dataSource={versions}
          loading={loading}
          currentPage={currentPage}
          pageSize={pageSize}
          total={total}
          onViewTraceability={handleViewTraceability}
          onDeploy={handleDeploy}
          onCompare={handleCompare}
          onFilter={handleFilter}
          onPaginationChange={handlePaginationChange}
          pipelineOptions={pipelineOptions}
        />
      </Card>

      {/* Traceability Chain Drawer */}
      <Drawer
        title={
          selectedVersion
            ? `追溯链: ${selectedVersion.artifactName} (${selectedVersion.version})`
            : '追溯链'
        }
        open={traceDrawerVisible}
        onClose={() => setTraceDrawerVisible(false)}
        width={720}
        destroyOnClose
      >
        <TraceabilityChainView chain={traceChain} loading={traceLoading} />
      </Drawer>

      {/* Version Compare Drawer */}
      <VersionCompareDrawer
        open={compareDrawerVisible}
        onClose={() => setCompareDrawerVisible(false)}
        versionA={compareVersionA}
        versionB={compareVersionB}
        diff={diff}
        loading={diffLoading}
      />

      {/* Deploy Version Modal */}
      <DeployVersionModal
        open={deployModalVisible}
        onCancel={() => setDeployModalVisible(false)}
        onOk={handleDeploySubmit}
        version={deployVersionItem}
        submitting={deploySubmitting}
        form={deployForm}
      />
    </div>
  );
};

export default ArtifactBrowser;
