/**
 * Command Browser - Searchable command catalog with usage examples, parameter docs
 */
import React, { useState, useMemo, useEffect } from 'react';
import { Typography, Button, Space, Tag, Card, Modal, message } from 'antd';
import { colors, spacing } from '@/tokens';
import { ReloadOutlined, InfoCircleOutlined, CodeOutlined } from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import { getCommands, type ChatOpsCommand } from '@/api/chatops';

const { Title, Text } = Typography;

const permissionLevelColorMap: Record<string, string> = {
  admin: 'red',
  maintainer: 'orange',
  developer: 'blue',
  viewer: 'default',
};

const CommandBrowser: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [commands, setCommands] = useState<ChatOpsCommand[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedCommand, setSelectedCommand] = useState<ChatOpsCommand | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getCommands();
      setCommands(Array.isArray(res.data.data) ? res.data.data : []);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`Failed to load commands：${error.message}`);
      } else {
        message.error('Failed to load commands');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredCommands = useMemo(() => {
    return commands.filter((cmd) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !cmd.name.toLowerCase().includes(q) &&
          !cmd.description.toLowerCase().includes(q) &&
          !(cmd.subcommand && cmd.subcommand.toLowerCase().includes(q))
        ) {
          return false;
        }
      }
      if (
        filters.permissionLevel &&
        filters.permissionLevel !== 'all' &&
        cmd.permissionLevel !== filters.permissionLevel
      )
        return false;
      return true;
    });
  }, [searchQuery, filters, commands]);

  const handleViewDetail = (cmd: ChatOpsCommand) => {
    setSelectedCommand(cmd);
    setDetailModalVisible(true);
  };

  const columns: TableColumn<ChatOpsCommand>[] = [
    {
      key: 'name',
      title: '命令',
      dataIndex: 'name',
      width: 200,
      sortable: true,
      render: (v: unknown, record: any) => (
        <Space>
          <Text strong>
            <CodeOutlined /> /{String(v)}
          </Text>
          {record.subcommand && <Tag>{record.subcommand}</Tag>}
        </Space>
      ),
    },
    {
      key: 'permissionLevel',
      title: '权限',
      dataIndex: 'permissionLevel',
      width: 100,
      render: (v: unknown) => (
        <Tag color={permissionLevelColorMap[String(v)] || 'default'}>{String(v)}</Tag>
      ),
    },
    {
      key: 'description',
      title: '描述',
      dataIndex: 'description',
      width: 300,
      render: (v: unknown) => <Text style={{ fontSize: spacing[3] }}>{String(v)}</Text>,
    },
    {
      key: 'examples',
      title: '示例数',
      dataIndex: 'examples',
      width: 80,
      render: (v: unknown) => <Text>{Array.isArray(v) ? v.length : 0}</Text>,
    },
    {
      key: 'actions',
      title: '操作',
      width: 100,
      render: (_: unknown, record: any) => (
        <Button
          type="link"
          size="small"
          icon={<InfoCircleOutlined />}
          onClick={() => handleViewDetail(record)}
        >
          详情
        </Button>
      ),
    },
  ];

  const filterDefs: FilterDefinition[] = [
    {
      key: 'permissionLevel',
      label: '权限',
      options: [
        { label: '全部', value: 'all' },
        { label: 'Admin', value: 'admin' },
        { label: 'Maintainer', value: 'maintainer' },
        { label: 'Developer', value: 'developer' },
        { label: 'Viewer', value: 'viewer' },
      ],
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0 }}>
            命令浏览
          </Title>
          <Text type="secondary">ChatOps 命令目录与使用文档</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
          刷新
        </Button>
      </div>

      <Card>
        <div style={{ marginBottom: 16 }}>
          <SearchFilterBar
            onSearch={setSearchQuery}
            onFilter={setFilters}
            filters={filterDefs}
            searchPlaceholder="搜索命令..."
          />
        </div>
        <Table
          columns={columns}
          dataSource={filteredCommands}
          loading={loading}
          rowKey="id"
          size="middle"
          striped
        />
      </Card>

      {/* Detail Modal */}
      <Modal
        title="命令详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={<Button onClick={() => setDetailModalVisible(false)}>关闭</Button>}
        width={700}
      >
        {selectedCommand && (
          <div>
            <Space style={{ marginBottom: 16 }}>
              <Text strong style={{ fontSize: spacing[4] }}>
                /{selectedCommand.name}
              </Text>
              {selectedCommand.subcommand && <Tag>{selectedCommand.subcommand}</Tag>}
              <Tag color={permissionLevelColorMap[selectedCommand.permissionLevel]}>
                {selectedCommand.permissionLevel}
              </Tag>
            </Space>
            <p>
              <Text strong>描述:</Text> {selectedCommand.description}
            </p>

            {selectedCommand.parameters && Object.keys(selectedCommand.parameters).length > 0 && (
              <>
                <Title level={5}>参数</Title>
                <Table
                  columns={[
                    {
                      key: 'name',
                      title: '参数',
                      dataIndex: 'name',
                      render: (v: unknown) => <Text code>{String(v)}</Text>,
                    },
                    {
                      key: 'type',
                      title: '类型',
                      dataIndex: 'type',
                      render: (v: unknown) => <Tag>{String(v)}</Tag>,
                    },
                    {
                      key: 'required',
                      title: '必填',
                      dataIndex: 'required',
                      render: (v: unknown) => (String(v) ? <Tag color="red">是</Tag> : '否'),
                    },
                    {
                      key: 'description',
                      title: '描述',
                      dataIndex: 'description',
                      render: (v: unknown) => <Text>{String(v)}</Text>,
                    },
                  ]}
                  dataSource={Object.entries(selectedCommand.parameters).map(([name, def]) => ({
                    name,
                    ...def,
                  }))}
                  rowKey="name"
                  size="small"
                  pagination={false as any}
                />
              </>
            )}

            <Title level={5} style={{ marginTop: 16 }}>
              使用示例
            </Title>
            {selectedCommand.examples.map((example, index) => (
              <Card
                key={index}
                size="small"
                style={{ marginBottom: 8, background: colors.neutral[50] }}
              >
                <Text code>{example}</Text>
              </Card>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CommandBrowser;
