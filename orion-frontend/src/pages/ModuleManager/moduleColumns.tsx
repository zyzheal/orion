/**
 * ModuleManager table columns
 * 抽取自 index.tsx (P2-9 Phase 117)
 */
import { Button, Modal, Space, Switch, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { ModuleDescriptor, ModuleState } from '@/api/module-manager';
import { levelColor, levelLabel, stateColor, stateLabel } from './constants';

const { Text } = Typography;

export interface BuildModuleColumnsDeps {
  toggleLoading: Record<string, boolean>;
  handleToggleModule: (module: ModuleDescriptor, newEnabled: boolean) => void;
}

export const buildModuleColumns = ({
  toggleLoading,
  handleToggleModule,
}: BuildModuleColumnsDeps): ColumnsType<ModuleDescriptor> => [
  {
    title: '模块名称',
    dataIndex: 'name',
    key: 'name',
    width: 180,
    sorter: (a, b) => a.name.localeCompare(b.name),
    render: (text: string, record) => (
      <Space direction="vertical" size={0}>
        <Text strong>{text}</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {record.id}
        </Text>
      </Space>
    ),
  },
  {
    title: '层级',
    dataIndex: 'level',
    key: 'level',
    width: 80,
    filters: [
      { text: '核心', value: 'core' },
      { text: '域', value: 'domain' },
      { text: '服务', value: 'service' },
      { text: '特性', value: 'feature' },
    ],
    onFilter: (value, record) => record.level === value,
    render: (level: string) => (
      <Tag color={levelColor[level]} style={{ margin: 0 }}>
        {levelLabel[level]}
      </Tag>
    ),
  },
  {
    title: '状态',
    dataIndex: 'state',
    key: 'state',
    width: 90,
    filters: Object.entries(stateLabel).map(([value, text]) => ({ text, value })),
    onFilter: (value, record) => record.state === value,
    render: (state: ModuleState) => (
      <Tag color={stateColor[state]} style={{ margin: 0 }}>
        {stateLabel[state]}
      </Tag>
    ),
  },
  {
    title: '描述',
    dataIndex: 'description',
    key: 'description',
    ellipsis: true,
    render: (text: string) => (
      <Tooltip title={text}>
        <Text style={{ fontSize: 13 }}>{text}</Text>
      </Tooltip>
    ),
  },
  {
    title: '依赖数',
    key: 'dependencies',
    width: 80,
    sorter: (a, b) => (a.config.dependencies?.length || 0) - (b.config.dependencies?.length || 0),
    render: (_: unknown, record) => (
      <Text type="secondary">{record.config.dependencies?.length || 0}</Text>
    ),
  },
  {
    title: '路由前缀',
    dataIndex: 'routePrefix',
    key: 'routePrefix',
    width: 120,
    render: (prefix?: string) => (prefix ? <Tag>{prefix}</Tag> : '-'),
  },
  {
    title: '启用',
    key: 'enabled',
    width: 80,
    render: (_: unknown, record) => (
      <Switch
        size="small"
        checked={record.config.enabled}
        loading={toggleLoading[record.id]}
        disabled={record.level === 'core' && record.config.enabled}
        onChange={(checked) => handleToggleModule(record, checked)}
        checkedChildren="开"
        unCheckedChildren="关"
      />
    ),
  },
  {
    title: '操作',
    key: 'actions',
    width: 120,
    render: (_: unknown, record) => (
      <Space size="small">
        <Tooltip title="查看详情">
          <Button
            type="link"
            size="small"
            onClick={() => {
              Modal.info({
                title: `模块详情: ${record.name}`,
                width: 600,
                content: (
                  <div>
                    <p><strong>ID:</strong> {record.id}</p>
                    <p><strong>名称:</strong> {record.name}</p>
                    <p><strong>描述:</strong> {record.description}</p>
                    <p><strong>层级:</strong> {levelLabel[record.level]}</p>
                    <p><strong>状态:</strong> {stateLabel[record.state]}</p>
                    <p><strong>启用:</strong> {record.config.enabled ? '是' : '否'}</p>
                    <p><strong>自动启动:</strong> {record.config.autoStart ? '是' : '否'}</p>
                    <p><strong>优先级:</strong> {record.config.priority ?? '-'}</p>
                    <p><strong>依赖:</strong></p>
                    <ul>
                      {(record.config.dependencies || []).map((dep) => (
                        <li key={dep}><Text code>{dep}</Text></li>
                      ))}
                    </ul>
                    {record.routePrefix && (
                      <p><strong>路由前缀:</strong> {record.routePrefix}</p>
                    )}
                    {record.error && (
                      <p><strong>错误:</strong> <Text type="danger">{record.error}</Text></p>
                    )}
                    {record.domain && (
                      <p><strong>所属域:</strong> {record.domain}</p>
                    )}
                  </div>
                ),
              });
            }}
          >
            详情
          </Button>
        </Tooltip>
        {record.state === 'failed' && record.error && (
          <Tooltip title="查看错误">
            <Button type="link" size="small" danger>
              错误
            </Button>
          </Tooltip>
        )}
      </Space>
    ),
  },
];
