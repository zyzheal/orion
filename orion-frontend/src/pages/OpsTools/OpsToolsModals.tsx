/**
 * OpsTools Modals & Drawers
 */
import React from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Button,
  Space,
  Tag,
  InputNumber,
  message,
  Switch,
  Tooltip,
  Cascader,
} from 'antd';
import type {
  CronJob,
  FileInfo,
  ThemeConfig,
  BatchOperation,
  TagentClient,
  TagentStats,
  SystemInfo,
  SqlDumpResult,
  DatabaseFragment,
  IndexInfo,
} from '@/api/ops-tools';
import { THEME_MODE_OPTIONS } from './config';

type FormInstance = ReturnType<typeof Form.useForm>[0];

interface OpsToolsModalsProps {
  loading: boolean;
  setLoading: (v: boolean) => void;
  systemInfo: SystemInfo | null;
  setSystemInfo: (v: SystemInfo | null) => void;
  cronJobs: CronJob[];
  setCronJobs: (v: CronJob[]) => void;
  cronModalOpen: boolean;
  setCronModalOpen: (v: boolean) => void;
  cronEditingJob: CronJob | null;
  setCronEditingJob: (v: CronJob | null) => void;
  cronForm: FormInstance;
  handleCronSave: (values: any) => void;
  handleCronToggle: (job: CronJob) => void;
  handleCronDelete: (job: CronJob) => void;
  handleCronEdit: (job: CronJob) => void;
  dumps: SqlDumpResult[];
  setDumps: (v: SqlDumpResult[]) => void;
  dumpRunning: boolean;
  setDumpRunning: (v: boolean) => void;
  fragments: DatabaseFragment[];
  setFragments: (v: DatabaseFragment[]) => void;
  indexes: IndexInfo[];
  setIndexes: (v: IndexInfo[]) => void;
  indexModalOpen: boolean;
  setIndexModalOpen: (v: boolean) => void;
  indexForm: FormInstance;
  handleSqlDump: () => void;
  handleCreateIndex: (values: any) => void;
  handleDeleteIndex: (idx: IndexInfo) => void;
  tagentClients: TagentClient[];
  setTagentClients: (v: TagentClient[]) => void;
  tagentStats: TagentStats;
  setTagentStats: (v: TagentStats) => void;
  tagentLoading: boolean;
  setTagentLoading: (v: boolean) => void;
  handleTagentUpgrade: (client: TagentClient, version: string) => void;
  batchOps: BatchOperation[];
  setBatchOps: (v: BatchOperation[]) => void;
  batchLoading: boolean;
  setBatchLoading: (v: boolean) => void;
  batchForm: FormInstance;
  batchExecLoading: boolean;
  setBatchExecLoading: (v: boolean) => void;
  handleBatchExecute: (values: any) => void;
  files: FileInfo[];
  setFiles: (v: FileInfo[]) => void;
  fileLoading: boolean;
  setFileLoading: (v: boolean) => void;
  uploadForm: FormInstance;
  uploadModalOpen: boolean;
  setUploadModalOpen: (v: boolean) => void;
  distributeModalOpen: boolean;
  setDistributeModalOpen: (v: boolean) => void;
  distributingFile: string | null;
  setDistributingFile: (v: string | null) => void;
  distributeForm: FormInstance;
  handleUpload: (values: any) => void;
  handleDeleteFile: (file: FileInfo) => void;
  handleDistribute: (values: any) => void;
  themes: ThemeConfig[];
  setThemes: (v: ThemeConfig[]) => void;
  themeForm: FormInstance;
  handleThemeSave: (values: any) => void;
  handleThemeToggle: (theme: ThemeConfig) => void;
  handleDeleteTheme: (theme: ThemeConfig) => void;
  handleModuleToggle: (mod: any) => void;
  activeTab: string;
  setActiveTab: (v: string) => void;
  dbLoading: boolean;
  setDbLoading: (v: boolean) => void;
}

