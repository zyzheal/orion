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

// NewKnowledgeProvider builds a knowledge source provider from an adapter fn.
func NewKnowledgeProvider(fn KnowledgeSearchFn) SourceProvider {
	return &knowledgeProvider{search: fn}
}

// NewPipelineProvider builds a pipeline source provider from an adapter fn.
func NewPipelineProvider(fn PipelineSearchFn) SourceProvider {
	return &pipelineProvider{search: fn}
}

// normalizeQuery trims and lowercases helper reused across adapters.
func normalizeQuery(q string) string {
	return strings.TrimSpace(q)
}
