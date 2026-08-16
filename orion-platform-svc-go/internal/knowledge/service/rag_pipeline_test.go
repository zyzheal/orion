package service

import (
	"testing"
	"time"

	"orion/platform-svc-go/internal/knowledge/models"
)

func TestDefaultPipelineConfigValues(t *testing.T) {
	cfg := DefaultPipelineConfig()
	tests := []struct {
		name     string
		got      interface{}
		expected interface{}
	}{
		{"DefaultTopK", cfg.DefaultTopK, 10},
		{"SimpleBudgetMs", cfg.SimpleBudgetMs, 200},
		{"ModerateBudgetMs", cfg.ModerateBudgetMs, 600},
		{"ComplexBudgetMs", cfg.ComplexBudgetMs, 5000},
		{"MaxRetries", cfg.MaxRetries, 3},
		{"MaxContextChars", cfg.MaxContextChars, 3000},
	}
	for _, tt := range tests {
		if tt.got != tt.expected {
			t.Errorf("%s: expected %v, got %v", tt.name, tt.expected, tt.got)
		}
	}
	if cfg.RerankerThreshold != 0.6 {
		t.Errorf("RerankerThreshold: expected 0.6, got %f", cfg.RerankerThreshold)
	}
	if cfg.MRRLambda != 0.5 {
		t.Errorf("MRRLambda: expected 0.5, got %f", cfg.MRRLambda)
	}
}

func TestNewRAGPipelineServiceZeroConfigUsesDefaults(t *testing.T) {
	svc := NewRAGPipelineService(nil, PipelineConfig{})
	cfg := svc.GetConfig()
	topK := cfg["default_top_k"].(int)
	if topK != 10 {
		t.Errorf("expected default top_k=10 when zero config, got %d", topK)
	}
}

func TestNewRAGPipelineServiceCustomConfig(t *testing.T) {
	svc := NewRAGPipelineService(nil, PipelineConfig{DefaultTopK: 5})
	cfg := svc.GetConfig()
	topK := cfg["default_top_k"].(int)
	if topK != 5 {
		t.Errorf("expected top_k=5, got %d", topK)
	}
}

func TestGetConfigContainsAllKeys(t *testing.T) {
	svc := NewRAGPipelineService(nil, DefaultPipelineConfig())
	cfg := svc.GetConfig()
	keys := []string{"default_top_k", "simple_budget_ms", "moderate_budget_ms",
		"complex_budget_ms", "reranker_threshold", "max_retries", "max_context_chars", "mmr_lambda"}
	for _, k := range keys {
		if _, ok := cfg[k]; !ok {
			t.Errorf("GetConfig missing key: %s", k)
		}
	}
}

func TestUpdateConfig(t *testing.T) {
	svc := NewRAGPipelineService(nil, DefaultPipelineConfig())
	svc.UpdateConfig(map[string]interface{}{
		"default_top_k":      float64(20),
		"max_retries":        float64(5),
		"reranker_threshold": float64(0.8),
		"mmr_lambda":         float64(0.7),
	})
	cfg := svc.GetConfig()
	if topK := cfg["default_top_k"].(int); topK != 20 {
		t.Errorf("expected top_k=20 after update, got %d", topK)
	}
	if retries := cfg["max_retries"].(int); retries != 5 {
		t.Errorf("expected max_retries=5 after update, got %d", retries)
	}
	if thresh := cfg["reranker_threshold"].(float64); thresh != 0.8 {
		t.Errorf("expected threshold=0.8 after update, got %f", thresh)
	}
}

func TestUpdateConfigIgnoresUnknownKeys(t *testing.T) {
	svc := NewRAGPipelineService(nil, DefaultPipelineConfig())
	svc.UpdateConfig(map[string]interface{}{"unknown_key": float64(99)})
	cfg := svc.GetConfig()
	if topK := cfg["default_top_k"].(int); topK != 10 {
		t.Errorf("expected top_k unchanged at 10, got %d", topK)
	}
}

func TestComputeQueryHashCaseInsensitive(t *testing.T) {
	h1 := computeQueryHash("Hello World")
	h2 := computeQueryHash("hello world")
	if h1 != h2 {
		t.Errorf("computeQueryHash should be case-insensitive")
	}
}

