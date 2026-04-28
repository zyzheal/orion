import React, { useState, useRef, useMemo } from 'react';
import { Input, AutoComplete, Tag, Space, Button } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { useChatOpsStore } from '@/stores/chatOpsStore';
import { useCommandSuggestions } from './hooks/useCommandSuggestions';
import { colors } from '@/tokens/colors';

export const ChatInput: React.FC = () => {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { sendMessage, isTyping, commands } = useChatOpsStore();
  const inputRef = useRef<any>(null);

  const suggestions = useCommandSuggestions(input, commands);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isTyping) return;
    setInput('');
    await sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // P2-5: 从 store.commands 动态生成快捷命令，空状态优雅降级
  const quickCommands = useMemo(() => {
    // 加载中: 显示默认列表
    if (commands.length === 0) {
      return [
        { label: '/deploy', value: '/deploy' },
        { label: '/logs', value: '/logs' },
        { label: '/restart', value: '/restart' },
        { label: '/status', value: '/status' },
        { label: '/rollback', value: '/rollback' },
      ];
    }
    // 已加载: 取前 6 个
    return commands.slice(0, 6).map((cmd) => ({
      label: `/${cmd.name}`,
      value: `/${cmd.name}`,
    }));
  }, [commands]);

  return (
    <div
      style={{
        padding: '12px 16px',
        borderTop: `1px solid ${colors.light.border.light}`,
        background: colors.light.bg.primary,
      }}
    >
      <Space style={{ marginBottom: 8 }} wrap>
        {quickCommands.map((cmd) => (
          <Tag
            key={cmd.value}
            style={{ cursor: 'pointer' }}
            onClick={() => {
              setInput(cmd.value + ' ');
              inputRef.current?.focus();
            }}
          >
            {cmd.label}
          </Tag>
        ))}
      </Space>

      <AutoComplete
        options={suggestions.map((s) => ({ value: s, label: s }))}
        open={showSuggestions && suggestions.length > 0}
        value={input}
        onChange={setInput}
        onSelect={(value) => {
          setInput(value);
          setShowSuggestions(false);
        }}
      >
        <Input.TextArea
          ref={inputRef}
          placeholder="输入命令或自然语言... (使用 / 查看命令)"
          autoSize={{ minRows: 1, maxRows: 4 }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(input.startsWith('/'))}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          onPressEnter={handleSend}
        />
      </AutoComplete>

      <Button
        type="primary"
        icon={<SendOutlined />}
        onClick={handleSend}
        loading={isTyping}
        style={{ marginTop: 8, width: '100%' }}
      >
        发送
      </Button>
    </div>
  );
};
