package service

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/knowledge/models"
)

const (
	PromptNameDefault       = "rag_default"
	PromptNameSimple        = "rag_simple"
	PromptNameComplex       = "rag_complex"
	PromptNameFeedback      = "rag_feedback_summary"
	PromptNameGroundTruth   = "rag_evaluator"
)

var DefaultPromptTemplates = map[string]string{
	PromptNameDefault: `You are an AI assistant for the Orion DevOps platform. Answer based ONLY on the provided knowledge base context. If the context doesn't contain relevant information, say so explicitly. Always cite the source document IDs you reference. Respond in Chinese.`,
	PromptNameSimple: `You are an AI assistant. Provide a concise answer based on the knowledge base context below. Keep the answer under 200 words. Cite sources.`,
	PromptNameComplex: `You are an expert DevOps engineer answering a complex question. Analyze the knowledge base context carefully, provide step-by-step guidance, and note any caveats. Cite all source document IDs.`,
	PromptNameFeedback: `Based on user feedback, summarize the issue and suggest improvement to the RAG answer.`,
	PromptNameGroundTruth: `Given this query and knowledge base context, provide the gold standard answer for evaluation purposes.`,
}

// PromptTemplateManager manages prompt templates with fallback defaults.
type PromptTemplateManager struct {
	repo    RAGRepositoryInterface
	fallback map[string]string
}

func NewPromptTemplateManager(repo RAGRepositoryInterface) *PromptTemplateManager {
	return &PromptTemplateManager{repo: repo, fallback: DefaultPromptTemplates}
}

func (m *PromptTemplateManager) GetPrompt(ctx context.Context, name string) (string, error) {
	if m.repo != nil {
		tmpl, err := m.repo.GetActivePromptTemplate(ctx, name)
		if err == nil && tmpl != nil {
			return tmpl.Content, nil
		}
	}
	if defaultContent, ok := m.fallback[name]; ok {
		return defaultContent, nil
	}
	return m.fallback[PromptNameDefault], nil
}

// SavePrompt persists a new prompt template version.
func (m *PromptTemplateManager) SavePrompt(ctx context.Context, tmpl *models.PromptTemplate) error {
	if m.repo == nil {
		return fmt.Errorf("prompt: no repository configured")
	}
	return m.repo.SavePromptTemplate(ctx, tmpl)
}

func (m *PromptTemplateManager) BuildRAGPrompt(ctx context.Context, query, context string, complexity string) (string, error) {
	systemPrompt, err := m.GetPrompt(ctx, PromptNameDefault)
	if err != nil {
		systemPrompt = m.fallback[PromptNameDefault]
	}

	var rolePrompt string
	switch complexity {
	case "simple":
		rolePrompt, _ = m.GetPrompt(ctx, PromptNameSimple)
	case "complex":
		rolePrompt, _ = m.GetPrompt(ctx, PromptNameComplex)
	default:
		rolePrompt = systemPrompt
	}

	prompt := fmt.Sprintf(
		"%s\n\n--- USER QUERY ---\n%s\n\n--- KNOWLEDGE BASE CONTEXT ---\n%s\n\n--- INSTRUCTIONS ---\n%s\n\n--- OUTPUT FORMAT ---\nProvide answer in Chinese with clear structure. Cite source document IDs in brackets like [Source: title].",
		rolePrompt,
		query,
		context,
		systemPrompt,
	)

	return prompt, nil
}

// PromptStats tracks prompt usage.
type PromptStats struct {
	TemplateCount   int
	ActiveCount     int
	LastAccessedAt  time.Time
	TotalChars      int
	UsedTemplates   []string
}

func (m *PromptTemplateManager) GetStats(ctx context.Context) (*PromptStats, error) {
	stats := &PromptStats{
		TemplateCount: len(m.fallback),
		ActiveCount:   len(m.fallback),
		LastAccessedAt: time.Now(),
		UsedTemplates: []string{},
	}
	for name := range m.fallback {
		stats.UsedTemplates = append(stats.UsedTemplates, name)
		stats.TotalChars += len(m.fallback[name])
	}
	if m.repo != nil {
		tmpls, err := m.repo.ListPromptTemplates(ctx)
		if err == nil {
			stats.TemplateCount += len(tmpls)
			for _, t := range tmpls {
				if t.IsActive {
					stats.ActiveCount++
				}
				stats.TotalChars += len(t.Content)
			}
		}
	}
	return stats, nil
}

// GetPromptTemplateStats returns stats in a format suitable for API response.
func (m *PromptTemplateManager) GetPromptTemplateStats(ctx context.Context) map[string]interface{} {
	stats, err := m.GetStats(ctx)
	if err != nil {
		return map[string]interface{}{
			"error": err.Error(),
		}
	}
	return map[string]interface{}{
		"template_count":  stats.TemplateCount,
		"active_count":    stats.ActiveCount,
		"total_chars":     stats.TotalChars,
		"last_accessed_at": stats.LastAccessedAt.Format("2006-01-02T15:04:05Z"),
		"templates":       stats.UsedTemplates,
	}
}

// BuildRAGPromptWithContext is an alias for BuildRAGPrompt that ignores the unused param.
func (m *PromptTemplateManager) BuildRAGPromptWithContext(ctx context.Context, query, context string, complexity string) (string, error) {
	return m.BuildRAGPrompt(ctx, query, context, complexity)
}

func init() {}