func TestComputeQueryHashTrimsWhitespace(t *testing.T) {
	h1 := computeQueryHash("  hello  ")
	h2 := computeQueryHash("hello")
	if h1 != h2 {
		t.Errorf("computeQueryHash should trim whitespace")
	}
}

func TestComputeQueryHashLength(t *testing.T) {
	h := computeQueryHash("test query")
	if len(h) != 64 {
		t.Errorf("expected hash length 64, got %d", len(h))
	}
}

func TestClassifyQuerySimple(t *testing.T) {
	svc := NewRAGPipelineService(nil, PipelineConfig{})
	c := svc.classifyQuery("how to deploy")
	if c != ComplexitySimple {
		t.Errorf("expected simple, got %s", c)
	}
}

func TestClassifyQueryComplex(t *testing.T) {
	svc := NewRAGPipelineService(nil, PipelineConfig{})
	longQuery := "how to deploy the pipeline and also configure the alert rules and set up monitoring and check the logs"
	c := svc.classifyQuery(longQuery)
	if c != ComplexityComplex {
		t.Errorf("expected complex, got %s", c)
	}
}

func TestClassifyQueryMultipleIntents(t *testing.T) {
	svc := NewRAGPipelineService(nil, PipelineConfig{})
	// 4 Chinese commas means multiIntent=4, should be complex
	c := svc.classifyQuery("告警，部署，回滚，构建，流水线")
	if c != ComplexityComplex {
		t.Errorf("expected complex for multi-intent query, got %s", c)
	}
}

func TestBudgetFor(t *testing.T) {
	svc := NewRAGPipelineService(nil, DefaultPipelineConfig())
	if svc.budgetFor(ComplexitySimple) != 200 {
		t.Errorf("expected simple budget 200")
	}
	if svc.budgetFor(ComplexityModerate) != 600 {
		t.Errorf("expected moderate budget 600")
	}
	if svc.budgetFor(ComplexityComplex) != 5000 {
		t.Errorf("expected complex budget 5000")
	}
}

func TestRewriteQuerySynonyms(t *testing.T) {
	svc := NewRAGPipelineService(nil, PipelineConfig{})
	result := svc.rewriteQuery("如何部署应用")
	if result != "如何deploy deployment 部署应用" {
		t.Errorf("unexpected rewrite result: %q", result)
	}
}

func TestRewriteQueryTrim(t *testing.T) {
	svc := NewRAGPipelineService(nil, PipelineConfig{})
	result := svc.rewriteQuery("  告警什么 ？")
	if result == "  告警什么 ？" {
		t.Errorf("rewriteQuery should trim and replace question marks")
	}
}

func TestRewriteQueryNewlines(t *testing.T) {
	svc := NewRAGPipelineService(nil, PipelineConfig{})
	result := svc.rewriteQuery("line1\nline2")
	if result == "line1\nline2" {
		t.Errorf("rewriteQuery should replace newlines with spaces")
	}
}

func TestMMRDedupRemovesDuplicates(t *testing.T) {
	svc := NewRAGPipelineService(nil, DefaultPipelineConfig())
	docs := []models.RAGRetrieveResult{
		{ID: "1", Title: "Alert Config", Content: "c1", SpaceID: "s1", Similarity: 0.9},
		{ID: "2", Title: "Alert Config", Content: "c2", SpaceID: "s1", Similarity: 0.8},
		{ID: "3", Title: "Deployment Guide", Content: "c3", SpaceID: "s1", Similarity: 0.7},
	}
	result := svc.mmrDedup(docs)
	if len(result) >= len(docs) {
		t.Errorf("mmrDedup should reduce duplicates, got %d docs", len(result))
	}
}

func TestMMRDedupEmpty(t *testing.T) {
	svc := NewRAGPipelineService(nil, PipelineConfig{})
	result := svc.mmrDedup(nil)
	if len(result) != 0 {
		t.Errorf("mmrDedup(nil) should return empty, got %d", len(result))
	}
}

