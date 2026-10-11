import { Button, Input, Space, Typography } from 'antd';
import { SendOutlined, ClearOutlined, BulbOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';

const { Paragraph } = Typography;

interface Props {
  question: string;
  setQuestion: (v: string) => void;
  loading: boolean;
  ask: () => void;
  clearChat: () => void;
  messageCount: number;
}

export function InputBar({ question, setQuestion, loading, ask, clearChat, messageCount }: Props) {
  return (
    <>
      <div role="region" aria-label="助手提问输入区" style={{ display: 'flex', gap: 8, marginTop: spacing.md }}>
        <Input.TextArea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="输入问题，例如：为什么订单一小时前失败？"
          aria-label="助手问题输入框"
          aria-describedby="assistant-input-hint"
          aria-live="polite"
          autoSize={{ minRows: 1, maxRows: 4 }}
          disabled={loading}
          tabIndex={0}
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
            aria-label="提交问题"
            tabIndex={0}
          >
            提问
          </Button>
          <Button
            size="small"
            icon={<ClearOutlined />}
            onClick={clearChat}
            disabled={messageCount === 0}
            aria-label="清空聊天记录"
            tabIndex={0}
          >
            清空
          </Button>
        </Space>
      </div>
      <Paragraph
        id="assistant-input-hint"
        type="secondary"
        style={{ marginTop: spacing.sm, fontSize: 12 }}
      >
        <BulbOutlined /> 助手回答依赖已接入的数据源；运行结果由后端 assistant 模块意图路由与检索合成。
      </Paragraph>
      <Paragraph type="secondary" style={{ marginTop: spacing.sm, fontSize: 12 }}>
        <BulbOutlined /> 助手回答依赖已接入的数据源；运行结果由后端 assistant 模块意图路由与检索合成。
      </Paragraph>
    </>
  );
}
