import { useMemo } from 'react';
import type { ColumnsType } from 'antd/es/table';
import { Button, Space, Tag, Tooltip, Progress, Typography } from 'antd';
import type { Deployment } from '@/api/deployments';
import dayjs from 'dayjs';
import {
  envColorMap, envLabelMap, statusColorMap, statusIconMap, statusLabelMap,
  strategyColorMap, strategyLabelMap, progressiveStatusMap,
  DeployWindow, ProgressiveDeployment,
} from './config';
import {
  EyeOutlined, RocketOutlined, StopOutlined, PauseCircleOutlined,
  RiseOutlined, RollbackOutlined,
} from '@ant-design/icons';

const { Text: TypographyText } = Typography;

export function useDeployColumns({
  openDetail,
  handleExecute,
  handleCancel,
  handleRollback,
}: {
  openDetail: (d: Deployment) => void;
  handleExecute: (id: string) => void;
  handleCancel: (id: string) => void;
  handleRollback: (id: string) => void;
}) {
  return useMemo<ColumnsType<Deployment>>(() => [
    {
      title: '应用', dataIndex: 'appName', key: 'appName', width: 160,
      sorter: (a, b) => a.appName.localeCompare(b.appName),
      render: (v: string, record) => (
        <Space direction="vertical" size={0}>
          <TypographyText strong style={{ cursor: 'pointer' }} onClick={() => openDetail(record)}>{v}</TypographyText>
          <TypographyText type="secondary" style={{ fontSize: 12 }}>v{record.version}</TypographyText>
        </Space>
      ),
    },
    {
      title: '环境', dataIndex: 'environment', key: 'environment', width: 80,
      render: (v: string) => <Tag color={envColorMap[v] || 'default'}>{envLabelMap[v] || v}</Tag>,
    },
    {
      title: '策略', dataIndex: 'strategy', key: 'strategy', width: 120,
      render: (v: string) => <Tag color={strategyColorMap[v] || 'default'}>{strategyLabelMap[v] || v}</Tag>,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 120,
      render: (v: string) => <Tag color={statusColorMap[v] || 'default'} icon={statusIconMap[v]}>{statusLabelMap[v] || v}</Tag>,
    },
    {
      title: '触发人', dataIndex: 'triggeredBy', key: 'triggeredBy', width: 120,
      render: (v: string) => <TypographyText type="secondary">{v || '-'}</TypographyText>,
    },
    {
      title: 'Commit', dataIndex: 'commit', key: 'commit', width: 100,
      render: (v: string) => <TypographyText type="secondary" style={{ fontSize: 12, fontFamily: 'monospace' }}>{v ? v.slice(0, 7) : '-'}</TypographyText>,
    },
    {
      title: '耗时', key: 'duration', width: 100,
      render: (_, record) => {
        if (record.duration) {
          const mins = Math.floor(record.duration / 60);
          const secs = record.duration % 60;
          return <TypographyText>{mins > 0 ? `${mins}m ${secs}s` : `${secs}s`}</TypographyText>;
        }
        if (record.startTime && record.endTime) {
          const diff = dayjs(record.endTime).diff(dayjs(record.startTime), 'second');
          const mins = Math.floor(diff / 60);
          const secs = diff % 60;
          return <TypographyText>{mins > 0 ? `${mins}m ${secs}s` : `${secs}s`}</TypographyText>;
        }
        return <TypographyText type="secondary">-</TypographyText>;
      },
    },
    {
      title: '开始时间', dataIndex: 'startTime', key: 'startTime', width: 160,
      render: (v: string) => <TypographyText type="secondary" style={{ fontSize: 12 }}>{v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'}</TypographyText>,
    },
    {
      title: '操作', key: 'actions', width: 240,
      render: (_, record) => (
        <Space size="small" wrap>
          <Tooltip title="详情"><Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)}>详情</Button></Tooltip>
          {record.status === 'pending' && <Tooltip title="启动部署"><Button type="link" size="small" icon={<RocketOutlined />} onClick={() => handleExecute(record.id)}>启动</Button></Tooltip>}
          {record.status === 'deploying' && <Tooltip title="取消部署"><Button type="link" size="small" danger icon={<StopOutlined />} onClick={() => handleCancel(record.id)}>取消</Button></Tooltip>}
          {record.status === 'success' && <Tooltip title="回滚"><Button type="link" size="small" icon={<PauseCircleOutlined />} onClick={() => handleRollback(record.id)}>回滚</Button></Tooltip>}
        </Space>
      ),
    },
  ], [openDetail, handleExecute, handleCancel, handleRollback]);
}

