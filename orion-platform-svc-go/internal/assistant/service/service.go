package service

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"orion/platform-svc-go/internal/assistant/models"
)

// LLMClient abstracts LLM generation for the assistant.
type LLMClient interface {
	Generate(ctx context.Context, prompt string, options LLMOptions) (string, error)
}

// LLMOptions configures a single generation call.
type LLMOptions struct {
	Model       string
	Temperature float64
	MaxTokens   int
	Timeout     time.Duration
}

// SourceProvider retrieves candidate citations for a question from a single
// operational domain.
type SourceProvider interface {
	Name() string
	Search(ctx context.Context, tenantID string, q models.QueryRequest) ([]models.SourceResult, error)
}

// Service is the assistant brain: intent routing + multi-source fusion + answer.
type Service struct {
	providers   []SourceProvider
	llm         LLMClient
	executors   map[models.ActionKind]ActionExecutor
	sessionMgr  *SessionManager
	sessionStore SessionStore
}

// NewService creates an assistant with the given source providers.
func NewService(providers []SourceProvider) *Service {
	store := NewInMemorySessionStore()
	return &Service{
		providers:    providers,
		sessionStore: store,
		sessionMgr:   NewSessionManager(store),
	}
}

// SetSessionStore replaces the default in-memory store with a custom one.
func (s *Service) SetSessionStore(store SessionStore) {
	s.sessionStore = store
	s.sessionMgr = NewSessionManager(store)
}

// SetLLMClient wires an optional LLM used to synthesize the final answer.
func (s *Service) SetLLMClient(llm LLMClient) {
	s.llm = llm
}

// Query routes a question to the relevant sources and produces an answer.
func (s *Service) Query(ctx context.Context, tenantID string, req models.QueryRequest) (*models.QueryResponse, error) {
	intent := s.detectIntent(req)
	if intent != "" {
		req.Intent = intent
	}

	results := s.collect(ctx, tenantID, req)
	sort.SliceStable(results, func(i, j int) bool {
		if results[i].Source != results[j].Source {
			return results[i].Source < results[j].Source
		}
		return results[i].Similarity > results[j].Similarity
	})

	answer := s.generate(ctx, tenantID, req, results)
	return &models.QueryResponse{
		Question:  req.Question,
		Intent:    intent,
		Answer:    answer,
		Sources:   results,
		Generated: s.llm != nil,
		CreatedAt: time.Now().UTC(),
	}, nil
}

// QueryWithSession handles multi-turn queries with session context injection.
// If sessionID is provided, previous messages are appended to the question for
// context; the answer is persisted back to the session.
func (s *Service) QueryWithSession(ctx context.Context, tenantID, userID, sessionID string, req models.QueryRequest) (*models.SessionResponse, error) {
	sess, err := s.sessionMgr.GetOrCreate(ctx, sessionID, tenantID, userID)
	if err != nil {
		return nil, err
	}

	// Inject recent context: append previous Q&A to the current question
	window := s.sessionMgr.GetContextWindow(ctx, sessionID, tenantID, 6)
	enriched := s.enrichWithHistory(req.Question, window)

	resp, err := s.Query(ctx, tenantID, models.QueryRequest{
		Question: enriched,
		Intent:   req.Intent,
		SpaceID:  req.SpaceID,
		TopK:     req.TopK,
		Metadata: req.Metadata,
	})
	if err != nil {
		return nil, err
	}

	// Persist the turn
	if err := s.sessionMgr.AppendTurn(ctx, sessionID, tenantID, req.Question, resp.Answer); err != nil {
		// Best-effort; don't fail the response
		_ = err
	}

	return &models.SessionResponse{
		QueryResponse: *resp,
		SessionID:     sessionID,
		TurnCount:     len(sess.Messages) + 2,
	}, nil
}

// enrichWithHistory prepends summarized prior conversation context to the question.
func (s *Service) enrichWithHistory(question string, history []models.Message) string {
	if len(history) == 0 {
		return question
	}
	var b strings.Builder
	b.WriteString("历史对话上下文：\n")
	for _, m := range history {
		role := map[bool]string{true: "用户", false: "助手"}[m.Role == "user"]
		b.WriteString(fmt.Sprintf("  %s: %s\n", role, truncate(m.Content, 100)))
	}
	b.WriteString(fmt.Sprintf("\n当前问题：%s", question))
	return b.String()
}

// ListSessions returns recent sessions for a user.
func (s *Service) ListSessions(ctx context.Context, tenantID, userID string, limit int) ([]*models.Session, error) {
	return s.sessionMgr.store.ListByUser(ctx, tenantID, userID, limit)
}

// GetSession returns a single session.
func (s *Service) GetSession(ctx context.Context, tenantID, userID, sessionID string) (*models.Session, error) {
	return s.sessionMgr.store.Get(ctx, sessionID, tenantID)
}

