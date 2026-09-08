import { Button, Layout } from 'antd';
import { MenuUnfoldOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { useAssistantState } from './useAssistantState';
import { PageHeader } from './Components/PageHeader';
import { InputBar } from './Components/InputBar';
import { Extras } from './Components/Extras';
import { ChatArea } from './ChatArea';
import { SessionSidebar } from './SessionSidebar';

const { Content } = Layout;

const AssistantPage = () => {
  const {
    question, setQuestion, messages, loading, sessions, currentSessionId,
    sidebarOpen, setSidebarOpen, actionLoading, actionResult, actionPrompt,
    setActionPrompt, actionTitle, setActionTitle, importSource, setImportSource,
    ingesting, selectSession, newSession, deleteSession, ask, clearChat,
    handleAction, handleIngest,
  } = useAssistantState();

  return (
    <div>
      <PageHeader />

      <Layout>
        <SessionSidebar
          sessions={sessions}
          currentSessionId={currentSessionId}
          open={sidebarOpen}
          onSelect={selectSession}
          onNew={newSession}
          onDelete={deleteSession}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />
        <Content style={{ padding: spacing.lg, background: colors.light.bg.primary }}>
          {!sidebarOpen && (
            <Button size="small" icon={<MenuUnfoldOutlined />} onClick={() => setSidebarOpen(true)} style={{ marginBottom: spacing.sm }}>
              展开会话
            </Button>
          )}
          <div style={{ border: `1px solid ${colors.light.border.default}`, borderRadius: 8, padding: spacing.md, minHeight: 320 }}>
            <ChatArea messages={messages} loading={loading} ask={ask} />
          </div>
          <InputBar
            question={question}
            setQuestion={setQuestion}
            loading={loading}
            ask={ask}
            clearChat={clearChat}
            messageCount={messages.length}
          />
          <Extras
            importSource={importSource}
            setImportSource={setImportSource}
            ingesting={ingesting}
            handleIngest={handleIngest}
            actionPrompt={actionPrompt}
            setActionPrompt={setActionPrompt}
            actionTitle={actionTitle}
            setActionTitle={setActionTitle}
            actionLoading={actionLoading}
            actionResult={actionResult}
            handleAction={handleAction as any}
          />
        </Content>
      </Layout>
    </div>
  );
};

export default AssistantPage;