export function useProgressiveColumns({
  openProgressiveDetail,
  handleAdvanceStage,
  handleRollbackProgressive,
}: {
  openProgressiveDetail: (d: ProgressiveDeployment) => void;
  handleAdvanceStage: (id: string) => void;
  handleRollbackProgressive: (id: string) => void;
}) {
  return useMemo<ColumnsType<ProgressiveDeployment>>(() => [
    {
      title: 'ID', dataIndex: 'id', key: 'id', width: 100,
      render: (v: string) => <TypographyText style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</TypographyText>,
    },
    {
      title: '应用', dataIndex: 'appName', key: 'appName', width: 140,
      render: (v: string, record) => (
        <Space direction="vertical" size={0}>
          <TypographyText strong style={{ cursor: 'pointer' }} onClick={() => openProgressiveDetail(record)}>{v}</TypographyText>
          <TypographyText type="secondary" style={{ fontSize: 12 }}>v{record.version}</TypographyText>
        </Space>
      ),
    },
    {
      title: '环境', dataIndex: 'environment', key: 'environment', width: 80,
      render: (v: string) => <Tag color={envColorMap[v] || 'default'}>{envLabelMap[v] || v}</Tag>,
    },
    {
      title: '当前阶段', dataIndex: 'currentStage', key: 'currentStage', width: 120,
      render: (_: number, record) => {
        const stage = record.stages[record.currentStage];
        return stage ? (
          <Tag color={stage.status === 'completed' ? 'green' : stage.status === 'running' ? 'blue' : 'default'}>{stage.name}</Tag>
        ) : '-';
      },
    },
    {
      title: '进度', key: 'progress', width: 160,
      render: (_, record) => {
        const completedStages = record.stages.filter((s) => s.status === 'completed').length;
        const percent = Math.round((completedStages / record.stages.length) * 100);
        return <Progress percent={percent} size="small" status={record.status === 'rolled_back' ? 'exception' : record.status === 'completed' ? 'success' : 'active'} />;
      },
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (v: string) => {
        const cfg = progressiveStatusMap[v] || { color: 'default', label: v };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 140,
      render: (v: string) => <TypographyText type="secondary" style={{ fontSize: 12 }}>{v}</TypographyText>,
    },
    {
      title: '操作', key: 'actions', width: 200,
      render: (_, record) => (
        <Space size="small" wrap>
          <Tooltip title="查看详情"><Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openProgressiveDetail(record)}>详情</Button></Tooltip>
          {record.status === 'running' && <Tooltip title="推进到下一阶段"><Button type="link" size="small" icon={<RiseOutlined />} onClick={() => handleAdvanceStage(record.id)}>推进</Button></Tooltip>}
          {record.status === 'running' && <Tooltip title="回滚部署"><Button type="link" size="small" danger icon={<RollbackOutlined />} onClick={() => handleRollbackProgressive(record.id)}>回滚</Button></Tooltip>}
        </Space>
      ),
    },
  ], [openProgressiveDetail, handleAdvanceStage, handleRollbackProgressive]);
}

export function useWindowColumns({
  handleDeleteDeployWindow,
}: {
  handleDeleteDeployWindow: (id: string) => void;
}) {
  return useMemo<ColumnsType<DeployWindow>>(() => [
    {
      title: '名称', dataIndex: 'name', key: 'name', width: 160,
      render: (v: string) => <TypographyText strong>{v}</TypographyText>,
    },
    {
      title: '环境', dataIndex: 'environment', key: 'environment', width: 100,
      render: (v: string) => <Tag color={envColorMap[v] || 'default'}>{envLabelMap[v] || v}</Tag>,
    },
    {
      title: '开始时间', dataIndex: 'startTime', key: 'startTime', width: 160,
      render: (v: string) => <TypographyText style={{ fontSize: 12 }}>{v}</TypographyText>,
    },
    {
      title: '结束时间', dataIndex: 'endTime', key: 'endTime', width: 160,
      render: (v: string) => <TypographyText style={{ fontSize: 12 }}>{v}</TypographyText>,
    },
    {
      title: '循环', dataIndex: 'recurring', key: 'recurring', width: 100,
      render: (v: boolean, record) =>
        v ? <Tag color="green">{record.recurringPattern === 'daily' ? '每日' : record.recurringPattern === 'weekly' ? '每周' : '每月'}</Tag> : <Tag>单次</Tag>,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (v: string) => {
        const cfg = progressiveStatusMap[v] || { color: 'default', label: v };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '描述', dataIndex: 'description', key: 'description', width: 200,
      render: (v: string) => <TypographyText type="secondary" style={{ fontSize: 12 }}>{v || '-'}</TypographyText>,
    },
    {
      title: '操作', key: 'actions', width: 80,
      render: (_, record) => <Button type="link" size="small" danger onClick={() => handleDeleteDeployWindow(record.id)}>删除</Button>,
    },
  ], [handleDeleteDeployWindow]);
}
