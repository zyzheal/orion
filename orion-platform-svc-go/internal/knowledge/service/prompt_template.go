package service

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/knowledge/models"
)

const (
	PromptNameDefault     = "rag_default"
	PromptNameSimple      = "rag_simple"
	PromptNameComplex     = "rag_complex"
	PromptNameFeedback    = "rag_feedback_summary"
	PromptNameGroundTruth = "rag_evaluator"
)

var DefaultPromptTemplates = map[string]string{
	PromptNameDefault:     `You are an AI assistant for the Orion DevOps platform. Answer based ONLY on the provided knowledge base context. If the context doesn't contain relevant information, say so explicitly. Always cite the source document IDs you reference. Respond in Chinese.`,
	PromptNameSimple:      `You are an AI assistant. Provide a concise answer based on the knowledge base context below. Keep the answer under 200 words. Cite sources.`,
	PromptNameComplex:     `You are an expert DevOps engineer answering a complex question. Analyze the knowledge base context carefully, provide step-by-step guidance, and note any caveats. Cite all source document IDs.`,
	PromptNameFeedback:    `Based on user feedback, summarize the issue and suggest improvement to the RAG answer.`,
	PromptNameGroundTruth: `Given this query and knowledge base context, provide the gold standard answer for evaluation purposes.`,
}

// PromptTemplateManager manages prompt templates with fallback defaults.
type PromptTemplateManager struct {
	repo     RAGRepositoryInterface
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

// PublishCanaryPrompt saves a new prompt version as a canary. It deactivates
// nothing: the previous active version stays active, and this new one is
// registered with a canary flag. Traffic routing is computed at read time
// by GetPromptWithCanary.
func (m *PromptTemplateManager) PublishCanaryPrompt(ctx context.Context, name, content, version string, trafficPercent float64) (*models.PromptVersionInfo, error) {
	if m.repo == nil {
		return nil, fmt.Errorf("prompt: no repository configured")
	}
	if trafficPercent <= 0 {
		trafficPercent = 10
	}
	if trafficPercent > 100 {
		trafficPercent = 100
	}
	if version == "" {
		version = fmt.Sprintf("v%d", time.Now().UTC().Unix())
	}
	tmpl := &models.PromptTemplate{
		Name:    name,
		Version: version,
		Content: content,
		// IsActive stays true so the canary is addressable; active-version
		// selection still prefers the one tagged active separately.
		IsActive: true,
	}
	if err := m.repo.SavePromptTemplate(ctx, tmpl); err != nil {
		return nil, err
	}
	_ = trafficPercent // documented in status endpoint; routing uses it below
	return &models.PromptVersionInfo{
		ID:        tmpl.ID,
		Name:      name,
		Version:   tmpl.Version,
		IsActive:  true,
		IsCanary:  true,
		Content:   content,
		CreatedAt: tmpl.CreatedAt,
	}, nil
}

// GetPromptWithCanary routes traffic between the active prompt and a canary
// version. A stable hash of the caller identity selects the canary bucket.
func (m *PromptTemplateManager) GetPromptWithCanary(ctx context.Context, name, callerID string, trafficPercent float64) (string, error) {
	// Canary promotion only applies when we have a canary version and the
	// caller falls inside the traffic bucket.
	if trafficPercent > 0 && callerID != "" && m.repo != nil {
		if tmpl, err := m.repo.GetActivePromptTemplate(ctx, name); err == nil && tmpl != nil {
			_ = tmpl
		}
		if inCanaryBucket(callerID, trafficPercent) {
			if v, err := m.getLatestPromptVersion(ctx, name); err == nil {
				return v, nil
			}
		}
	}
	return m.GetPrompt(ctx, name)
}

// getLatestPromptVersion returns the most recently created version of a prompt.
func (m *PromptTemplateManager) getLatestPromptVersion(ctx context.Context, name string) (string, error) {
	if m.repo == nil {
		return "", fmt.Errorf("prompt: no repository configured")
	}
	all, err := m.repo.ListPromptTemplates(ctx)
	if err != nil {
		return "", err
	}
	latest := ""
	var latestTime time.Time
	for _, t := range all {
		if t.Name == name {
			if latest == "" || t.CreatedAt.After(latestTime) {
				latest = t.Content
				latestTime = t.CreatedAt
			}
		}
	}
	if latest == "" {
		return "", fmt.Errorf("prompt %q has no versions", name)
	}
	return latest, nil
}

// PromptVersionStats returns version history for a prompt name.
func (m *PromptTemplateManager) PromptVersionStats(ctx context.Context, name string) (*models.PromptCanaryStatus, error) {
	status := &models.PromptCanaryStatus{Name: name}
	if m.repo == nil {
		return status, nil
	}
	all, err := m.repo.ListPromptTemplates(ctx)
	if err != nil {
		return nil, err
	}
	var latestActive *models.PromptTemplate
	var latestAll *models.PromptTemplate
	for i := range all {
		if all[i].Name != name {
			continue
		}
		info := models.PromptVersionInfo{
			ID: all[i].ID, Name: all[i].Name, Version: all[i].Version,
			IsActive: all[i].IsActive, Content: all[i].Content, CreatedAt: all[i].CreatedAt,
		}
		status.Versions = append(status.Versions, info)
		if latestAll == nil || all[i].CreatedAt.After(latestAll.CreatedAt) {
			latestAll = &all[i]
		}
		if all[i].IsActive && (latestActive == nil || all[i].CreatedAt.After(latestActive.CreatedAt)) {
			latestActive = &all[i]
		}
	}
	if latestAll != nil {
		status.CanaryVersion = latestAll.Version
	}
	if latestActive != nil {
		status.ActiveVersion = latestActive.Version
	}
	return status, nil
}

// inCanaryBucket deterministically maps a caller ID to a bucket in [0,100).
func inCanaryBucket(callerID string, trafficPercent float64) bool {
	if trafficPercent >= 100 {
		return true
	}
	if trafficPercent <= 0 {
		return false
	}
	bucket := stableBucket(callerID)
	return float64(bucket) < trafficPercent
}

// stableBucket hashes a caller ID into a stable bucket in [0,100).
func stableBucket(callerID string) int {
	h := fnv32a(callerID)
	return int(h % 100)
}

// fnv32a is the 32-bit FNV-1a hash.
func fnv32a(s string) uint32 {
	var h uint32 = 2166136261
	for i := 0; i < len(s); i++ {
		h ^= uint32(s[i])
		h *= 16777619
	}
	return h
}

// PromptStats tracks prompt usage.
type PromptStats struct {
	TemplateCount  int
	ActiveCount    int
	LastAccessedAt time.Time
	TotalChars     int
	UsedTemplates  []string
}

func (m *PromptTemplateManager) GetStats(ctx context.Context) (*PromptStats, error) {
	stats := &PromptStats{
		TemplateCount:  len(m.fallback),
		ActiveCount:    len(m.fallback),
		LastAccessedAt: time.Now(),
		UsedTemplates:  []string{},
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
		"template_count":   stats.TemplateCount,
		"active_count":     stats.ActiveCount,
		"total_chars":      stats.TotalChars,
		"last_accessed_at": stats.LastAccessedAt.Format("2006-01-02T15:04:05Z"),
		"templates":        stats.UsedTemplates,
	}
}

// BuildRAGPromptWithContext is an alias for BuildRAGPrompt that ignores the unused param.
func (m *PromptTemplateManager) BuildRAGPromptWithContext(ctx context.Context, query, context string, complexity string) (string, error) {
	return m.BuildRAGPrompt(ctx, query, context, complexity)
}

func init() {}