// DeleteSession removes a session.
func (s *Service) DeleteSession(ctx context.Context, tenantID, sessionID string) error {
	return s.sessionMgr.DeleteSession(ctx, sessionID, tenantID)
}

// detectIntent classifies a question into an operational domain.
func (s *Service) detectIntent(req models.QueryRequest) string {
	if req.Intent != "" && req.Intent != "auto" {
		return req.Intent
	}
	q := strings.ToLower(req.Question)
	short := truncate(q, 120)
	switch {
	case containsAny(short, "研发流程", "agent run", "代码生成", "自动生成"):
		return "dev-agent"
	case containsAny(short, "ops", "运维", "操作手册", "命令建议"):
		return "ops"
	case containsAny(short, "告警", "alert", "报警", "异常", "alarm"):
		return "alert"
	case containsAny(short, "工单", "ticket", "申请", "审批", "request"):
		return "ticket"
	case containsAny(short, "流水线", "pipeline", "构建", "发布", "部署", "ci", "cd", "run"):
		return "pipeline"
	case containsAny(short, "变更", "change", "上线"):
		return "change"
	case containsAny(short, "文档", "知识库", "手册", "怎么做", "如何", "how", "faq"):
		return "knowledge"
	default:
		return ""
	}
}

// collect queries all eligible providers.
func (s *Service) collect(ctx context.Context, tenantID string, req models.QueryRequest) []models.SourceResult {
	var results []models.SourceResult
	for _, p := range s.providers {
		if req.Intent != "" && req.Intent != p.Name() {
			if p.Name() != "knowledge" {
				continue
			}
		}
		rs, err := p.Search(ctx, tenantID, req)
		if err != nil {
			continue
		}
		results = append(results, rs...)
	}
	return results
}

// generate composes a final answer from LLM if configured, else a template.
func (s *Service) generate(ctx context.Context, tenantID string, req models.QueryRequest, results []models.SourceResult) string {
	if s.llm != nil {
		prompt := buildPrompt(req.Question, req.Intent, results)
		ans, err := s.llm.Generate(ctx, prompt, LLMOptions{Temperature: 0.2, MaxTokens: 800})
		if err == nil && strings.TrimSpace(ans) != "" {
			return ans
		}
	}
	return templateAnswer(req.Question, req.Intent, results)
}

// --- templates ---

func templateAnswer(question, intent string, results []models.SourceResult) string {
	var b strings.Builder
	switch intent {
	case "alert":
		b.WriteString("根据告警检索结果，推荐如下排查路径：\n")
	case "ticket":
		b.WriteString("根据工单检索结果，相关记录如下：\n")
	case "pipeline":
		b.WriteString("根据流水线检索结果，相关运行记录如下：\n")
	case "change":
		b.WriteString("根据变更记录检索结果，相关变更如下：\n")
	case "dev-agent":
		b.WriteString("研发流程 Agent 可执行以下操作：\n")
	case "ops":
		b.WriteString("根据运维手册检索结果，推荐如下操作：\n")
	default:
		b.WriteString("为你检索到相关上下文信息：\n")
	}
	b.WriteString("\n")
	if len(results) == 0 {
		b.WriteString("- 未找到精确匹配。可以补充更多关键词，或切换数据源重试。")
		return b.String()
	}
	seen := map[string]bool{}
	for i, r := range results {
		key := r.Source + ":" + r.Title
		if seen[key] {
			continue
		}
		seen[key] = true
		snippet := strings.TrimSpace(r.Content)
		if len(snippet) > 200 {
			snippet = snippet[:200] + "…"
		}
		b.WriteString(fmt.Sprintf("%d. [%s] %s\n   %s\n", i+1, r.Source, r.Title, snippet))
	}
	b.WriteString("\n（如需更精确的结果，请描述更多上下文或指定数据源。）")
	return b.String()
}

func buildPrompt(question, intent string, results []models.SourceResult) string {
	var b strings.Builder
	b.WriteString("你是一个面向工程与运维平台的智能助手。请用中文回答用户问题，仅依据以下检索到的上下文，不要虚构事实。若上下文不足，请明确说明。\n\n")
	b.WriteString(fmt.Sprintf("问题：%s\n意图：%s\n\n检索到的上下文：\n", question, intent))
	for i, r := range results {
		b.WriteString(fmt.Sprintf("[%d] 来源=%s 标题=%s\n%s\n", i+1, r.Source, r.Title, strings.TrimSpace(r.Content)))
	}
	b.WriteString("\n请以" + "回答：" + "开头输出。")
	return b.String()
}

// --- helpers ---

func containsAny(s string, subs ...string) bool {
	for _, sub := range subs {
		if strings.Contains(s, sub) {
			return true
		}
	}
	return false
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}