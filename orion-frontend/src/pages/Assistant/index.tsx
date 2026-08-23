/**
 * Global AI Assistant (Copilot) Page (TR-02)
 *
 * Cross-module intelligent Q&A: 意图识别 → 多源检索（知识库/流水线/告警/工单/变更）→ 综合回答。
 * 后端由 `internal/assistant` 提供 POST /api/v1/assistant/ask。
 */
import { useState } from 'react';
import {
  Button,
  Card,
  Input,
  Space,
  Tag,
  Typography,
  message,
  Spin,
  Empty,
  Divider,
  Select,
  Collapse,
  Form,
} from 'antd';
import {
  SendOutlined,
  RobotOutlined,
  BulbOutlined,
  DatabaseOutlined,
  ClearOutlined,
  ImportOutlined,
  ThunderboltOutlined,
  PlayCircleOutlined,
  CloudServerOutlined,
  FunnelPlotOutlined,
} from '@ant-design/icons';
import {
  assistantAsk,
  assistantAction,
  ingestSource,
  type AssistantResponse,
  type AssistantActionResult,
  type SourceIngestItem,
} from '@/api/assistant';
import { colors, spacing, themeVars } from '@/tokens';

const { Title, Text, Paragraph } = Typography;

// 建议问题模板
const SUGGESTIONS = [
  '为什么服务一直告警 cpu 高',
  '帮我查一下工单处理进度',
  '如何创建知识库文档',
  '流水线构建失败了怎么办',
];

const INTENT_LABEL: Record<string, { label: string; color: string }> = {
  alert: { label: '告警', color: 'red' },
  ticket: { label: '工单', color: 'blue' },
  pipeline: { label: '流水线', color: 'purple' },
  change: { label: '变更', color: 'orange' },
  knowledge: { label: '知识库', color: 'green' },
};

interface ChatItem {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  response?: AssistantResponse;
}

