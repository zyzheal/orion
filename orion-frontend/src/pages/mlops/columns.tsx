/**
 * MLOps Page - Table Column Definitions
 * Handler-dependent columns use the factory function pattern (build*Columns).
 */
import React from 'react';
import { Button, Popconfirm, Space, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  DeleteOutlined,
  FileSearchOutlined,
  PlayCircleOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import type { MLExperiment, MLExperimentRun, MLModel, TrainingJob } from '@/api/mlops';
import {
  experimentStatusColor,
  jobStatusColor,
  modelStatusColor,
} from './config';

// ============================================================================
// Experiments
// ============================================================================

export interface ExperimentColumnsDeps {
  handleViewRuns: (id: string) => void;
  handleEdit: (record: MLExperiment) => void;
  handleStatusChange: (id: string, status: MLExperiment['status']) => void;
  handleDelete: (id: string) => void;
}

export function buildExperimentColumns(deps: ExperimentColumnsDeps): ColumnsType<MLExperiment> {
  const { handleViewRuns, handleEdit, handleStatusChange, handleDelete } = deps;
  return [
    { title: '实验名称', dataIndex: 'name', key: 'name' },
    { title: '项目', dataIndex: 'project', key: 'project', render: (v: string) => v || '-' },
    {
      title: '模型类型',
      dataIndex: 'modelType',
      key: 'modelType',
      render: (v: string) => v || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={experimentStatusColor[s]}>{s}</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: MLExperiment) => (
        <Space>
          <Button
            size="small"
            type="link"
            icon={<FileSearchOutlined />}
            onClick={() => handleViewRuns(record.id)}
          >
            运行记录
          </Button>
          <Button size="small" type="link" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          {record.status === 'draft' && (
            <Button
              size="small"
              type="link"
              onClick={() => handleStatusChange(record.id, 'running')}
            >
              运行
            </Button>
          )}
          {record.status === 'running' && (
            <Button
              size="small"
              type="link"
              onClick={() => handleStatusChange(record.id, 'completed')}
            >
              完成
            </Button>
          )}
          {record.status === 'running' && (
            <Button
              size="small"
              type="link"
              danger
              onClick={() => handleStatusChange(record.id, 'failed')}
            >
              终止
            </Button>
          )}
          <Popconfirm
            title="确定要删除此实验吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button size="small" type="link" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];
}

// ============================================================================
// Experiment Runs (drawer table)
// ============================================================================

export function buildRunsColumns(): ColumnsType<MLExperimentRun> {
  return [
    { title: '迭代', dataIndex: 'iteration', key: 'iteration' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={jobStatusColor[s]}>{s}</Tag>,
    },
    {
      title: '开始时间',
      dataIndex: 'startedAt',
      key: 'startedAt',
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: '完成时间',
      dataIndex: 'completedAt',
      key: 'completedAt',
      render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
    },
  ];
}

// ============================================================================
// Model Registry
// ============================================================================

export interface ModelColumnsDeps {
  handleDeploy: (id: string) => void;
  handleStatusChange: (id: string, status: MLModel['status']) => void;
}

export function buildModelColumns(deps: ModelColumnsDeps): ColumnsType<MLModel> {
  const { handleDeploy, handleStatusChange } = deps;
  return [
    { title: '模型名称', dataIndex: 'name', key: 'name' },
    { title: '版本', dataIndex: 'version', key: 'version', render: (v: number) => `v${v}` },
    {
      title: 'Artifact',
      dataIndex: 'artifactPath',
      key: 'artifactPath',
      render: (v: string) => v || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={modelStatusColor[s]}>{s}</Tag>,
    },
    {
      title: '部署端点',
      dataIndex: 'deployedEndpoint',
      key: 'deployedEndpoint',
      render: (v: string) => v || '-',
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: MLModel) => (
        <Space>
          {record.status === 'draft' && (
            <Button
              size="small"
              type="link"
              onClick={() => handleStatusChange(record.id, 'staging')}
            >
              发布
            </Button>
          )}
          {record.status === 'staging' && (
            <Button
              size="small"
              type="link"
              onClick={() => handleStatusChange(record.id, 'production')}
            >
              上线
            </Button>
          )}
          {record.status === 'production' && (
            <Button
              size="small"
              type="link"
              onClick={() => handleStatusChange(record.id, 'archived')}
            >
              归档
            </Button>
          )}
          {record.status !== 'production' && (
            <Button
              size="small"
              type="link"
              icon={<RocketOutlined />}
              onClick={() => handleDeploy(record.id)}
            >
              部署
            </Button>
          )}
        </Space>
      ),
    },
  ];
}

// ============================================================================
// Training Jobs
// ============================================================================

export interface TrainingJobColumnsDeps {
  handleStatusChange: (id: string, status: TrainingJob['status']) => void;
}

export function buildTrainingJobColumns(
  deps: TrainingJobColumnsDeps,
): ColumnsType<TrainingJob> {
  const { handleStatusChange } = deps;
  return [
    { title: '数据集', dataIndex: 'dataset', key: 'dataset', render: (v: string) => v || '-' },
    {
      title: '实验 ID',
      dataIndex: 'experimentId',
      key: 'experimentId',
      render: (v: string) => v || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={jobStatusColor[s]}>{s}</Tag>,
    },
    {
      title: '开始时间',
      dataIndex: 'startedAt',
      key: 'startedAt',
      render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
    },
    {
      title: '完成时间',
      dataIndex: 'completedAt',
      key: 'completedAt',
      render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: TrainingJob) => (
        <Space>
          {record.status === 'pending' && (
            <Button
              size="small"
              type="link"
              icon={<PlayCircleOutlined />}
              onClick={() => handleStatusChange(record.id, 'running')}
            >
              启动
            </Button>
          )}
          {record.status === 'running' && (
            <Button
              size="small"
              type="link"
              onClick={() => handleStatusChange(record.id, 'completed')}
            >
              完成
            </Button>
          )}
          {record.status === 'running' && (
            <Button
              size="small"
              type="link"
              danger
              onClick={() => handleStatusChange(record.id, 'failed')}
            >
              终止
            </Button>
          )}
        </Space>
      ),
    },
  ];
}
