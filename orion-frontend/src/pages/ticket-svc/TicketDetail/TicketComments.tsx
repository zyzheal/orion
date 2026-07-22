/**
 * TicketComments Component
 * - Tab switch between "评论" (Comments) and "内部备注" (Internal Notes)
 * - Timeline-style comment list with: author avatar, name, timestamp, content
 * - @mention highlighting (shown as blue tags)
 * - Text area input for new comment with:
 *   - Character count
 *   - Mention autocomplete dropdown (lists mockEngineers)
 *   - Submit button
 * - Attachments section below comments (file list with icons for image/log types)
 * - Uses mockTicketComments and mockTicketAttachments
 */
import React, { useState, useMemo } from 'react';
import {
  Typography,
  Tabs,
  Tag,
  Avatar,
  Input,
  Button,
  Space,
  Card,
  Divider,
  message,
} from 'antd';
import {
  SendOutlined,
  FileOutlined,
  FileImageOutlined,
  FileTextOutlined,
  PaperClipOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { listUsers, type User } from '@/api/users';
import { getComments, getAttachments } from '@/api/ticketing';
import { colors, spacing } from '@/tokens';

const { Text } = Typography;
const { TextArea } = Input;

// ============================================================================
// Types
// ============================================================================

export interface TicketComment {
  id: string;
  ticketId: string;
  author: string;
  content: string;
  type: 'comment' | 'internal-note';
  createdAt: string;
  mentions: string[];
  attachments?: string[];
}

export interface TicketAttachment {
  id: string;
  ticketId: string;
  name: string;
  size: string;
  type: string;
  uploadedBy: string;
  uploadedAt: string;
  url: string;
}

interface TicketCommentsProps {
  ticketId: string;
}

// ============================================================================
// Helper: Get file icon based on MIME type
// ============================================================================

function getFileIcon(fileType: string): React.ReactNode {
  if (fileType.startsWith('image/')) {
    return <FileImageOutlined style={{ color: colors.success[500] }} />;
  }
  if (fileType.startsWith('text/') || fileType.includes('log')) {
    return <FileTextOutlined style={{ color: colors.primary[500] }} />;
  }
  return <FileOutlined style={{ color: colors.neutral[400] }} />;
}

// ============================================================================
// Helper: Render content with @mention highlighting
// ============================================================================

function renderContentWithMentions(content: string): React.ReactNode {
  // Match @name patterns (including Chinese characters)
  const parts = content.split(/(@\S+)/g);
  return parts.map((part, index) => {
    if (part.startsWith('@')) {
      const mentionName = part.slice(1);
      return (
        <Tag
          key={index}
          color="blue"
          style={{ margin: '0 2px', cursor: 'pointer', fontSize: spacing[3] }}
          data-testid={`mention-${mentionName}`}
        >
          {part}
        </Tag>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

// ============================================================================
// TicketComments Component
// ============================================================================

const TicketComments: React.FC<TicketCommentsProps> = ({ ticketId }) => {
  const [activeTab, setActiveTab] = useState<'comment' | 'internal-note'>('comment');
  const [commentText, setCommentText] = useState('');
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [engineers, setEngineers] = useState<User[]>([]);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);

  // Load engineers for mention autocomplete
  React.useEffect(() => {
    const loadEngineers = async () => {
      try {
        const res = await listUsers({ limit: 200 });
        setEngineers(res.data?.data || []);
      } catch {
        setEngineers([]);
      }
    };
    loadEngineers();
  }, []);

  // Load comments and attachments from API
  React.useEffect(() => {
    const loadData = async () => {
      try {
        const [commentsRes, attachmentsRes] = await Promise.all([
          getComments(ticketId),
          getAttachments(ticketId),
        ]);
        const commentsData = commentsRes.data?.items;
        const attachmentsData = attachmentsRes.data?.items;
        setComments(Array.isArray(commentsData) ? commentsData as TicketComment[] : []);
        setAttachments(Array.isArray(attachmentsData) ? attachmentsData as TicketAttachment[] : []);
      } catch {
        setComments([]);
        setAttachments([]);
      }
    };
    loadData();
  }, [ticketId]);

  // Filtered engineers for mention autocomplete
  const mentionCandidates = useMemo(() => {
    if (!mentionSearch) return engineers;
    return engineers
      .filter((e) => (e.name || e.username).toLowerCase().includes(mentionSearch.toLowerCase()));
  }, [mentionSearch, engineers]);

  // Character count
  const charCount = commentText.length;
  const maxChars = 2000;

  // Detect @ trigger in text
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setCommentText(value);

    // Check if user just typed '@'
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@([^\s]*)$/);

    if (mentionMatch) {
      setMentionSearch(mentionMatch[1]);
      setShowMentionDropdown(true);
    } else {
      setShowMentionDropdown(false);
      setMentionSearch('');
    }
  };

  // Select a mention candidate
  const handleSelectMention = (name: string) => {
    const cursorPos = commentText.length;
    const textBeforeCursor = commentText.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@([^\s]*)$/);

    if (mentionMatch) {
      const beforeMention = textBeforeCursor.slice(0, mentionMatch.index);
      const newText = beforeMention + `@${name} ` + commentText.slice(cursorPos);
      setCommentText(newText);
    }
    setShowMentionDropdown(false);
    setMentionSearch('');
  };

  // Submit comment
  const handleSubmit = () => {
    if (!commentText.trim()) {
      message.warning('请输入评论内容');
      return;
    }
    if (charCount > maxChars) {
      message.warning('评论内容超出长度限制');
      return;
    }
    message.success(activeTab === 'internal-note' ? '内部备注已提交' : '评论已提交');
    setCommentText('');
    setShowMentionDropdown(false);
    setMentionSearch('');
  };

  // Tab definitions
  const tabItems = [
    {
      key: 'comment',
      label: (
        <span data-testid="tab-comments">
          评论
        </span>
      ),
    },
    {
      key: 'internal-note',
      label: (
        <span data-testid="tab-internal-notes">
          内部备注
          <Tag
            color="gold"
            style={{ marginLeft: 6, fontSize: spacing[2], padding: '0 4px', lineHeight: '16px' }}
          >
            内部
          </Tag>
        </span>
      ),
    },
  ];

  return (
    <Card
      title={
        <Space>
          <PaperClipOutlined />
          评论与备注
        </Space>
      }
      size="small"
      style={{ marginBottom: spacing.md }}
      data-testid="ticket-comments-section"
    >
      {/* Tab switch */}
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as 'comment' | 'internal-note')}
        items={tabItems}
        style={{ marginBottom: spacing.md }}
        size="small"
      />

      {/* Comment list - timeline style */}
      <div style={{ marginBottom: spacing.md }} data-testid="comment-list">
        {comments.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
            {comments.map((comment) => (
              <div
                key={comment.id}
                data-testid={`comment-${comment.id}`}
                style={{
                  display: 'flex',
                  gap: spacing[3],
                  padding: spacing[3],
                  borderRadius: 8,
                  background:
                    comment.type === 'internal-note' ? colors.warning[50] : colors.neutral[50],
                  border:
                    comment.type === 'internal-note'
                      ? `1px solid ${colors.warning[100]}`
                      : `1px solid ${colors.light.border.light}`,
                }}
              >
                {/* Avatar */}
                <Avatar
                  size={36}
                  style={{
                    background:
                      comment.author === '内部' ? colors.warning[500] : colors.primary[500],
                    flexShrink: 0,
                  }}
                >
                  {comment.author[0]}
                </Avatar>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Header: name + timestamp + internal badge */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: spacing.sm,
                      marginBottom: 4,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Text strong style={{ fontSize: spacing[4] }}>
                      {comment.author}
                    </Text>
                    {comment.type === 'internal-note' && (
                      <Tag
                        color="gold"
                        style={{
                          margin: 0,
                          fontSize: spacing[2],
                          padding: '0 4px',
                          lineHeight: '16px',
                        }}
                        data-testid={`internal-badge-${comment.id}`}
                      >
                        内部备注
                      </Tag>
                    )}
                    <Text type="secondary" style={{ fontSize: spacing[3], marginLeft: 'auto' }}>
                      {dayjs(comment.createdAt).format('MM-DD HH:mm')}
                    </Text>
                  </div>

                  {/* Content text with @mention highlighting */}
                  <div
                    style={{ fontSize: spacing[4], lineHeight: 1.6 }}
                    data-testid={`comment-content-${comment.id}`}
                  >
                    {renderContentWithMentions(comment.content)}
                  </div>

                  {/* Mention list */}
                  {comment.mentions.length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <UserOutlined
                        style={{ fontSize: spacing[3], color: colors.neutral[400], marginRight: 4 }}
                      />
                      {comment.mentions.map((m) => (
                        <Tag
                          key={m}
                          color="blue"
                          style={{ margin: '0 4px 0 0', fontSize: spacing[3] }}
                        >
                          {m}
                        </Tag>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Text
            type="secondary"
            style={{ display: 'block', textAlign: 'center', padding: '24px 0' }}
          >
            暂无{activeTab === 'comment' ? '评论' : '内部备注'}
          </Text>
        )}
      </div>

      {/* Attachments section */}
      {attachments.length > 0 && (
        <>
          <Divider style={{ margin: '0 0 12px' }} />
          <div style={{ marginBottom: spacing.md }} data-testid="attachments-section">
            <Text strong style={{ fontSize: spacing[3], marginBottom: spacing.sm, display: 'block' }}>
              <PaperClipOutlined style={{ marginRight: 4 }} />
              附件 ({attachments.length})
            </Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {attachments.map((att) => (
                <div
                  key={att.id}
                  data-testid={`attachment-${att.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.sm,
                    padding: '6px 10px',
                    borderRadius: 6,
                    background: colors.neutral[50],
                    border: `1px solid ${colors.light.border.light}`,
                    cursor: 'pointer',
                  }}
                >
                  {getFileIcon(att.type)}
                  <Text style={{ flex: 1 }} ellipsis>
                    {att.name}
                  </Text>
                  <Text type="secondary" style={{ fontSize: spacing[3] }}>
                    {att.size}
                  </Text>
                  <Text type="secondary" style={{ fontSize: spacing[3] }}>
                    {dayjs(att.uploadedAt).format('MM-DD HH:mm')}
                  </Text>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* New comment input area */}
      <Divider style={{ margin: '0 0 12px' }} />
      <div style={{ position: 'relative' }} data-testid="comment-input-area">
        <TextArea
          value={commentText}
          onChange={handleTextChange}
          placeholder={
            activeTab === 'internal-note'
              ? '输入内部备注（仅团队成员可见）... 输入 @ 可提及某人'
              : '输入评论内容... 输入 @ 可提及某人'
          }
          rows={3}
          maxLength={maxChars}
          style={{ marginBottom: spacing.sm }}
          data-testid="comment-textarea"
        />

        {/* Mention autocomplete dropdown */}
        {showMentionDropdown && mentionCandidates.length > 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              right: 0,
              background: colors.light.bg.primary,
              border: `1px solid ${colors.light.border.light}`,
              borderRadius: 6,
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              zIndex: 10,
              maxHeight: 160,
              overflowY: 'auto',
            }}
            data-testid="mention-dropdown"
          >
            {mentionCandidates.map((engineer) => (
              <div
                key={engineer.id}
                onClick={() => handleSelectMention(engineer.name || engineer.username)}
                style={{
                  padding: '6px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing.sm,
                  borderBottom: `1px solid ${colors.light.border.light}`,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = colors.info[50];
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                }}
                data-testid={`mention-option-${engineer.name}`}
              >
                <Avatar size={20} style={{ background: colors.primary[500], fontSize: spacing[2] }}>
                  {(engineer.name || engineer.username)?.[0] || 'U'}
                </Avatar>
                <Text>{engineer.name || engineer.username}</Text>
                <Text type="secondary" style={{ fontSize: spacing[3], marginLeft: 'auto' }}>
                  {engineer.status === 'active'
                    ? '可用'
                    : engineer.status === 'inactive'
                      ? '离开'
                      : '忙碌'}
                </Text>
              </div>
            ))}
          </div>
        )}

        {/* Footer: char count + submit */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text type="secondary" style={{ fontSize: spacing[3] }}>
            {charCount}/{maxChars}
          </Text>
          <Space>
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSubmit}
              disabled={!commentText.trim()}
              data-testid="submit-comment-btn"
            >
              提交{activeTab === 'internal-note' ? '备注' : '评论'}
            </Button>
          </Space>
        </div>
      </div>
    </Card>
  );
};

export default TicketComments;
