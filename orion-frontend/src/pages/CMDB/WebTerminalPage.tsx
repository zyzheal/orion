/**
 * Web SSH Terminal for CMDB
 * 基于 xterm.js 的 Web SSH 终端，连接后端 visor SSH 代理
 *
 * 2026-05-19: 从 orion-visor-ui 终端模块迁移至 CMDB
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import {
  Card,
  Select,
  Button,
  Space,
  Typography,
  message,
  Empty,
  Spin,
  Tag,
  Drawer,
  Descriptions,
} from 'antd';
import {
  CloudServerOutlined,
  FullscreenOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { getHosts, type HostInfo } from '@/api/cmdb';
import { colors } from '@/tokens';

import '@xterm/xterm/css/xterm.css';

const { Text } = Typography;

// ============================================================================
// Terminal Tab Component
// ============================================================================

interface TerminalTabData {
  id: string;
  host: HostInfo;
  title: string;
}

const WebTerminalPage: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const resizeHandlerRef = useRef<(() => void) | null>(null);
  const cleanupTerminalRef = useRef<(() => void) | null>(null);

  const [hosts, setHosts] = useState<HostInfo[]>([]);
  const [selectedHostId, setSelectedHostId] = useState<string>('');
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [activeTabs, setActiveTabs] = useState<TerminalTabData[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [fullscreen, setFullscreen] = useState(false);
  const [hostDetail, setHostDetail] = useState<HostInfo | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);

  // 加载主机列表
  useEffect(() => {
    getHosts({ pageSize: 100 })
      .then((res) => {
        const list = res.data ?? [];
        setHosts(list);
      })
      .catch((err) => {
        message.error(`加载主机列表失败: ${err.message}`);
      });
  }, []);

  // 组件卸载时清理终端和 WebSocket（#3 Critical + #5 Critical）
  useEffect(() => {
    return () => {
      wsRef.current?.close();
      if (cleanupTerminalRef.current) {
        cleanupTerminalRef.current();
        cleanupTerminalRef.current = null;
      }
      termRef.current?.dispose();
      termRef.current = null;
      wsRef.current = null;
    };
  }, []);

  // 清理当前终端资源（供 disconnect/closeTab 复用）
  const cleanupTerminal = useCallback(() => {
    if (cleanupTerminalRef.current) {
      cleanupTerminalRef.current();
      cleanupTerminalRef.current = null;
    }
    termRef.current?.dispose();
    termRef.current = null;
  }, []);

  // 初始化终端
  const initTerminal = useCallback(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, Monaco, 'Courier New', monospace",
      theme: {
        background: colors.neutral[950],
        foreground: colors.neutral[300],
        cursor: colors.neutral[300],
        cursorAccent: colors.neutral[950],
        selectionBackground: 'rgba(255, 255, 255, 0.15)',
        black: colors.neutral[950],
        red: colors.error[400],
        green: '#6a9955',
        yellow: '#d7ba7d',
        blue: '#569cd6',
        magenta: '#c586c0',
        cyan: '#4dc9b0',
        white: colors.neutral[300],
        brightBlack: colors.neutral[500],
        brightRed: colors.error[400],
        brightGreen: '#6a9955',
        brightYellow: '#d7ba7d',
        brightBlue: '#569cd6',
        brightMagenta: '#c586c0',
        brightCyan: '#4dc9b0',
        brightWhite: colors.neutral[0],
      },
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    // 尝试使用 WebGL 渲染
    try {
      term.loadAddon(new WebglAddon());
    } catch {
      // WebGL 不可用，使用 Canvas 回退
    }

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // 窗口大小变化时自适应（#5 Critical: 保存清理函数）
    const handleResize = () => fitAddon.fit();
    resizeHandlerRef.current = handleResize;
    window.addEventListener('resize', handleResize);

    cleanupTerminalRef.current = () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // 连接终端
  const connectTerminal = async () => {
    if (!selectedHostId) {
      message.warning('请先选择主机');
      return;
    }

    const host = hosts.find((h) => h.ci_id === selectedHostId);
    if (!host) {
      message.error('主机不存在');
      return;
    }

    setConnecting(true);

    try {
      // 清理已有终端
      cleanupTerminal();

      // 初始化终端
      initTerminal();
      const term = termRef.current;
      if (!term) return;

      term.writeln(`\x1b[32m正在连接到 ${host.hostname} (${host.ip})...\x1b[0m`);

      // #1 Critical: Token 通过首条消息发送，不放在 URL 中
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}/api/visor/terminal/ws?hostId=${selectedHostId}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // 发送认证消息
        const token = localStorage.getItem('token');
        if (token) {
          ws.send(JSON.stringify({ type: 'auth', token }));
        }

        setConnected(true);
        term.writeln('\x1b[32m连接成功！\x1b[0m\n');

        // 终端输入 -> WebSocket 发送
        term.onData((data) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'data', data }));
          }
        });

        // #2 Critical: 安全解析 WebSocket 消息
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data as string);
            if (msg.type === 'data') {
              term.write(msg.data);
            }
          } catch {
            // 忽略非 JSON 或格式错误的消息
          }
        };

        ws.onclose = () => {
          setConnected(false);
          term.writeln('\n\x1b[31m连接已关闭\x1b[0m');
        };

        // #4 Critical: 统一错误处理器（不重复注册）
        ws.onerror = () => {
          setConnected(false);
          term.writeln('\n\x1b[31m连接错误\x1b[0m');
        };

        // 添加到 Tab
        const tabId = `tab-${Date.now()}`;
        const newTab: TerminalTabData = {
          id: tabId,
          host,
          title: `${host.hostname}`,
        };
        setActiveTabs((prev) => [...prev, newTab]);
        setActiveTabId(tabId);
        setConnecting(false);
      };

      // 连接建立前的错误处理（onopen 之前的 onerror）
      ws.onerror = () => {
        term.writeln('\n\x1b[31mWebSocket 连接失败，请检查后端服务是否启动\x1b[0m');
        setConnecting(false);
        message.error('终端连接失败');
      };
    } catch (err) {
      setConnecting(false);
      message.error(`连接异常: ${(err as Error).message}`);
    }
  };

  // 关闭 Tab
  const closeTab = (tabId: string) => {
    const newTabs = activeTabs.filter((t) => t.id !== tabId);
    setActiveTabs(newTabs);

    // 如果关闭的是当前 Tab，切换到最后一个
    if (activeTabId === tabId) {
      setActiveTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1].id : '');
    }

    if (activeTabs.length === 1) {
      // 最后一个 Tab 关闭，断开 WebSocket 并清理终端
      wsRef.current?.close();
      cleanupTerminal();
      setConnected(false);
    }
  };

  // 切换 Tab
  const switchTab = (tabId: string) => {
    setActiveTabId(tabId);
    // 重新 fit 终端
    setTimeout(() => fitAddonRef.current?.fit(), 100);
  };

  // 全屏切换
  const toggleFullscreen = () => {
    setFullscreen(!fullscreen);
    setTimeout(() => fitAddonRef.current?.fit(), 300);
  };

  // 断开连接
  const disconnect = () => {
    wsRef.current?.close();
    cleanupTerminal();
    setConnected(false);
    setActiveTabs([]);
    setActiveTabId('');
  };

  const handleHostInfo = (hostId: string) => {
    const host = hosts.find((h) => h.ci_id === hostId);
    if (host) {
      setHostDetail(host);
      setDetailDrawerOpen(true);
    }
  };

  return (
    <div>
      {/* Toolbar */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space>
          <Select
            style={{ width: 220 }}
            placeholder="选择主机..."
            value={selectedHostId}
            onChange={setSelectedHostId}
            suffixIcon={<CloudServerOutlined />}
            options={hosts
              .filter((h) => h.status === 'running')
              .map((h) => ({ label: `${h.hostname} (${h.ip})`, value: h.ci_id }))}
          />
          <Button
            type="primary"
            onClick={connectTerminal}
            loading={connecting}
            disabled={!selectedHostId}
          >
            连接
          </Button>
          {connected && (
            <>
              <Button danger onClick={disconnect}>
                断开
              </Button>
              <Button icon={<FullscreenOutlined />} onClick={toggleFullscreen}>
                {fullscreen ? '退出全屏' : '全屏'}
              </Button>
              <Button icon={<InfoCircleOutlined />} onClick={() => handleHostInfo(activeTabs.find(t => t.id === activeTabId)?.host.ci_id || '')}>
                主机信息
              </Button>
            </>
          )}
        </Space>
      </Card>

      {/* Tabs */}
      {activeTabs.length > 0 && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
          {activeTabs.map((tab) => (
            <div
              key={tab.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 12px',
                background: tab.id === activeTabId ? colors.primary[500] : colors.neutral[100],
                color: tab.id === activeTabId ? colors.neutral[0] : colors.neutral[700],
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 13,
              }}
              onClick={() => switchTab(tab.id)}
            >
              <CloudServerOutlined style={{ fontSize: 12 }} />
              <Text style={{ color: tab.id === activeTabId ? colors.neutral[0] : colors.neutral[700] }}>
                {tab.title}
              </Text>
              <span
                style={{ cursor: 'pointer', fontSize: 14, opacity: 0.7 }}
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
              >
                ×
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Terminal */}
      <div
        style={{
          height: fullscreen ? 'calc(100vh - 160px)' : 500,
          borderRadius: 8,
          overflow: 'hidden',
          background: colors.neutral[950],
        }}
      >
        {activeTabs.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <Empty
              description="请选择主机并点击连接"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </div>
        ) : connecting ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <Spin size="large" tip="正在连接..." />
          </div>
        ) : (
          <div ref={terminalRef} style={{ width: '100%', height: '100%' }} />
        )}
      </div>

      {/* 快捷提示 */}
      {activeTabs.length === 0 && (
        <Card size="small" style={{ marginTop: 16 }}>
          <Text type="secondary">提示：</Text>
          <Space direction="vertical" size={4}>
            <Text type="secondary">• 选择目标主机后点击「连接」按钮即可打开 SSH 终端</Text>
            <Text type="secondary">• 支持多 Tab，可同时连接多台主机</Text>
            <Text type="secondary">• 全屏模式下终端自动自适应窗口大小</Text>
          </Space>
        </Card>
      )}

      {/* 主机信息 Drawer */}
      <Drawer
        title="主机信息"
        placement="right"
        width={500}
        open={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
      >
        {hostDetail && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="主机名">{hostDetail.hostname}</Descriptions.Item>
            <Descriptions.Item label="IP">{hostDetail.ip}</Descriptions.Item>
            <Descriptions.Item label="操作系统">{hostDetail.os}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={hostDetail.status === 'running' ? 'green' : 'default'}>{hostDetail.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="CPU">{hostDetail.cpu} Core</Descriptions.Item>
            <Descriptions.Item label="内存">{(hostDetail.memory / 1024).toFixed(1)} GB</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
};

export default WebTerminalPage;