func TestMMRDedupSingle(t *testing.T) {
	svc := NewRAGPipelineService(nil, PipelineConfig{})
	docs := []models.RAGRetrieveResult{{ID: "1", Title: "Test", Content: "c", SpaceID: "s", Similarity: 0.5}}
	result := svc.mmrDedup(docs)
	if len(result) != 1 {
		t.Errorf("mmrDedup single doc should return 1, got %d", len(result))
	}
}

func TestNormalizeTitle(t *testing.T) {
	got := normalizeTitle("  Hello   World  ")
	expected := "helloworld"
	if got != expected {
		t.Errorf("expected %q, got %q", expected, got)
	}
}

func TestTitleSimilarityIdentical(t *testing.T) {
	sim := titleSimilarity("hello", "hello")
	if sim != 1.0 {
		t.Errorf("expected 1.0 for identical titles, got %f", sim)
	}
}

func TestTitleSimilarityEmpty(t *testing.T) {
	sim := titleSimilarity("", "hello")
	if sim != 0 {
		t.Errorf("expected 0 for empty title, got %f", sim)
	}
}

func TestTitleSimilarityPartial(t *testing.T) {
	// "hello" and "world" share no chars
	sim := titleSimilarity("hello", "world")
	if sim > 0.5 {
		t.Errorf("expected low similarity, got %f", sim)
	}
}

func TestRerankFiltersByThreshold(t *testing.T) {
	svc := NewRAGPipelineService(nil, DefaultPipelineConfig())
	docs := []models.RAGRetrieveResult{
		{ID: "1", Title: "A", Similarity: 0.9},
		{ID: "2", Title: "B", Similarity: 0.5},
		{ID: "3", Title: "C", Similarity: 0.7},
	}
	result := svc.rerank(docs)
	if len(result) != 2 {
		t.Errorf("expected 2 docs above threshold 0.6, got %d", len(result))
	}
}

func TestRerankFallbackToFirst(t *testing.T) {
	svc := NewRAGPipelineService(nil, DefaultPipelineConfig())
	docs := []models.RAGRetrieveResult{
		{ID: "1", Title: "A", Similarity: 0.3},
	}
	result := svc.rerank(docs)
	if len(result) != 1 || result[0].ID != "1" {
		t.Errorf("expected fallback to first doc when all below threshold")
	}
}

func TestRerankEmpty(t *testing.T) {
	svc := NewRAGPipelineService(nil, PipelineConfig{})
	result := svc.rerank(nil)
	if len(result) != 0 {
		t.Errorf("rerank(nil) should return empty")
	}
}

func TestBuildContext(t *testing.T) {
	svc := NewRAGPipelineService(nil, DefaultPipelineConfig())
	docs := []models.RAGRetrieveResult{
		{ID: "d1", Title: "Doc1", Content: "This is the content of doc1", SpaceID: "s1", Similarity: 0.9},
	}
	ctx, sources := svc.buildContext(docs, "test query")
	if ctx == "" {
		t.Error("expected non-empty context")
	}
	if len(sources) != 1 {
		t.Errorf("expected 1 source, got %d", len(sources))
	}
	if sources[0].DocumentID != "d1" {
		t.Errorf("expected source document_id=d1, got %s", sources[0].DocumentID)
	}
}

func TestBuildContextEmpty(t *testing.T) {
	svc := NewRAGPipelineService(nil, PipelineConfig{})
	ctx, sources := svc.buildContext(nil, "query")
	if ctx != "" {
		t.Errorf("expected empty context for nil docs, got %q", ctx)
	}
	if len(sources) != 0 {
		t.Errorf("expected 0 sources for nil docs, got %d", len(sources))
	}
}

func TestFallbackPromptSimple(t *testing.T) {
	svc := NewRAGPipelineService(nil, PipelineConfig{})
	prompt := svc.fallbackPrompt(ComplexitySimple)
	if prompt == "" {
		t.Error("expected non-empty simple prompt")
	}
}

func TestFallbackPromptComplex(t *testing.T) {
	svc := NewRAGPipelineService(nil, PipelineConfig{})
	prompt := svc.fallbackPrompt(ComplexityComplex)
	if prompt == "" {
		t.Error("expected non-empty complex prompt")
	}
}

