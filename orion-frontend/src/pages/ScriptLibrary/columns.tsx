import {
  Typography, Tag, Space, Button, Popconfirm,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlayCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  RollbackOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type {
  ScriptEntry,
  ScriptVersion,
  ScriptParameter,
  ScriptExecution,
} from '@/api/script-library';
import {
  scriptTypeLabel,
  scriptTypeColor,
  paramTypeLabel,
  statusColor,
  statusLabel,
} from './config';

const { Text } = Typography;

export interface ScriptColumnsDeps {
  handleViewDetail: (record: ScriptEntry) => void;
  handleOpenExecute: (record: ScriptEntry) => void;
  handleEditScript: (record: ScriptEntry) => void;
  handleDeleteScript: (id: string) => void;
}

export function buildScriptColumns(deps: ScriptColumnsDeps): ColumnsType<ScriptEntry> {
  const {
    handleViewDetail,
    handleOpenExecute,
    handleEditScript,
    handleDeleteScript,
  } = deps;
  return [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (_: string, record: ScriptEntry) => (
        <a onClick={() => handleViewDetail(record)}>{_}</a>
      ),
    },
    {
      title: '类型',
      dataIndex: 'scriptType',
      key: 'scriptType',
      render: (type: string) => (
        <Tag color={scriptTypeColor[type]}>{scriptTypeLabel[type] ?? type}</Tag>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (cat: string | null) => (cat ? <Tag>{cat}</Tag> : '-'),
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[]) =>
        tags?.length ? (
          <Space size={4} wrap>
            {tags.map((t) => (
              <Tag key={t} color="default" style={{ borderRadius: 4 }}>
                {t}
              </Tag>
            ))}
          </Space>
        ) : (
          '-'
        ),
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean) => (
        <Tag color={enabled ? 'green' : 'default'}>{enabled ? '启用' : '禁用'}</Tag>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 280,
      render: (_: unknown, record: ScriptEntry) => (
        <Space>
          <Button
            type="link"
            icon={<PlayCircleOutlined />}
            onClick={() => handleOpenExecute(record)}
            disabled={!record.enabled}
          >
            执行
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEditScript(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除此脚本？"
            onConfirm={() => handleDeleteScript(record.id)}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];
}

export interface VersionColumnsDeps {
  handleRollback: (version: number) => void;
}

export function buildVersionColumns(
  deps: VersionColumnsDeps
): ColumnsType<ScriptVersion> {
  const { handleRollback } = deps;
  return [
    {
      title: '版本号',
      dataIndex: 'version',
      key: 'version',
      render: (v: number) => <Tag color="blue">v{v}</Tag>,
    },
    {
      title: '变更说明',
      dataIndex: 'changelog',
      key: 'changelog',
      render: (text: string | null) => text ?? '-',
    },
    {
      title: '校验和',
      dataIndex: 'checksum',
      key: 'checksum',
      render: (text: string) => (
        <Text code style={{ fontSize: 12 }}>{text.substring(0, 12)}...</Text>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: ScriptVersion) => (
        <Popconfirm
          title={`确认回滚到版本 v${record.version}？`}
          onConfirm={() => handleRollback(record.version)}
        >
          <Button type="link" icon={<RollbackOutlined />}>
            回滚
          </Button>
        </Popconfirm>
      ),
    },
  ];
}

export interface ParamColumnsDeps {
  handleEditParam: (param: ScriptParameter) => void;
  handleDeleteParam: (paramKey: string) => void;
}

export function buildParamColumns(
  deps: ParamColumnsDeps
): ColumnsType<ScriptParameter> {
  const { handleEditParam, handleDeleteParam } = deps;
  return [
    {
      title: '参数名',
      dataIndex: 'paramKey',
      key: 'paramKey',
      render: (text: string) => <Text code>{text}</Text>,
    },
    {
      title: '类型',
      dataIndex: 'paramType',
      key: 'paramType',
      render: (type: string) => <Tag>{paramTypeLabel[type] ?? type}</Tag>,
    },
    {
      title: '必填',
      dataIndex: 'required',
      key: 'required',
      render: (required: boolean) => (
        <Tag color={required ? 'red' : 'default'}>{required ? '是' : '否'}</Tag>
      ),
    },
    {
      title: '默认值',
      dataIndex: 'defaultValue',
      key: 'defaultValue',
      render: (val: string | null) => (val ? <Text code>{val}</Text> : '-'),
    },
    {
      title: '说明',
      dataIndex: 'description',
      key: 'description',
      render: (text: string | null) => text ?? '-',
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: ScriptParameter) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEditParam(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除此参数？"
            onConfirm={() => handleDeleteParam(record.paramKey)}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];
}

export interface ExecutionColumnsDeps {
  scripts: ScriptEntry[];
  setSelectedExecution: (execution: ScriptExecution) => void;
  setExecDetailVisible: (visible: boolean) => void;
}

export function buildExecutionColumns(
  deps: ExecutionColumnsDeps
): ColumnsType<ScriptExecution> {
  const { scripts, setSelectedExecution, setExecDetailVisible } = deps;
  return [
    {
      title: '脚本',
      dataIndex: 'scriptId',
      key: 'scriptId',
      render: (id: string) => {
        const script = scripts.find((s) => s.id === id);
        return script?.name ?? id.substring(0, 8);
      },
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      render: (v: number) => <Tag>v{v}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={statusColor[status]}>{statusLabel[status] ?? status}</Tag>
      ),
    },
    {
      title: '耗时',
      dataIndex: 'durationMs',
      key: 'durationMs',
      render: (ms: number | null) => (ms != null ? `${ms}ms` : '-'),
    },
    {
      title: '执行者',
      dataIndex: 'executedBy',
      key: 'executedBy',
      render: (text: string | null) => text ?? '-',
    },
    {
      title: '执行时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: ScriptExecution) => (
        <Button
          type="link"
          icon={<HistoryOutlined />}
          onClick={() => {
            setSelectedExecution(record);
            setExecDetailVisible(true);
          }}
        >
          详情
        </Button>
      ),
    },
  ];
}
