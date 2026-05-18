import React, { useState, useRef, useMemo } from 'react';
import { AutoComplete, Button } from 'antd';
import { SendOutlined, ArrowUpOutlined } from '@ant-design/icons';
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

  const quickCommands = useMemo(() => {
    if (commands.length === 0) {
      return [
        { label: '/deploy', value: '/deploy', icon: '\u{1F680}' },
        { label: '/logs', value: '/logs', icon: '\u{1F4CB}' },
        { label: '/status', value: '/status', icon: '\u{1F4CA}' },
        { label: '/restart', value: '/restart', icon: '\u{1F504}' },
        { label: '/rollback', value: '/rollback', icon: '\u{23EA}' },
      ];
    }
    return commands.slice(0, 6).map((cmd) => ({
      label: `/${cmd.name}`,
      value: `/${cmd.name}`,
      icon: cmd.icon || '\u26A1',
    }));
  }, [commands]);

  const hasInput = input.trim().length > 0;

  return (
    <div
      style={{
        padding: '10px 16px 14px',
        background: colors.light.bg.primary,
        borderTop: `1px solid ${colors.light.border.light}`,
        flexShrink: 0,
      }}
    >
      {/* Quick Commands */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          marginBottom: 10,
          overflowX: 'auto',
          paddingBottom: 2,
          scrollbarWidth: 'none',
        }}
      >
        {quickCommands.map((cmd) => (
          <button
            key={cmd.value}
            onClick={() => {
              setInput(cmd.value + ' ');
              inputRef.current?.focus();
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              fontSize: 12,
              lineHeight: 1.4,
              color: colors.primary[600],
              background: colors.primary[50],
              border: `1px solid ${colors.primary[100]}`,
              borderRadius: 12,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s',
              outline: 'none',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.background = colors.primary[100];
              (e.target as HTMLElement).style.borderColor = colors.primary[200];
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = colors.primary[50];
              (e.target as HTMLElement).style.borderColor = colors.primary[100];
            }}
          >
            <span style={{ fontSize: 13 }}>{cmd.icon}</span>
            {cmd.label}
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 8,
        }}
      >
        <div
          style={{
            flex: 1,
            borderRadius: 20,
            border: `1px solid ${hasInput ? colors.primary[300] : colors.light.border.default}`,
            background: colors.light.bg.primary,
            padding: '2px 14px',
            transition: 'all 0.2s',
            boxShadow: hasInput ? `0 0 0 2px ${colors.primary[100]}` : 'none',
          }}
        >
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
            <textarea
              ref={inputRef as any}
              placeholder="输入命令或自然语言..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setShowSuggestions(input.startsWith('/'))}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              rows={1}
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                resize: 'none',
                fontSize: 14,
                lineHeight: 1.5,
                padding: '6px 0',
                background: 'transparent',
                color: colors.light.text.primary,
                fontFamily: 'inherit',
                maxHeight: 100,
                overflowY: 'auto',
              }}
            />
          </AutoComplete>
        </div>
        <Button
          type="primary"
          icon={isTyping ? <ArrowUpOutlined spin /> : <SendOutlined />}
          onClick={handleSend}
          loading={isTyping}
          disabled={!hasInput}
          style={{
            borderRadius: 20,
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: hasInput
              ? `linear-gradient(135deg, ${colors.primary[500]}, ${colors.primary[600]})`
              : colors.light.border.light,
            border: 'none',
            boxShadow: hasInput ? `0 2px 8px ${colors.primary[400]}30` : 'none',
            transition: 'all 0.2s',
            flexShrink: 0,
            opacity: hasInput ? 1 : 0.5,
          }}
        />
      </div>
    </div>
  );
};