func TestGenerateSimpleAnswerContainsQuery(t *testing.T) {
	svc := NewRAGPipelineService(nil, PipelineConfig{})
	answer := svc.generateSimpleAnswer("how to deploy", "some context about deployment")
	if answer == "" {
		t.Error("expected non-empty answer")
	}
}

func TestGenerateDetailedAnswerComplex(t *testing.T) {
	svc := NewRAGPipelineService(nil, PipelineConfig{})
	answer := svc.generateDetailedAnswer("rollback steps", "context", ComplexityComplex)
	if answer == "" {
		t.Error("expected non-empty detailed answer")
	}
}

func TestExtractSnippet(t *testing.T) {
	snippet := extractSnippet("This is some context content that is quite long", "This")
	if snippet == "" {
		t.Error("expected non-empty snippet")
	}
	if len(snippet) > 800 {
		t.Errorf("expected snippet <= 800 chars, got %d", len(snippet))
	}
}

func TestExtractSnippetDefaultIndex(t *testing.T) {
	snippet := extractSnippet("hello", "zzzzzzz")
	if snippet != "hello" {
		t.Errorf("expected snippet from start when prefix not found, got %q", snippet)
	}
}

func TestGenerateActionSummaryRollback(t *testing.T) {
	steps := generateActionSummary("如何回滚部署")
	if steps == "" {
		t.Error("expected non-empty action summary")
	}
}

func TestGenerateActionSummaryPipeline(t *testing.T) {
	steps := generateActionSummary("pipeline run status")
	if steps == "" {
		t.Error("expected non-empty action summary for pipeline")
	}
}

func TestVerifyCitationsPass(t *testing.T) {
	svc := NewRAGPipelineService(nil, DefaultPipelineConfig())
	sources := []models.RAGSource{
		{Snippet: "some content", RelevanceScore: 0.9},
	}
	if !svc.verifyCitations("answer", sources) {
		t.Error("expected verifyCitations to pass with valid source")
	}
}

func TestVerifyCitationsFail(t *testing.T) {
	svc := NewRAGPipelineService(nil, DefaultPipelineConfig())
	sources := []models.RAGSource{
		{Snippet: "low score", RelevanceScore: 0.1},
	}
	if svc.verifyCitations("answer", sources) {
		t.Error("expected verifyCitations to fail with low score source")
	}
}

func TestVerifyCitationsEmptySources(t *testing.T) {
	svc := NewRAGPipelineService(nil, PipelineConfig{})
	if svc.verifyCitations("answer", nil) {
		t.Error("expected verifyCitations to fail with empty sources")
	}
}

func TestEstimateConfidenceEmpty(t *testing.T) {
	svc := NewRAGPipelineService(nil, PipelineConfig{})
	conf := svc.estimateConfidence(nil)
	if conf != 0.1 {
		t.Errorf("expected 0.1 for empty docs, got %f", conf)
	}
}

func TestEstimateConfidenceHigh(t *testing.T) {
	svc := NewRAGPipelineService(nil, PipelineConfig{})
	docs := []models.RAGRetrieveResult{
		{Similarity: 0.9},
		{Similarity: 0.85},
	}
	conf := svc.estimateConfidence(docs)
	if conf > 0.95 {
		t.Errorf("expected confidence capped at 0.95, got %f", conf)
	}
	if conf < 0.5 {
		t.Errorf("expected confidence >= 0.5, got %f", conf)
	}
}

func TestEstimateConfidenceCapped(t *testing.T) {
	svc := NewRAGPipelineService(nil, PipelineConfig{})
	docs := []models.RAGRetrieveResult{
		{Similarity: 1.0},
		{Similarity: 1.0},
		{Similarity: 1.0},
	}
	conf := svc.estimateConfidence(docs)
	if conf != 0.95 {
		t.Errorf("expected confidence capped at 0.95, got %f", conf)
	}
}

func TestAdjustStrategyAttempt0(t *testing.T) {
	svc := NewRAGPipelineService(nil, PipelineConfig{})
	adj := svc.adjustStrategy(nil, 0)
	if adj.query != "error" {
		t.Errorf("expected 'error' for empty docs, got %q", adj.query)
	}
}