const AssistantPage: React.FC = () => {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(false);

  // --- Action execution state (TR-09 / TR-10 / TR-11) ---
  const [actionLoading, setActionLoading] = useState(false);
  const [actionResult, setActionResult] = useState<AssistantActionResult | null>(null);
  const [actionPrompt, setActionPrompt] = useState('');
  const [actionTitle, setActionTitle] = useState('');

  const handleAction = async (kind: 'trigger_pipeline' | 'suggest_command' | 'generate_flow') => {
    const prompt = actionPrompt.trim();
    if (!prompt) {
      message.warning('请输入操作描述');
      return;
    }
    setActionLoading(true);
    setActionResult(null);
    try {
      const res = await assistantAction({
        prompt,
        kind,
        title: actionTitle.trim() || undefined,
      });
      setActionResult(res.data);
      if (res.data.status === 'executed') {
        message.success(res.data.summary || '操作执行成功');
      } else {
        message.info(res.data.summary || '操作已处理');
      }
    } catch (e: any) {
      message.error(e?.message || '操作执行失败');
    } finally {
      setActionLoading(false);
    }
  };

  const ask = async (q?: string) => {
    const query = (q ?? question).trim();
    if (!query || loading) return;

    const userMsg: ChatItem = { id: Date.now(), role: 'user', content: query };
    setMessages((prev) => [...prev, userMsg]);
    setQuestion('');
    setLoading(true);

    try {
      const res = await assistantAsk({ question: query });
      const data: AssistantResponse = res.data;
      const assistantMsg: ChatItem = {
        id: Date.now() + 1,
        role: 'assistant',
        content: data.answer,
        response: data,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e) {
      message.error('助手暂时无法回答，请稍后重试');
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: 'assistant', content: '抱歉，出错了，请稍后再试。' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => setMessages([]);

  interface SourceSamples {
    label: string;
    source: 'alert' | 'ticket' | 'incident' | 'change';
    items: SourceIngestItem[];
  }

  // 预置的演示数据源样例（对接 TR-04 数据源打通）
  const SOURCE_SAMPLES: SourceSamples[] = [
    {
      label: '告警',
      source: 'alert',
      items: [
        {
          title: '支付服务 CPU 使用率超过阈值',
          content:
            '告警：payment-svc 实例 cpu_usage 达 92%，阈值 80%。状态 firing，来源 Prometheus，所属 cluster prod-ap-southeast。',
          tags: ['payment-svc', 'cpu'],
          status: 'firing',
        },
        {
          title: '订单服务 5xx 错误率上升',
          content: '告警：order-svc 5xx 错误率 5.2%，阈值 2%。状态 firing，来源 Grafana Mimir。',
          tags: ['order-svc', '5xx'],
          status: 'firing',
        },
      ],
    },
    {
      label: '工单',
      source: 'ticket',
      items: [
        {
          title: '用户反馈无法支付',
          content:
            '工单 INC-20260813-001：支付链路超时，用户反馈下单后卡在支付页。优先级 P1，处理人 oncall-payment。',
          tags: ['payment', 'INC-20260813-001'],
          status: 'open',
        },
      ],
    },
    {
      label: '变更',
      source: 'change',
      items: [
        {
          title: '支付网关 v8.2 上线',
          content:
            '变更 chg-1001：支付网关 v8.2 全量发布，涉及路由规则调整，风险等级 medium，回滚方案已配置。',
          tags: ['payment-gateway', 'v8.2'],
          status: 'completed',
        },
      ],
    },
    {
      label: '事件复盘',
      source: 'incident',
      items: [
        {
          title: '支付链路抖动的复盘',
          content:
            '事件 SEV-2：2026-08-13 支付链路抖动 15 分钟，根因为网关路由配置热更新冲击连接池，已回滚并补充监控。',
          tags: ['postmortem', 'payment'],
          status: 'resolved',
        },
      ],
    },
  ];

  const [importSource, setImportSource] = useState<SourceSamples>(SOURCE_SAMPLES[0]);
  const [ingesting, setIngesting] = useState(false);

  const handleIngest = async () => {
    setIngesting(true);
    try {
      const res = await ingestSource({
        source: importSource.source,
        items: importSource.items,
      });
      message.success(
        `已将 ${res.data.indexed} 条${importSource.label}记录导入知识库（${res.data.space_id}）`
      );
    } catch {
      message.error('导入失败，请确认知识库 ingest 服务可用');
    } finally {
      setIngesting(false);
    }
  };

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 8px' }}>
      {/* Header */}
      <div style={{ marginBottom: spacing.lg }}>
        <Title level={2} style={{ marginBottom: 8 }}>
          <RobotOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
          智能助手
        </Title>
        <Text type="secondary">
          跨模块问答：可同时检索知识库、流水线、告警、工单与变更记录，给出综合回答。
        </Text>
      </div>

      {/* Chat area */}
      <div
        style={{
          minHeight: 420,
          border: `1px solid ${colors.neutral[200]}`,
          borderRadius: 12,
          padding: spacing.lg,
          background: themeVars.bgPrimary,
        }}
      >
        {messages.length === 0 ? (
          <Empty
            style={{ marginTop: 80 }}
            description={
              <Space direction="vertical" size={8} style={{ alignItems: 'center' }}>
                <Text>从下面的示例问题开始，或直接描述你的诉求</Text>
                <Space wrap>
                  {SUGGESTIONS.map((s) => (
                    <Button key={s} size="small" onClick={() => ask(s)}>
                      {s}
                    </Button>
                  ))}
                </Space>
              </Space>
            }
          />
        ) : (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    maxWidth: '75%',
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: m.role === 'user' ? colors.primary[500] : themeVars.bgSecondary,
                    color: m.role === 'user' ? colors.neutral[900] : 'inherit',
                  }}
                >
                  {m.role === 'assistant' && m.response && (
                    <div style={{ marginBottom: 6 }}>
                      {m.response.intent && INTENT_LABEL[m.response.intent] && (
                        <Tag
                          color={INTENT_LABEL[m.response.intent].color}
                          style={{ marginRight: 6 }}
                        >
                          {INTENT_LABEL[m.response.intent].label}
                        </Tag>
                      )}
                      {m.response.generated && <Tag color="purple">AI 生成</Tag>}
                    </div>
                  )}
                  <Text
                    style={{
                      color: m.role === 'user' ? colors.neutral[900] : undefined,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {m.content}
                  </Text>

                  {m.role === 'assistant' &&
                    m.response?.sources &&
                    m.response.sources.length > 0 && (
                      <>
                        <Divider style={{ margin: '10px 0' }} />
                        <Text
                          style={{
                            fontSize: 12,
                            color: colors.neutral[500],
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <DatabaseOutlined /> 引用来源（{m.response.sources.length}）
                        </Text>
                        <div style={{ marginTop: 6 }}>
                          {m.response.sources.slice(0, 5).map((s, idx) => (
                            <Tag key={String(idx)} style={{ marginBottom: 4 }}>
                              {s.title}
                            </Tag>
                          ))}
                        </div>
                      </>
                    )}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ textAlign: 'center', padding: 12 }}>
                <Spin size="small" />
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  正在检索多个数据源…
                </Text>
              </div>
            )}
          </Space>
        )}
      </div>

      {/* Input bar */}
      <div style={{ display: 'flex', gap: 8, marginTop: spacing.md }}>
        <Input.TextArea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="输入问题，例如：为什么订单一小时前失败？"
          autoSize={{ minRows: 1, maxRows: 4 }}
          disabled={loading}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              ask();
            }
          }}
        />
        <Space direction="vertical" size={4}>
          <Button
            type="primary"
            icon={<SendOutlined />}
            loading={loading}
            onClick={() => ask()}
            style={{ height: 40 }}
          >
            提问
          </Button>
          <Button
            size="small"
            icon={<ClearOutlined />}
            onClick={clearChat}
            disabled={messages.length === 0}
          >
            清空
          </Button>
        </Space>
      </div>

      <Paragraph type="secondary" style={{ marginTop: spacing.sm, fontSize: 12 }}>
        <BulbOutlined /> 助手回答依赖已接入的数据源；运行结果由后端 assistant
        模块意图路由与检索合成。
      </Paragraph>

      {/* Data source ingestion panel (TR-04) */}
      <div style={{ marginTop: spacing.md }}>
        <Collapse
          ghost
          items={[
            {
              key: 'ingest',
              label: (
                <Text type="secondary" style={{ fontSize: spacing[3] }}>
                  <ImportOutlined /> 数据源接通演示 — 把告警/工单/变更/事件推入知识库，供助手检索
                </Text>
              ),
              children: (
                <Space direction="vertical" style={{ width: '100%' }} size={10}>
                  <Space>
                    <Select
                      value={importSource.source}
                      onChange={(v) =>
                        setImportSource(
                          SOURCE_SAMPLES.find((s) => s.source === v) ?? SOURCE_SAMPLES[0]
                        )
                      }
                      style={{ width: 120 }}
                      options={SOURCE_SAMPLES.map((s) => ({ label: s.label, value: s.source }))}
                    />
                    <Button
                      type="primary"
                      size="small"
                      icon={<ImportOutlined />}
                      loading={ingesting}
                      onClick={handleIngest}
                    >
                      {`导入${importSource.label}样例`}
                    </Button>
                  </Space>
                  <Space wrap>
                    {importSource.items.map((item, idx) => (
                      <Tag key={String(idx)} color="blue">
                        {item.title}
                      </Tag>
                    ))}
                  </Space>
                </Space>
              ),
            },
            {
              key: 'actions',
              label: (
                <Text type="secondary" style={{ fontSize: spacing[3] }}>
                  <ThunderboltOutlined /> 智能操作 — 触发研发流程 Agent / AI 生成流程 / Ops 问答助手
                </Text>
              ),
              children: (
                <Space direction="vertical" style={{ width: '100%' }} size={12}>
                  <Form layout="vertical" size="small">
                    <Form.Item label="操作描述（自然语言）">
                      <Input.TextArea
                        value={actionPrompt}
                        onChange={(e) => setActionPrompt(e.target.value)}
                        placeholder="例如：帮我触发一次支付服务的发布流水线；创建审批流程；建议我执行什么命令来排查 CPU 高的问题"
                        rows={3}
                        disabled={actionLoading}
                      />
                    </Form.Item>
                    <Form.Item label="标题（可选）">
                      <Input
                        value={actionTitle}
                        onChange={(e) => setActionTitle(e.target.value)}
                        placeholder="操作标题"
                        disabled={actionLoading}
                      />
                    </Form.Item>
                  </Form>
                  <Space>
                    <Button
                      type="primary"
                      icon={<PlayCircleOutlined />}
                      loading={actionLoading}
                      onClick={() => handleAction('trigger_pipeline')}
                      style={{
                        backgroundColor: colors.purple[500],
                        borderColor: colors.purple[500],
                      }}
                    >
                      触发研发流程 Agent (TR-09)
                    </Button>
                    <Button
                      type="primary"
                      icon={<CloudServerOutlined />}
                      loading={actionLoading}
                      onClick={() => handleAction('suggest_command')}
                      style={{ backgroundColor: colors.info[500], borderColor: colors.info[500] }}
                    >
                      Ops 问答助手 (TR-11)
                    </Button>
                    <Button
                      type="primary"
                      icon={<FunnelPlotOutlined />}
                      loading={actionLoading}
                      onClick={() => handleAction('generate_flow')}
                      style={{
                        backgroundColor: colors.purple[500],
                        borderColor: colors.purple[500],
                      }}
                    >
                      AI 生成流程 (TR-10)
                    </Button>
                  </Space>
                  {actionResult && (
                    <Card
                      size="small"
                      style={{
                        marginTop: 4,
                        padding: 10,
                        background: themeVars.bgSecondary,
                      }}
                    >
                      <Space direction="vertical" size={6} style={{ width: '100%' }}>
                        <div>
                          <Tag color={actionResult.status === 'executed' ? 'green' : 'blue'}>
                            {actionResult.status}
                          </Tag>
                          <Tag>{actionResult.kind}</Tag>
                          {actionResult.entity_id && <Tag>{actionResult.entity_id}</Tag>}
                        </div>
                        <Text style={{ fontSize: 13 }}>{actionResult.summary}</Text>
                        {actionResult.steps && actionResult.steps.length > 0 && (
                          <Space direction="vertical" size={2}>
                            {actionResult.steps.map((step, i) => (
                              <Text
                                key={String(i)}
                                style={{ fontSize: 12, color: colors.neutral[500] }}
                              >
                                {i + 1}. {step}
                              </Text>
                            ))}
                          </Space>
                        )}
                        {actionResult.error && (
                          <Text type="danger" style={{ fontSize: 12 }}>
                            {actionResult.error}
                          </Text>
                        )}
                      </Space>
                    </Card>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
};

export default AssistantPage;
