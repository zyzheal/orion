/**
 * 运维终端 - Web SSH 终端连接页面
 * 功能：终端连接、命令输入/输出、会话管理
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card,
  Row,
  Col,
  Select,
  Button,
  Space,
  Typography,
  Tag,
  Badge,
  Modal,
  message,
  Divider,
  Empty,
  Spin,
  Tooltip,
  Input,
} from 'antd';
import {
  ConsoleSqlOutlined,
  PoweroffOutlined,
  ReloadOutlined,
  CopyOutlined,
  ClearOutlined,
  PlusOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { useNavigate } from 'react-router';
import {
  Host,
  Session,
  getHosts,
  createSession,
  closeSession,
  listSessions,
} from '@/api/ops-service';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// ==================== 类型定义 ====================

interface TerminalOutput {
  id: string;
  type: 'command' | 'output' | 'error' | 'system';
  content: string;
  timestamp: string;
}

// ==================== 组件 ====================

const TerminalPage: React.FC = () => {
  const navigate = useNavigate();

  // 数据状态
  const [hosts, setHosts] = useState<Host[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedHostId, setSelectedHostId] = useState<string>('');
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [sessionType, setSessionType] = useState<'ssh' | 'shell'>('ssh');

  // 终端状态
  const [terminalOutput, setTerminalOutput] = useState<TerminalOutput[]>([]);
  const [commandInput, setCommandInput] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);

  // 加载状态
  const [loading, setLoading] = useState({
    hosts: false,
    sessions: false,
  });

  const outputRef = useRef<HTMLDivElement>(null);

  // ==================== 数据加载 ====================

  const loadHosts = useCallback(async () => {
    setLoading((prev) => ({ ...prev, hosts: true }));
    try {
      const response = await getHosts();
      const hostList = response.data || [];
      setHosts(hostList);
      if (hostList.length > 0 && !selectedHostId) {
        setSelectedHostId(hostList[0].id);
      }
    } catch (err) {
      console.error('加载主机失败:', err);
      setHosts(getMockHosts());
    } finally {
      setLoading((prev) => ({ ...prev, hosts: false }));
    }
  }, [selectedHostId]);

  const loadSessions = useCallback(async () => {
    setLoading((prev) => ({ ...prev, sessions: true }));
    try {
      const response = await listSessions();
      setSessions(response.data || []);
      // 查找活跃会话
      const activeSession = (response.data || []).find((s: Session) => s.status === 'active');
      if (activeSession) {
        setCurrentSession(activeSession);
        setConnected(true);
        addSystemMessage('已恢复之前的会话');
      }
    } catch (err) {
      console.error('加载会话失败:', err);
      setSessions([]);
    } finally {
      setLoading((prev) => ({ ...prev, sessions: false }));
    }
  }, []);

  useEffect(() => {
    loadHosts();
    loadSessions();
  }, [loadHosts, loadSessions]);

  // 自动滚动到输出底部
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [terminalOutput]);

  // ==================== 工具函数 ====================

  const addOutput = (type: TerminalOutput['type'], content: string) => {
    const newOutput: TerminalOutput = {
      id: `${Date.now()}-${Math.random()}`,
      type,
      content,
      timestamp: new Date().toLocaleTimeString('zh-CN'),
    };
    setTerminalOutput((prev) => [...prev, newOutput]);
  };

  const addSystemMessage = (content: string) => {
    addOutput('system', content);
  };

  const addCommandOutput = (content: string, isError = false) => {
    addOutput(isError ? 'error' : 'output', content);
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN');
  };

  // ==================== 事件处理 ====================

  const handleConnect = async () => {
    if (!selectedHostId) {
      message.warning('请选择主机');
      return;
    }

    setConnecting(true);
    addSystemMessage(`正在连接主机...`);

    try {
      const response = await createSession(selectedHostId, sessionType);
      const session = response.data;
      setCurrentSession(session);
      setConnected(true);
      addSystemMessage(`连接成功! 会话 ID: ${session.id}`);

      // 模拟终端输出
      addOutput('output', `${hosts.find(h => h.id === selectedHostId)?.name} ${sessionType.toUpperCase()} 连接已建立`);
      addOutput('output', 'Welcome to Orion Ops Terminal');
      addOutput('output', 'Type "help" for available commands.');

      // 刷新会话列表
      loadSessions();
    } catch (err) {
      console.error('连接失败:', err);
      addOutput('error', `连接失败: ${(err as Error).message}`);
      message.error('连接失败');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!currentSession) return;

    try {
      await closeSession(currentSession.id);
      addSystemMessage('会话已关闭');
      setCurrentSession(null);
      setConnected(false);
      setTerminalOutput([]);
      loadSessions();
      message.success('会话已关闭');
    } catch (err) {
      console.error('关闭会话失败:', err);
      message.error('关闭会话失败');
    }
  };

  const handleExecuteCommand = async () => {
    if (!commandInput.trim()) return;
    if (!connected) {
      message.warning('请先连接主机');
      return;
    }

    const cmd = commandInput.trim();
    addOutput('command', `$ ${cmd}`);
    setCommandInput('');

    // 模拟命令执行结果
    setTimeout(() => {
      if (cmd === 'help') {
        addOutput('output', 'Available commands:');
        addOutput('output', '  help     - Show this help message');
        addOutput('output', '  clear    - Clear terminal');
        addOutput('output', '  date     - Show current date and time');
        addOutput('output', '  whoami   - Show current user');
        addOutput('output', '  pwd      - Print working directory');
        addOutput('output', '  ls       - List directory contents');
        addOutput('output', '  exit     - Close connection');
      } else if (cmd === 'clear') {
        setTerminalOutput([]);
      } else if (cmd === 'date') {
        addOutput('output', new Date().toLocaleString('zh-CN'));
      } else if (cmd === 'whoami') {
        addOutput('output', 'root');
      } else if (cmd === 'pwd') {
        addOutput('output', '/root');
      } else if (cmd === 'ls') {
        addOutput('output', 'bin  boot  dev  etc  home  lib  media  mnt  opt  proc  root  run  sbin  srv  sys  tmp  usr  var');
      } else if (cmd === 'exit') {
        handleDisconnect();
      } else {
        // 模拟命令执行
        addOutput('output', `bash: ${cmd}: command not found`);
      }
    }, 300);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleExecuteCommand();
    }
  };

  const handleClearTerminal = () => {
    setTerminalOutput([]);
    addSystemMessage('终端已清空');
  };

  const handleCopyOutput = () => {
    const text = terminalOutput.map(o => {
      if (o.type === 'command') return o.content;
      if (o.type === 'system') return `[${o.timestamp}] ${o.content}`;
      return o.content;
    }).join('\n');
    navigator.clipboard.writeText(text);
    message.success('已复制到剪贴板');
  };

  const selectedHost = hosts.find(h => h.id === selectedHostId);

  // ==================== 渲染 ====================

  return (
    <div style={{ padding: 0 }}>
      {/* 页面标题 */}
      <div
        style={{
          marginBottom: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <ConsoleSqlOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            Web 终端
          </Title>
          <Paragraph type="secondary">连接主机进行交互式操作</Paragraph>
        </div>
        <Button onClick={() => navigate('/ops-service')}>
          返回运维平台
        </Button>
      </div>

      <Row gutter={[16, 16]}>
        {/* 连接控制面板 */}
        <Col xs={24} lg={6}>
          <Card title="连接控制" style={{ height: '100%' }}>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              {/* 主机选择 */}
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>选择主机</Text>
                <Select
                  style={{ width: '100%' }}
                  placeholder="请选择主机"
                  value={selectedHostId}
                  onChange={setSelectedHostId}
                  loading={loading.hosts}
                  disabled={connected}
                  options={hosts.map(h => ({
                    value: h.id,
                    label: (
                      <Space>
                        <Badge status={h.status === 'online' ? 'success' : 'error'} />
                        <span>{h.name}</span>
                        <Text type="secondary" style={{ fontSize: 12 }}>({h.ip})</Text>
                      </Space>
                    ),
                  }))}
                />
                {selectedHost && (
                  <div style={{ marginTop: 8 }}>
                    <Tag color="blue">{selectedHost.os}</Tag>
                    <Tag>{selectedHost.ip}:{selectedHost.port}</Tag>
                  </div>
                )}
              </div>

              <Divider style={{ margin: '8px 0' }} />

              {/* 连接类型 */}
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>连接类型</Text>
                <Select
                  style={{ width: '100%' }}
                  value={sessionType}
                  onChange={setSessionType}
                  disabled={connected}
                  options={[
                    { value: 'ssh', label: 'SSH (加密)' },
                    { value: 'shell', label: 'Shell (基础)' },
                  ]}
                />
              </div>

              <Divider style={{ margin: '8px 0' }} />

              {/* 连接状态 */}
              <div style={{ textAlign: 'center' }}>
                {connected ? (
                  <>
                    <Badge status="success" text={<Text strong>已连接</Text>} />
                    <div style={{ marginTop: 8 }}>
                      <Tag color="green">会话: {currentSession?.id?.slice(0, 8)}</Tag>
                    </div>
                  </>
                ) : (
                  <>
                    <Badge status="default" text={<Text type="secondary">未连接</Text>} />
                    <div style={{ marginTop: 8 }}>
                      <Text type="secondary">选择主机后点击连接</Text>
                    </div>
                  </>
                )}
              </div>

              {/* 连接/断开按钮 */}
              <Button
                type={connected ? 'default' : 'primary'}
                icon={connecting ? <LoadingOutlined /> : connected ? <PoweroffOutlined /> : <ApiOutlined />}
                danger={connected}
                block
                onClick={connected ? handleDisconnect : handleConnect}
                loading={connecting}
                disabled={!selectedHostId && !connected}
              >
                {connected ? '断开连接' : '连接主机'}
              </Button>

              <Divider style={{ margin: '8px 0' }} />

              {/* 会话列表 */}
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>活跃会话</Text>
                {sessions.length > 0 ? (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {sessions.filter(s => s.status === 'active').map(session => (
                      <Card key={session.id} size="small" style={{ background: colors.neutral[50] }}>
                        <Space>
                          <ConsoleSqlOutlined />
                          <Text code>{session.id.slice(0, 8)}</Text>
                          <Tag color="green">{session.session_type}</Tag>
                        </Space>
                      </Card>
                    ))}
                  </Space>
                ) : (
                  <Empty description="暂无活跃会话" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </div>
            </Space>
          </Card>
        </Col>

        {/* 终端区域 */}
        <Col xs={24} lg={18}>
          <Card
            title={
              <Space>
                <ConsoleSqlOutlined />
                <span>终端</span>
                {connected && <Badge status="success" />}
              </Space>
            }
            extra={
              <Space>
                <Tooltip title="复制输出">
                  <Button
                    type="text"
                    icon={<CopyOutlined />}
                    onClick={handleCopyOutput}
                    disabled={terminalOutput.length === 0}
                  />
                </Tooltip>
                <Tooltip title="清空终端">
                  <Button
                    type="text"
                    icon={<ClearOutlined />}
                    onClick={handleClearTerminal}
                    disabled={terminalOutput.length === 0}
                  />
                </Tooltip>
                <Tooltip title="重新加载">
                  <Button
                    type="text"
                    icon={<ReloadOutlined />}
                    onClick={loadHosts}
                    loading={loading.hosts}
                  />
                </Tooltip>
              </Space>
            }
            style={{ height: 'calc(100vh - 240px)', display: 'flex', flexDirection: 'column' }}
            bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}
          >
            {/* 终端输出区域 */}
            <div
              ref={outputRef}
              style={{
                flex: 1,
                overflow: 'auto',
                padding: spacing[4],
                background: '#1e1e1e',
                fontFamily: 'Monaco, Menlo, Consolas, monospace',
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              {terminalOutput.length === 0 ? (
                <div style={{ color: '#666', textAlign: 'center', marginTop: 100 }}>
                  <ConsoleSqlOutlined style={{ fontSize: 48, marginBottom: 16, display: 'block' }} />
                  <Text type="secondary">连接主机后开始使用终端</Text>
                </div>
              ) : (
                terminalOutput.map((line) => (
                  <div
                    key={line.id}
                    style={{
                      color: line.type === 'command' ? '#fff' :
                             line.type === 'error' ? '#f5222d' :
                             line.type === 'system' ? '#faad14' : '#85d185',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                    }}
                  >
                    {line.type === 'command' && <span style={{ color: '#4ec9b0' }}>{line.content}</span>}
                    {line.type === 'system' && <span style={{ color: '#faad14' }}>[{line.timestamp}] {line.content}</span>}
                    {line.type === 'output' && <span>{line.content}</span>}
                    {line.type === 'error' && <span style={{ color: '#f5222d' }}>{line.content}</span>}
                  </div>
                ))
              )}
            </div>

            {/* 命令输入区域 */}
            <div
              style={{
                borderTop: `1px solid ${colors.neutral[200]}`,
                padding: spacing[3],
                background: '#2d2d2d',
              }}
            >
              <Input.Group compact>
                <Input
                  style={{
                    width: 40,
                    textAlign: 'center',
                    background: 'transparent',
                    border: 'none',
                    color: '#4ec9b0',
                    fontWeight: 'bold',
                  }}
                  value="$"
                  disabled
                />
                <TextArea
                  value={commandInput}
                  onChange={(e) => setCommandInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={connected ? "输入命令后按 Enter 执行" : "请先连接主机"}
                  disabled={!connected}
                  autoFocus
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    color: '#fff',
                    fontFamily: 'Monaco, Menlo, Consolas, monospace',
                    resize: 'none',
                  }}
                  autoSize={{ minRows: 1, maxRows: 3 }}
                />
              </Input.Group>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

// ==================== Mock 数据 ====================

function getMockHosts(): Host[] {
  return [
    {
      id: '1',
      name: 'prod-web-01',
      ip: '192.168.1.10',
      port: 22,
      status: 'online',
      os: 'Ubuntu 22.04',
      tags: ['生产', 'Web'],
      created_at: '2026-01-01',
    },
    {
      id: '2',
      name: 'prod-web-02',
      ip: '192.168.1.11',
      port: 22,
      status: 'online',
      os: 'Ubuntu 22.04',
      tags: ['生产', 'Web'],
      created_at: '2026-01-01',
    },
    {
      id: '3',
      name: 'prod-db-01',
      ip: '192.168.1.20',
      port: 22,
      status: 'online',
      os: 'CentOS 8',
      tags: ['生产', '数据库'],
      created_at: '2026-01-01',
    },
  ];
}

export default TerminalPage;