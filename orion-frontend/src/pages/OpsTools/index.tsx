import React from 'react';
import { Form, Tabs } from 'antd';
import { OpsToolsModals } from './OpsToolsModals';
import { SystemInfoPanel } from './SystemInfoPanel';
import { useOpsToolsData } from './useOpsToolsData';
import { useOpsToolsColumns } from './useOpsToolsColumns';
import { useOpsToolsTabItems } from './useOpsToolsTabItems';
import { PageHeader } from './Components/PageHeader';

const OpsTools: React.FC = () => {
  const d = useOpsToolsData();

  const [cronForm] = Form.useForm();
  const [indexForm] = Form.useForm();
  const [batchForm] = Form.useForm();
  const [uploadForm] = Form.useForm();
  const [distributeForm] = Form.useForm();
  const [themeForm] = Form.useForm();

  const { cronColumns, indexColumns, tagentColumns, fileColumns, themeColumns, moduleColumns } = useOpsToolsColumns(d, cronForm);
  const tabItems = useOpsToolsTabItems({ d, cronForm, indexForm, batchForm, uploadForm, distributeForm, themeForm, cronColumns, indexColumns, tagentColumns, fileColumns, themeColumns, moduleColumns });

  return (
    <div style={{ padding: 0 }}>
      <PageHeader />
      {d.systemInfo && <SystemInfoPanel systemInfo={d.systemInfo} />}
      <Tabs
        activeKey={d.activeTab}
        onChange={d.setActiveTab}
        items={tabItems}
        size="large"
        tabBarStyle={{ marginBottom: 0 }}
      />
      <OpsToolsModals
        loading={d.loading}
        setLoading={d.setLoading}
        systemInfo={d.systemInfo}
        setSystemInfo={d.setSystemInfo}
        cronJobs={d.cronJobs}
        setCronJobs={d.setCronJobs}
        cronModalOpen={d.cronModalOpen}
        setCronModalOpen={d.setCronModalOpen}
        cronEditingJob={d.cronEditingJob}
        setCronEditingJob={d.setCronEditingJob}
        cronForm={cronForm}
        handleCronSave={d.handleCronSave}
        handleCronToggle={d.handleCronToggle}
        handleCronDelete={d.handleCronDelete}
        handleCronEdit={d.handleCronEdit}
        dumps={d.dumps}
        setDumps={d.setDumps}
        dumpRunning={d.dumpRunning}
        setDumpRunning={d.setDumpRunning}
        fragments={d.fragments}
        setFragments={d.setFragments}
        indexes={d.indexes}
        setIndexes={d.setIndexes}
        indexModalOpen={d.indexModalOpen}
        setIndexModalOpen={d.setIndexModalOpen}
        indexForm={indexForm}
        handleSqlDump={d.handleSqlDump}
        handleCreateIndex={d.handleCreateIndex}
        handleDeleteIndex={d.handleDeleteIndex}
        tagentClients={d.tagentClients}
        setTagentClients={d.setTagentClients}
        tagentStats={d.tagentStats}
        setTagentStats={d.setTagentStats}
        tagentLoading={d.tagentLoading}
        setTagentLoading={d.setTagentLoading}
        handleTagentUpgrade={d.handleTagentUpgrade}
        batchOps={d.batchOps}
        setBatchOps={d.setBatchOps}
        batchLoading={d.batchLoading}
        setBatchLoading={d.setBatchLoading}
        batchForm={batchForm}
        batchExecLoading={d.batchExecLoading}
        setBatchExecLoading={d.setBatchExecLoading}
        handleBatchExecute={d.handleBatchExecute}
        files={d.files}
        setFiles={d.setFiles}
        fileLoading={d.fileLoading}
        setFileLoading={d.setFileLoading}
        uploadForm={uploadForm}
        uploadModalOpen={d.uploadModalOpen}
        setUploadModalOpen={d.setUploadModalOpen}
        distributeModalOpen={d.distributeModalOpen}
        setDistributeModalOpen={d.setDistributeModalOpen}
        distributingFile={d.distributingFile}
        setDistributingFile={d.setDistributingFile}
        distributeForm={distributeForm}
        handleUpload={d.handleUpload}
        handleDeleteFile={d.handleDeleteFile}
        handleDistribute={d.handleDistribute}
        themes={d.themes}
        setThemes={d.setThemes}
        themeForm={themeForm}
        themeModalOpen={d.themeModalOpen}
        setThemeModalOpen={d.setThemeModalOpen}
        handleThemeSave={d.handleThemeSave}
        handleThemeToggle={d.handleThemeToggle}
        handleDeleteTheme={d.handleDeleteTheme}
        handleModuleToggle={d.handleModuleToggle}
        activeTab={d.activeTab}
        setActiveTab={d.setActiveTab}
        dbLoading={d.dbLoading}
        setDbLoading={d.setDbLoading}
      />
    </div>
  );
};

export default OpsTools;
