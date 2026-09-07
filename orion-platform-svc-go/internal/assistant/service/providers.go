package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/assistant/models"
)

// KnowledgeSearchFn adapts the knowledge RAG Retrieve into a SourceProvider.
type KnowledgeSearchFn func(ctx context.Context, tenantID, query, spaceID string, topK int) ([]RetrievedDoc, error)

// RetrievedDoc is the knowledge provider's normalized result.
type RetrievedDoc struct {
	Title      string
	Content    string
	SpaceID    string
	Similarity float64
}

// PipelineSearchFn adapts pipeline query into a SourceProvider.
type PipelineSearchFn func(ctx context.Context, tenantID, query string, limit int) ([]PipelineRef, error)

// PipelineRef is a normalized pipeline record.
type PipelineRef struct {
	ID    string
	Title string
}

type knowledgeProvider struct {
	search KnowledgeSearchFn
}

func (p *knowledgeProvider) Name() string { return "knowledge" }

func (p *knowledgeProvider) Search(ctx context.Context, tenantID string, q models.QueryRequest) ([]models.SourceResult, error) {
	if p.search == nil {
		return nil, nil
	}
	topK := q.TopK
	if topK <= 0 {
		topK = 5
	}
	docs, err := p.search(ctx, tenantID, q.Question, q.SpaceID, topK)
	if err != nil {
		if errors.Is(err, sentinel.NotFound) {
			return nil, nil
		}
		return nil, err
	}
	out := make([]models.SourceResult, 0, len(docs))
	for _, d := range docs {
		out = append(out, models.SourceResult{
			Source:     "knowledge",
			Title:      d.Title,
			Content:    d.Content,
			SpaceID:    d.SpaceID,
			Similarity: d.Similarity,
		})
	}
	return out, nil
}

type pipelineProvider struct {
	search PipelineSearchFn
}

func (p *pipelineProvider) Name() string { return "pipeline" }

func (p *pipelineProvider) Search(ctx context.Context, tenantID string, q models.QueryRequest) ([]models.SourceResult, error) {
	if p.search == nil {
		return []models.SourceResult{{Source: "pipeline", Title: "（pipeline 数据未接入）", Content: "未配置 pipeline 检索源。"}}, nil
	}
	refs, err := p.search(ctx, tenantID, q.Question, q.TopK)
	if err != nil {
		return nil, err
	}
	out := make([]models.SourceResult, 0, len(refs))
	for _, r := range refs {
		out = append(out, models.SourceResult{
			Source:  "pipeline",
			Title:   r.Title,
			Content: fmt.Sprintf("pipeline id=%s", r.ID),
		})
	}
	return out, nil
}

// DBASearchFn adapts a DBA query into a SourceProvider. The AI
// assistant uses it when a question mentions slow queries, execution
// plans, or index recommendations.
type DBASearchFn func(ctx context.Context, tenantID, query string, limit int) ([]DBARef, error)

// DBARef is a normalized DBA record surfaced to the assistant.
type DBARef struct {
	ID    string
	Title string
	Body  string
}

type dbaProvider struct {
	search DBASearchFn
}

func (p *dbaProvider) Name() string { return "dba" }

func (p *dbaProvider) Search(ctx context.Context, tenantID string, q models.QueryRequest) ([]models.SourceResult, error) {
	if p.search == nil {
		return nil, nil
	}
	limit := q.TopK
	if limit <= 0 {
		limit = 5
	}
	refs, err := p.search(ctx, tenantID, q.Question, limit)
	if err != nil {
		if errors.Is(err, sentinel.NotFound) {
			return nil, nil
		}
		return nil, err
	}
	out := make([]models.SourceResult, 0, len(refs))
	for _, r := range refs {
		out = append(out, models.SourceResult{
			Source:  "dba",
			Title:   r.Title,
			Content: r.Body,
		})
	}
	return out, nil
}

// NewKnowledgeProvider builds a knowledge source provider from an adapter fn.
func NewKnowledgeProvider(fn KnowledgeSearchFn) SourceProvider {
	return &knowledgeProvider{search: fn}
}

// NewPipelineProvider builds a pipeline source provider from an adapter fn.
func NewPipelineProvider(fn PipelineSearchFn) SourceProvider {
	return &pipelineProvider{search: fn}
}

// NewDBAProvider builds a DBA source provider from an adapter fn.
func NewDBAProvider(fn DBASearchFn) SourceProvider {
	return &dbaProvider{search: fn}
}

// IsDBAQuestion is a cheap gate that returns true when the user's
// question plausibly references DBA topics. Used by the assistant
// service to decide whether to include the DBA provider in the
// search fan-out.
func IsDBAQuestion(q string) bool {
	lower := strings.ToLower(q)
	terms := []string{"slow", "慢查询", "慢sql", "explain", "plan", "索引", "index", "audit", "audit rule", "审批", "approval", "db", "database", "sql"}
	for _, t := range terms {
		if strings.Contains(lower, t) {
			return true
		}
	}
	return false
}

// normalizeQuery trims and lowercases helper reused across adapters.
func normalizeQuery(q string) string {
	return strings.TrimSpace(q)
}