func TestAdjustStrategyAttempt1(t *testing.T) {
	svc := NewRAGPipelineService(nil, PipelineConfig{})
	docs := []models.RAGRetrieveResult{{Title: "Alert Guide", Content: "c", Similarity: 0.8}}
	adj := svc.adjustStrategy(docs, 1)
	if adj.query != "Alert Guide" {
		t.Errorf("expected title as query for attempt 1, got %q", adj.query)
	}
	if adj.topK != 20 {
		t.Errorf("expected topK=20 for attempt 1, got %d", adj.topK)
	}
}

func TestAdjustStrategyAttempt2(t *testing.T) {
	svc := NewRAGPipelineService(nil, PipelineConfig{})
	docs := []models.RAGRetrieveResult{{Title: "Guide", Content: "content content content", Similarity: 0.8}}
	adj := svc.adjustStrategy(docs, 2)
	if adj.topK != 30 {
		t.Errorf("expected topK=30 for attempt 2, got %d", adj.topK)
	}
}

func TestAdjustStrategyDefault(t *testing.T) {
	svc := NewRAGPipelineService(nil, PipelineConfig{})
	docs := []models.RAGRetrieveResult{{Title: "Guide", Content: "c", Similarity: 0.8}}
	adj := svc.adjustStrategy(docs, 5)
	if adj.topK != 10 {
		t.Errorf("expected topK=10 for default attempt, got %d", adj.topK)
	}
}

func TestInjectCorrections(t *testing.T) {
	svc := NewRAGPipelineService(nil, PipelineConfig{})
	corrections := []models.UserCorrection{
		{ID: "c1", Query: "old query", CorrectedAnswer: "corrected answer text"},
	}
	docs := []models.RAGRetrieveResult{}
	result := svc.injectCorrections(docs, corrections)
	if len(result) != 1 {
		t.Errorf("expected 1 injected doc, got %d", len(result))
	}
	if result[0].Similarity != 0.95 {
		t.Errorf("expected similarity 0.95, got %f", result[0].Similarity)
	}
}

func TestInjectCorrectionsEmpty(t *testing.T) {
	svc := NewRAGPipelineService(nil, PipelineConfig{})
	docs := []models.RAGRetrieveResult{{ID: "1", Title: "A", Similarity: 0.5}}
	result := svc.injectCorrections(docs, nil)
	if len(result) != 1 {
		t.Errorf("expected 1 doc unchanged with no corrections, got %d", len(result))
	}
}

func TestMinInt(t *testing.T) {
	if minInt(3, 5) != 3 {
		t.Error("minInt(3,5) should be 3")
	}
	if minInt(5, 3) != 3 {
		t.Error("minInt(5,3) should be 3")
	}
	if minInt(3, 3) != 3 {
		t.Error("minInt(3,3) should be 3")
	}
}

func TestGenerateFeedbackTokenDeterministic(t *testing.T) {
	ts := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	t1 := generateFeedbackToken("query1", ts)
	t2 := generateFeedbackToken("query1", ts)
	if t1 != t2 {
		t.Error("generateFeedbackToken should be deterministic")
	}
}

func TestGenerateFeedbackTokenDifferentQuery(t *testing.T) {
	ts := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	t1 := generateFeedbackToken("query1", ts)
	t2 := generateFeedbackToken("query2", ts)
	if t1 == t2 {
		t.Error("different queries should produce different tokens")
	}
}

func TestGenerateFeedbackTokenLength(t *testing.T) {
	ts := time.Now()
	token := generateFeedbackToken("test", ts)
	if len(token) != 64 {
		t.Errorf("expected token length 64, got %d", len(token))
	}
}

func TestQueryComplexityConstants(t *testing.T) {
	if string(ComplexitySimple) != "simple" {
		t.Errorf("unexpected ComplexitySimple value: %s", ComplexitySimple)
	}
	if string(ComplexityModerate) != "moderate" {
		t.Errorf("unexpected ComplexityModerate value: %s", ComplexityModerate)
	}
	if string(ComplexityComplex) != "complex" {
		t.Errorf("unexpected ComplexityComplex value: %s", ComplexityComplex)
	}
}
