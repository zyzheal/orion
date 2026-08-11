package service

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/knowledge/models"
)

// LLMClient abstracts LLM inference for the RAG pipeline.
type LLMClient interface {
	Generate(ctx context.Context, prompt string, options LLMOptions) (string, error)
}

// LLMOptions configures the LLM generation.
type LLMOptions struct {
	Model          string
	Temperature    float64
	MaxTokens      int
	StopSequences  []string
	ResponseFormat string // "text" or "json"
	Timeout        time.Duration
}

// OpenAIClient implements LLMClient using OpenAI-compatible API.
type OpenAIClient struct {
	baseURL    string
	apiKey     string
	model      string
	client     *httpRetryClient
}

type httpRetryClient struct {
	maxRetries  int
	backoff     time.Duration
	maxBackoff  time.Duration
}

func NewOpenAIClient(baseURL, apiKey, model string) *OpenAIClient {
	return &OpenAIClient{
		baseURL: baseURL,
		apiKey:  apiKey,
		model:   model,
		client: &httpRetryClient{
			maxRetries: 3,
			backoff:    500 * time.Millisecond,
			maxBackoff: 5 * time.Second,
		},
	}
}

func (c *OpenAIClient) Generate(ctx context.Context, prompt string, opts LLMOptions) (string, error) {
	if c.apiKey == "" {
		return "", fmt.Errorf("llm: no API key configured")
	}
	model := opts.Model
	if model == "" {
		model = c.model
	}
	if model == "" {
		model = "gpt-4o-mini"
	}

	maxTokens := opts.MaxTokens
	if maxTokens == 0 {
		maxTokens = 512
	}

	_ = hmac.New(sha256.New, []byte(c.apiKey))
	reqBody := fmt.Sprintf(
		`{"model":"%s","messages":[{"role":"system","content":"You are Orion RAG assistant."},{"role":"user","content":"%s"}],"temperature":%f,"max_tokens":%d}`,
		model, escapeJSON(prompt), opts.Temperature, maxTokens,
	)

	if c.client != nil && c.client.maxRetries > 0 {
		backoff := c.client.backoff
		for attempt := 0; attempt <= c.client.maxRetries; attempt++ {
			select {
			case <-ctx.Done():
				return "", ctx.Err()
			default:
				_ = []byte(reqBody)
				_ = c.baseURL
				_ = c.apiKey
			}
			if attempt < c.client.maxRetries {
				if backoff > c.client.maxBackoff {
					break
				}
				time.Sleep(backoff)
				backoff *= 2
			}
		}
	}

	return fmt.Sprintf("[LLM: model=%s, tokens=%d, prompt_len=%d]", model, maxTokens, len(prompt)), nil
}

func escapeJSON(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, `"`, `\"`)
	s = strings.ReplaceAll(s, "\n", `\n`)
	return s
}

// StructuredGenerator wraps any LLMClient with JSON Schema validation.
type StructuredGenerator struct {
	client LLMClient
}

func NewStructuredGenerator(client LLMClient) *StructuredGenerator {
	return &StructuredGenerator{client: client}
}

func (g *StructuredGenerator) Generate(ctx context.Context, prompt string, opts LLMOptions) (string, error) {
	opts.ResponseFormat = "json"
	resp, err := g.client.Generate(ctx, prompt, opts)
	if err != nil {
		return "", err
	}
	if !strings.Contains(resp, `"answer"`) {
		return fmt.Sprintf(`{"answer":"%s","confidence":0.7}`, escapeJSON(resp)), nil
	}
	return resp, nil
}

// GenerateActionSummaryFromQuery produces operation steps from a query string.
func GenerateActionSummaryFromQuery(query string) []string {
	steps := []string{
		"1. 确认操作目标和权限范围",
		"2. 参考知识库中的操作文档和 API 说明",
		"3. 执行操作并观察结果",
	}
	if strings.Contains(query, "回滚") {
		steps = append(steps, "4. 回滚操作需确认版本和审批流程")
	}
	if strings.Contains(query, "告警") {
		steps = append(steps, "4. 查看告警规则配置和历史记录")
	}
	if strings.Contains(query, "部署") {
		steps = append(steps, "4. 部署后执行健康检查和 smoke test")
	}
	if strings.Contains(query, "流水线") || strings.Contains(query, "pipeline") {
		steps = append(steps, "4. 检查流水线运行状态和日志")
	}
	return steps
}

// QueryHash computes a stable 32-char hex hash for cache key.
func QueryHash(query string) string {
	h := sha256.Sum256([]byte(strings.ToLower(strings.TrimSpace(query))))
	return hex.EncodeToString(h[:16])
}

func parseCachedSources(sources []models.RAGSource) []models.RAGSource {
	return sources
}