export const OpsToolsModals: React.FC<OpsToolsModalsProps> = (props) => (
  <>
      {/* CronJob 创建/编辑弹窗 */}
      <Modal
        title={props.cronEditingJob ? '编辑定时任务' : '新建定时任务'}
        open={props.cronModalOpen}
        onCancel={() => {
          props.setCronModalOpen(false);
          props.setCronEditingJob(null);
          props.cronForm.resetFields();
        }}
        onOk={() => props.cronForm.submit()}
        confirmLoading={props.loading}
        width={500}
      >
        <Form form={props.cronForm} layout="vertical" onFinish={props.handleCronSave}>
          <Form.Item name="name" label="任务名称" rules={[{ required: true }]}>
            <Input placeholder="例如: 日志清理" />
          </Form.Item>
          <Form.Item name="cronExpression" label="Cron 表达式" rules={[{ required: true }]}>
            <Input placeholder="例如: 0 2 * * *" />
          </Form.Item>
          <Form.Item name="command" label="执行命令" rules={[{ required: true }]}>
            <Input placeholder="例如: scripts/clean-logs.sh" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="任务描述" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 索引创建弹窗 */}
      <Modal
        title="新建索引"
        open={props.indexModalOpen}
        onCancel={() => {
          props.setIndexModalOpen(false);
          props.indexForm.resetFields();
        }}
        onOk={() => props.indexForm.submit()}
        width={480}
      >
        <Form form={props.indexForm} layout="vertical" onFinish={props.handleCreateIndex}>
          <Form.Item name="tableName" label="表名" rules={[{ required: true }]}>
            <Input placeholder="例如: pipelines" />
          </Form.Item>
          <Form.Item name="indexName" label="索引名" rules={[{ required: true }]}>
            <Input placeholder="例如: idx_pipelines_status" />
          </Form.Item>
          <Form.Item name="columns" label="列（逗号分隔）" rules={[{ required: true }]}>
            <Input placeholder="例如: tenant_id,status" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 文件上传弹窗 */}
      <Modal
        title="上传文件"
        open={props.uploadModalOpen}
        onCancel={() => {
          props.setUploadModalOpen(false);
          props.uploadForm.resetFields();
        }}
        onOk={() => props.uploadForm.submit()}
        width={480}
      >
        <Form form={props.uploadForm} layout="vertical" onFinish={props.handleUpload}>
          <Form.Item name="name" label="文件名" rules={[{ required: true }]}>
            <Input placeholder="例如: config.yaml" />
          </Form.Item>
          <Form.Item name="size" label="文件大小 (bytes)" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} placeholder="例如: 1024" />
          </Form.Item>
          <Form.Item name="mime" label="MIME 类型">
            <Input placeholder="例如: application/octet-stream" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 文件分发弹窗 */}
      <Modal
        title="分发文件"
        open={props.distributeModalOpen}
        onCancel={() => {
          props.setDistributeModalOpen(false);
          props.distributeForm.resetFields();
        }}
        onOk={() => props.distributeForm.submit()}
        width={480}
      >
        <Form form={props.distributeForm} layout="vertical" onFinish={props.handleDistribute}>
          <Form.Item name="targetHosts" label="目标主机（逗号分隔）" rules={[{ required: true }]}>
            <Input placeholder="prod-web-01,prod-api-01" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 主题创建弹窗 */}
      <Modal
        title="新建主题"
        open={themeModalOpen}
        onCancel={() => {
          setThemeModalOpen(false);
          props.themeForm.resetFields();
        }}
        onOk={() => props.themeForm.submit()}
        width={480}
      >
        <Form form={props.themeForm} layout="vertical" onFinish={props.handleThemeSave}>
          <Form.Item name="name" label="主题名" rules={[{ required: true }]}>
            <Input placeholder="例如: 深紫主题" />
          </Form.Item>
          <Form.Item name="primaryColor" label="主色" rules={[{ required: true }]}>
            <Input placeholder="#7C5CFC" />
          </Form.Item>
          <Form.Item name="borderRadius" label="圆角 (px)">
            <InputNumber min={0} max={20} style={{ width: '100%' }} defaultValue={6} />
          </Form.Item>
          <Form.Item name="mode" label="模式">
            <Select options={THEME_MODE_OPTIONS} defaultValue="light" />
          </Form.Item>
        </Form>
      </Modal>
  </>
);
