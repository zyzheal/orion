/**
 * Global Floating Copilot Button (TR-02)
 *
 * Fixed-position Copilot entry point visible on every page (bottom-right).
 * Clicking navigates to the full Assistant page.
 */
import { useState, useEffect } from 'react';
import { Button } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { colors, radius } from '@/tokens';
import { useNavigate } from 'react-router-dom';

const CopilotFloating: React.FC = () => {
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  // Defer render to avoid hydration mismatch.
  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <div
      style={{
        position: 'fixed',
        right: 24,
        bottom: 24,
        zIndex: 9999,
      }}
    >
      <Button
        type="primary"
        shape="circle"
        size="large"
        icon={<RobotOutlined style={{ fontSize: 20 }} />}
        onClick={() => navigate('/console/assistant')}
        style={{
          width: 56,
          height: 56,
          boxShadow: '0 4px 12px rgba(51, 112, 230, 0.35)',
          borderRadius: radius.circle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title="AI 助手 — 智能操作 / 告警解释 / 复盘生成 / 成本分析"
      />
    </div>
  );
};

export default CopilotFloating;