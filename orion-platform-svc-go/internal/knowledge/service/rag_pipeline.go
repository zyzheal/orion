package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"sync"
	"time"

	"orion/platform-svc-go/internal/knowledge/models"
)

// RAGPipelineService implements the full RAG Agent pipeline:
// SemanticCache → QueryClassifier → Rewriter → HybridRetriever → MMR → Context → Generator → Verifier → AgenticLoop
type RAGPipelineService struct {
	repo       RepositoryInterface
	ragRepo    RAGRepositoryInterface
	config     PipelineConfig
	configMu   sync.RWMutex
	llm        LLMClient
	promptMgr  *PromptTemplateManager
}

type PipelineConfig struct {
	DefaultTopK       int
	SimpleBudgetMs    int
	ModerateBudgetMs  int
	ComplexBudgetMs   int
	RerankerThreshold float64
	MaxRetries        int
	MaxContextChars   int
	MRRLambda         float64
}

func DefaultPipelineConfig() PipelineConfig {
	return PipelineConfig{
		DefaultTopK:       10,
		SimpleBudgetMs:    200,
		ModerateBudgetMs:  600,
		ComplexBudgetMs:   5000,
		RerankerThreshold: 0.6,
		MaxRetries:        3,
		MaxContextChars:   3000,
		MRRLambda:         0.5,
	}
}

func NewRAGPipelineService(repo RepositoryInterface, config PipelineConfig) *RAGPipelineService {
	if config.DefaultTopK == 0 {
		config = DefaultPipelineConfig()
	}
	return &RAGPipelineService{repo: repo, config: config}
}

// GetConfig returns a copy of the current pipeline config.
func (p *RAGPipelineService) GetConfig() map[string]interface{} {
	p.configMu.RLock()
	defer p.configMu.RUnlock()
	return map[string]interface{}{
		"default_top_k":        p.config.DefaultTopK,
		"simple_budget_ms":     p.config.SimpleBudgetMs,
		"moderate_budget_ms":   p.config.ModerateBudgetMs,
		"complex_budget_ms":    p.config.ComplexBudgetMs,
		"reranker_threshold":   p.config.RerankerThreshold,
		"max_retries":          p.config.MaxRetries,
		"max_context_chars":    p.config.MaxContextChars,
		"mmr_lambda":           p.config.MRRLambda,
	}
}

// UpdateConfig applies partial config updates at runtime.
func (p *RAGPipelineService) UpdateConfig(updates map[string]interface{}) {
	p.configMu.Lock()
	defer p.configMu.Unlock()
	if v, ok := updates["default_top_k"]; ok {
		if f, ok := v.(float64); ok {
			p.config.DefaultTopK = int(f)
		}
	}
	if v, ok := updates["simple_budget_ms"]; ok {
		if f, ok := v.(float64); ok {
			p.config.SimpleBudgetMs = int(f)
		}
	}
	if v, ok := updates["moderate_budget_ms"]; ok {
		if f, ok := v.(float64); ok {
			p.config.ModerateBudgetMs = int(f)
		}
	}
	if v, ok := updates["complex_budget_ms"]; ok {
		if f, ok := v.(float64); ok {
			p.config.ComplexBudgetMs = int(f)
		}
	}
	if v, ok := updates["reranker_threshold"]; ok {
		if f, ok := v.(float64); ok {
			p.config.RerankerThreshold = f
		}
	}
	if v, ok := updates["max_retries"]; ok {
		if f, ok := v.(float64); ok {
			p.config.MaxRetries = int(f)
		}
	}
	if v, ok := updates["max_context_chars"]; ok {
		if f, ok := v.(float64); ok {
			p.config.MaxContextChars = int(f)
		}
	}
	if v, ok := updates["mmr_lambda"]; ok {
		if f, ok := v.(float64); ok {
			p.config.MRRLambda = f
		}
	}
}


type QueryComplexity string

const (
	ComplexitySimple   QueryComplexity = "simple"
	ComplexityModerate QueryComplexity = "moderate"
	ComplexityComplex  QueryComplexity = "complex"
)

// Execute runs the full pipeline and returns structured response.
func (p *RAGPipelineService) Execute(ctx context.Context, tenantID string, req models.RAGQueryRequest) (*models.RAGQueryResponse, error) {
	start := time.Now()
	complexity := p.classifyQuery(req.Query)
	cacheKey := computeQueryHash(req.Query)

	// Step 1: Semantic cache lookup
	if p.ragRepo != nil {
		if cached, err := p.ragRepo.GetSemanticCache(ctx, tenantID, cacheKey); err == nil && cached != nil {
			sources := parseCachedSources(cached.Sources)
			return &models.RAGQueryResponse{
				Answer:     cached.CachedAnswer,
				Sources:    sources,
				Confidence: 0.9,
				QueryType:  string(complexity),
				LatencyMs:  int(time.Since(start).Milliseconds()),
			}, nil
		}
	}

	// Step 2: Query rewriter
	rewritten := p.rewriteQuery(req.Query)

	// Step 3: Hybrid retrieval
	topK := p.config.DefaultTopK
	docs, err := p.repo.Retrieve(ctx, tenantID, rewritten, req.SpaceID, &topK)
	if err != nil {
		return nil, fmt.Errorf("retrieval failed: %w", err)
	}

	// Step 4: Cross-session memory injection
	if p.ragRepo != nil && req.UserID != "" {
		hash := computeQueryHash(req.Query)
		corrections, _ := p.ragRepo.GetUserCorrections(ctx, tenantID, req.UserID, hash)
		docs = p.injectCorrections(docs, corrections)
	}

	// Step 5: MMR dedup + Re-rank
	docs = p.mmrDedup(docs)
	docs = p.rerank(docs)

	// Step 6: Build context
	contextText, sources := p.buildContext(docs, req.Query)

	// Step 7: Generate answer via LLM or fallback
	answer := p.generateAnswer(ctx, req.Query, contextText, complexity)

	// Step 8: Citation verifier + Agentic Loop
	var finalAnswer string
	var finalSources []models.RAGSource
	var confidence float64

	for attempt := 0; attempt <= p.config.MaxRetries; attempt++ {
		if attempt == 0 {
			finalAnswer = answer
			finalSources = sources
			confidence = p.estimateConfidence(docs)
		} else {
			adj := p.adjustStrategy(docs, attempt)
			docs2, _ := p.repo.Retrieve(ctx, tenantID, adj.query, req.SpaceID, &adj.topK)
			docs2 = p.mmrDedup(docs2)
			docs2 = p.rerank(docs2)
			contextText, finalSources = p.buildContext(docs2, req.Query)
			finalAnswer = p.generateAnswer(ctx, req.Query, contextText, complexity)
			confidence = p.estimateConfidence(docs2)
			docs = docs2
		}
		if p.verifyCitations(finalAnswer, finalSources) {
			break
		}
	}

	// Step 9: Save to cache if confidence is high enough
	if p.ragRepo != nil && confidence >= p.config.RerankerThreshold && finalAnswer != "" {
		ttlHours := 24
		switch complexity {
		case ComplexitySimple:
			ttlHours = 24
		case ComplexityModerate:
			ttlHours = 12
		default:
			ttlHours = 6
		}
		if err := p.ragRepo.SaveSemanticCache(ctx, &models.SemanticCache{
			QueryHash:     cacheKey,
			TenantID:      tenantID,
			OriginalQuery: req.Query,
			CachedAnswer:  finalAnswer,
			Sources:       finalSources,
		}, ttlHours); err != nil {
			return nil, fmt.Errorf("cache save failed: %w", err)
		}
	}

	resp := &models.RAGQueryResponse{
		Answer:        finalAnswer,
		Sources:       finalSources,
		Confidence:    confidence,
		QueryType:     string(complexity),
		LatencyMs:     int(time.Since(start).Milliseconds()),
		FeedbackToken: generateFeedbackToken(req.Query, start),
	}
	return resp, nil
}

func (p *RAGPipelineService) SetRAGRepo(r RAGRepositoryInterface) {
	p.ragRepo = r
}

func (p *RAGPipelineService) SetLLMClient(client LLMClient) {
	p.llm = client
}

func (p *RAGPipelineService) SetPromptManager(mgr *PromptTemplateManager) {
	p.promptMgr = mgr
}

func computeQueryHash(query string) string {
	h := sha256.Sum256([]byte(strings.ToLower(strings.TrimSpace(query))))
	return hex.EncodeToString(h[:32])
}

// --- Query Classifier ---

func (p *RAGPipelineService) classifyQuery(query string) QueryComplexity {
	wordCount := len(strings.Fields(query))
	multiIntent := strings.Count(query, "，") + strings.Count(query, "、")

	if wordCount <= 5 && multiIntent <= 1 {
		return ComplexitySimple
	}
	if wordCount <= 15 && multiIntent <= 2 {
		return ComplexityModerate
	}
	return ComplexityComplex
}

func (p *RAGPipelineService) budgetFor(c QueryComplexity) int {
	switch c {
	case ComplexitySimple:
		return p.config.SimpleBudgetMs
	case ComplexityModerate:
		return p.config.ModerateBudgetMs
	default:
		return p.config.ComplexBudgetMs
	}
}

// --- Query Rewriter ---

func (p *RAGPipelineService) rewriteQuery(query string) string {
	query = strings.TrimSpace(query)
	query = strings.ReplaceAll(query, "\n", " ")
	query = strings.Trim(query, "？? ")

	synonyms := map[string]string{
		"流水线": "pipeline pipeline run",
		"告警":   "alert notification 告警",
		"部署":   "deploy deployment 部署",
		"回滚":   "rollback 回滚",
		"构建":   "build compile 构建",
	}
	expanded := query
	for key, val := range synonyms {
		if strings.Contains(query, key) {
			expanded = strings.ReplaceAll(expanded, key, val)
		}
	}
	return expanded
}

// --- MMR Dedup ---

func (p *RAGPipelineService) mmrDedup(docs []models.RAGRetrieveResult) []models.RAGRetrieveResult {
	if len(docs) <= 1 {
		return docs
	}
	selected := make([]models.RAGRetrieveResult, 0, minInt(len(docs), p.config.DefaultTopK))
	seen := make(map[string]bool)
	for _, d := range docs {
		key := normalizeTitle(d.Title) + ":" + d.SpaceID
		if seen[key] {
			continue
		}
		seen[key] = true
		selected = append(selected, d)
		if len(selected) >= p.config.DefaultTopK {
			break
		}
	}
	var result []models.RAGRetrieveResult
	for _, d := range selected {
		maxSim := 0.0
		for _, s := range result {
			sim := titleSimilarity(d.Title, s.Title)
			if sim > maxSim {
				maxSim = sim
			}
		}
		adjusted := d.Similarity - p.config.MRRLambda*maxSim
		if adjusted > 0 {
			result = append(result, d)
		}
	}
	return result
}

func normalizeTitle(t string) string {
	return strings.ReplaceAll(strings.ToLower(strings.TrimSpace(t)), " ", "")
}

func titleSimilarity(a, b string) float64 {
	if a == b {
		return 1.0
	}
	if len(a) == 0 || len(b) == 0 {
		return 0
	}
	setA := make(map[rune]bool)
	for _, r := range a {
		setA[r] = true
	}
	inter, union := 0, len(a)
	for _, r := range b {
		union++
		if setA[r] {
			inter++
		}
	}
	if union == 0 {
		return 0
	}
	return float64(inter) / float64(union)
}

// --- Re-ranker ---

func (p *RAGPipelineService) rerank(docs []models.RAGRetrieveResult) []models.RAGRetrieveResult {
	var result []models.RAGRetrieveResult
	for _, d := range docs {
		if d.Similarity >= p.config.RerankerThreshold {
			result = append(result, d)
		}
	}
	if len(result) == 0 && len(docs) > 0 {
		result = docs[:1]
	}
	return result
}

// --- Context Builder ---

func (p *RAGPipelineService) buildContext(docs []models.RAGRetrieveResult, query string) (string, []models.RAGSource) {
	var parts []string
	var sources []models.RAGSource
	maxChars := p.config.MaxContextChars
	used := 0

	for _, d := range docs {
		if used > maxChars {
			break
		}
		snippet := d.Content
		remaining := maxChars - used - 50
		if len(snippet) > remaining {
			snippet = snippet[:remaining]
		}
		part := fmt.Sprintf("[Source: %s]\n%s", d.Title, snippet)
		parts = append(parts, part)
		sources = append(sources, models.RAGSource{
			DocumentID:     d.ID,
			Title:          d.Title,
			Snippet:        snippet,
			RelevanceScore: d.Similarity,
			SpaceID:        d.SpaceID,
		})
		used += len(part)
	}

	var sb strings.Builder
	for i, part := range parts {
		if i > 0 {
			sb.WriteString("\n\n---\n\n")
		}
		sb.WriteString(part)
	}
	return sb.String(), sources
}

// --- Answer Generator ---

func (p *RAGPipelineService) generateAnswer(ctx context.Context, query, context string, complexity QueryComplexity) string {
	if context == "" {
		return fmt.Sprintf("知识库中未找到与\"%s\"相关的文档。请尝试不同的关键词或补充更多上下文。", query)
	}

	// Try LLM if configured
	if p.llm != nil {
		systemPrompt, err := p.getSystemPrompt(ctx, string(complexity))
		if err != nil {
			systemPrompt = p.fallbackPrompt(complexity)
		}
		prompt := fmt.Sprintf(
			"%s\n\n--- USER QUERY ---\n%s\n\n--- CONTEXT ---\n%s",
			systemPrompt, query, context,
		)
		answer, err := p.llm.Generate(ctx, prompt, LLMOptions{
			Temperature: 0.3,
			MaxTokens:   1024,
		})
		if err == nil && answer != "" {
			return answer
		}
	}

	// Fallback to rule-based generation
	if complexity == ComplexitySimple {
		return p.generateSimpleAnswer(query, context)
	}
	return p.generateDetailedAnswer(query, context, complexity)
}

func (p *RAGPipelineService) getSystemPrompt(ctx context.Context, complexity string) (string, error) {
	name := PromptNameDefault
	switch QueryComplexity(complexity) {
	case ComplexitySimple:
		name = PromptNameSimple
	case ComplexityComplex:
		name = PromptNameComplex
	}
	if p.promptMgr != nil {
		prompt, err := p.promptMgr.GetPrompt(ctx, name)
		if err == nil && prompt != "" {
			return prompt, nil
		}
	}
	return p.fallbackPrompt(QueryComplexity(complexity)), nil
}

func (p *RAGPipelineService) fallbackPrompt(complexity QueryComplexity) string {
	switch complexity {
	case ComplexitySimple:
		return "你是 Orion DevOps 平台的 AI 助手。请基于上下文简明回答，不超过 150 字。"
	case ComplexityComplex:
		return "你是 Orion DevOps 平台的资深运维工程师。请仔细分析上下文，分步骤提供操作指引，注意权限和风险提示。"
	default:
		return "你是 Orion DevOps 平台的 AI 助手。请基于提供的知识库上下文回答问题，引用来源文档 ID。"
	}
}

func (p *RAGPipelineService) generateSimpleAnswer(query, context string) string {
	snippet := extractSnippet(context, query)
	steps := generateActionSummary(query)
	return fmt.Sprintf("## 关于\"%s\"的操作指引\n\n### 检索依据\n%s\n\n### 操作步骤\n%s", query, snippet, steps)
}

func (p *RAGPipelineService) generateDetailedAnswer(query, context string, complexity QueryComplexity) string {
	answer := fmt.Sprintf("## 关于\"%s\"的操作指引\n\n", query)
	answer += fmt.Sprintf("### 检索依据\n%s\n\n", extractSnippet(context, query))
	answer += fmt.Sprintf("### 操作步骤\n%s\n\n", generateActionSummary(query))
	if complexity == ComplexityComplex {
		answer += "### 注意事项\n"
		answer += "- 操作前请确认当前环境权限\n"
		answer += "- 建议在非生产环境先行验证\n"
		answer += "- 如遇异常，参考故障排查文档"
	}
	return answer
}

func extractSnippet(context, query string) string {
	prefix := query[:minInt(len(query), 10)]
	idx := strings.Index(context, prefix)
	if idx == -1 || idx > 500 {
		idx = 0
	}
	end := idx + 800
	if end > len(context) {
		end = len(context)
	}
	return context[idx:end]
}

func generateActionSummary(query string) string {
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
	return strings.Join(steps, "\n")
}

// --- Citation Verifier ---

func (p *RAGPipelineService) verifyCitations(answer string, sources []models.RAGSource) bool {
	for _, s := range sources {
		if s.RelevanceScore >= p.config.RerankerThreshold && len(s.Snippet) > 0 {
			return true
		}
	}
	return false
}

func (p *RAGPipelineService) estimateConfidence(docs []models.RAGRetrieveResult) float64 {
	if len(docs) == 0 {
		return 0.1
	}
	var total float64
	count := 0
	for _, d := range docs {
		if d.Similarity > 0 {
			total += d.Similarity
			count++
		}
	}
	if count == 0 {
		return 0.1
	}
	conf := total / float64(count)
	if conf > 0.95 {
		conf = 0.95
	}
	return conf
}

type adjustedQuery struct {
	query string
	topK  int
}

func (p *RAGPipelineService) adjustStrategy(docs []models.RAGRetrieveResult, attempt int) adjustedQuery {
	if len(docs) == 0 {
		return adjustedQuery{query: "error", topK: 10}
	}
	switch attempt {
	case 1:
		return adjustedQuery{query: docs[0].Title, topK: 20}
	case 2:
		return adjustedQuery{query: docs[0].Title + " " + docs[0].Content[:minInt(100, len(docs[0].Content))], topK: 30}
	default:
		return adjustedQuery{query: docs[0].Title, topK: 10}
	}
}

func (p *RAGPipelineService) injectCorrections(docs []models.RAGRetrieveResult, corrections []models.UserCorrection) []models.RAGRetrieveResult {
	for _, c := range corrections {
		if c.CorrectedAnswer != "" {
			docs = append(docs, models.RAGRetrieveResult{
				ID:         c.ID,
				Title:      "[用户纠正] " + c.Query[:minInt(len(c.Query), 50)],
				Content:    c.CorrectedAnswer,
				Similarity: 0.95,
			})
		}
	}
	return docs
}

// minInt returns the smaller of a and b.
func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// --- Semantic Cache helpers ---

func generateFeedbackToken(query string, ts time.Time) string {
	data := ts.Format(time.RFC3339Nano) + query
	h := sha256.Sum256([]byte(data))
	return hex.EncodeToString(h[:32])
}