package v1

import (
	"context"
	"fmt"
	"strings"

	"github.com/cloudwego/eino/schema"
	"github.com/labstack/echo/v4"
	"github.com/orion-platform/orion-knowledge/log"
	"github.com/orion-platform/orion-knowledge/middleware"
	"github.com/orion-platform/orion-knowledge/store/rag"
	"github.com/orion-platform/orion-knowledge/usecase"
)

/**
 * Orion 平台兼容路由
 *
 * 提供与 Orion 平台 /api/v1/knowledge/* 路径兼容的 API
 * 将请求映射到现有的 PandaWiki API
 * 支持租户隔离
 */

// CompatRoutesHandler 兼容路由处理器
type CompatRoutesHandler struct {
	knowledgeBaseHandler *KnowledgeBaseHandler
	nodeHandler          *NodeHandler
	logger               *log.Logger
	auth                 middleware.AuthMiddleware
	tenantMiddleware     *middleware.TenantMiddleware
	ragService           rag.RAGService
	llmUsecase           *usecase.LLMUsecase
	modelUsecase         *usecase.ModelUsecase
}

// NewCompatRoutesHandler 创建兼容路由处理器
func NewCompatRoutesHandler(
	kbHandler *KnowledgeBaseHandler,
	nodeHandler *NodeHandler,
	logger *log.Logger,
	auth middleware.AuthMiddleware,
	ragService rag.RAGService,
	llmUsecase *usecase.LLMUsecase,
	modelUsecase *usecase.ModelUsecase,
) *CompatRoutesHandler {
	return &CompatRoutesHandler{
		knowledgeBaseHandler: kbHandler,
		nodeHandler:          nodeHandler,
		logger:               logger,
		auth:                 auth,
		tenantMiddleware:     middleware.NewTenantMiddleware(""),
		ragService:           ragService,
		llmUsecase:           llmUsecase,
		modelUsecase:         modelUsecase,
	}
}

// RegisterRoutes 注册兼容路由
func (h *CompatRoutesHandler) RegisterRoutes(e *echo.Echo) {
	// 创建 /api/v1/knowledge 路由组
	// 添加租户中间件：从 x-tenant-id header 提取租户ID
	group := e.Group("/api/v1/knowledge",
		h.auth.Authorize,
		h.tenantMiddleware.Middleware(),
	)

	// ========== 空间相关 (/spaces) ==========
	// 对应 knowledge_base API
	group.GET("/spaces", h.listSpacesWithTenant)
	group.POST("/spaces", h.knowledgeBaseHandler.CreateKnowledgeBase, h.auth.ValidateUserRole("admin"))
	group.GET("/spaces/:id", h.getSpaceWithTenant)
	group.PUT("/spaces/:id", h.knowledgeBaseHandler.UpdateKnowledgeBase)
	group.DELETE("/spaces/:id", h.knowledgeBaseHandler.DeleteKnowledgeBase)

	// ========== 文档相关 (/docs) ==========
	// 对应 node API
	group.GET("/docs", h.listDocsWithTenant)
	group.POST("/docs", h.nodeHandler.CreateNode)
	group.GET("/docs/:id", h.nodeHandler.GetNodeDetail)
	group.PUT("/docs/:id", h.nodeHandler.UpdateNodeDetail)
	group.DELETE("/docs/:id", h.nodeHandler.NodeAction)

	// ========== RAG 相关 (/rag) ==========
	group.POST("/rag/retrieve", h.RAGRetrieve)
	group.POST("/rag/query", h.RAGQuery)

	h.logger.Info("[CompatRoutes] Registered /api/v1/knowledge/* routes with tenant isolation")
}

// listSpacesWithTenant 带租户过滤的空间列表
func (h *CompatRoutesHandler) listSpacesWithTenant(c echo.Context) error {
	tenantID := middleware.WithTenant(c)
	h.logger.Debug("[CompatRoutes] listSpacesWithTenant", "tenant", tenantID)

	// 将 tenantID 传入 context，供下游 Repository 层过滤
	ctx := context.WithValue(c.Request().Context(), "tenant_id", tenantID)
	c.SetRequest(c.Request().WithContext(ctx))

	return h.knowledgeBaseHandler.GetKnowledgeBaseList(c)
}

// getSpaceWithTenant 带租户过滤的空间详情
func (h *CompatRoutesHandler) getSpaceWithTenant(c echo.Context) error {
	tenantID := middleware.WithTenant(c)
	kbID := c.Param("id")
	h.logger.Debug("[CompatRoutes] getSpaceWithTenant", "tenant", tenantID, "kbID", kbID)

	// TODO: 验证该space属于当前租户
	return h.knowledgeBaseHandler.GetKnowledgeBaseDetail(c)
}

// listDocsWithTenant 带租户过滤的文档列表
func (h *CompatRoutesHandler) listDocsWithTenant(c echo.Context) error {
	tenantID := middleware.WithTenant(c)
	h.logger.Debug("[CompatRoutes] listDocsWithTenant", "tenant", tenantID)

	// 将 tenantID 传入 context，供下游 Repository 层过滤
	ctx := context.WithValue(c.Request().Context(), "tenant_id", tenantID)
	c.SetRequest(c.Request().WithContext(ctx))

	return h.nodeHandler.GetNodeList(c)
}

// RAGRetrieveRequest RAG检索请求
type RAGRetrieveRequest struct {
	Query     string `json:"query"`
	TopK      int    `json:"topK"`
	DatasetID string `json:"datasetId,omitempty"`
	GroupIDs  []int  `json:"groupIds,omitempty"`
}

// RAGRetrieveResponse RAG检索响应
type RAGRetrieveResponse struct {
	Results        []RAGRetrieveResult `json:"results"`
	Total          int                 `json:"total"`
	RewrittenQuery string              `json:"rewrittenQuery,omitempty"`
}

// RAGRetrieveResult 单条检索结果
type RAGRetrieveResult struct {
	DocID   string  `json:"docId"`
	Title   string  `json:"title"`
	Snippet string  `json:"snippet"`
	Score   float64 `json:"score"`
}

// RAGRetrieve RAG 检索
// 对应原 Orion 平台的 /knowledge/rag/retrieve
func (h *CompatRoutesHandler) RAGRetrieve(c echo.Context) error {
	var req RAGRetrieveRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(400, map[string]string{"error": "invalid request"})
	}

	if req.Query == "" {
		return c.JSON(400, map[string]string{"error": "query is required"})
	}

	if req.TopK == 0 {
		req.TopK = 10
	}

	// 获取租户ID用于隔离
	tenantID := middleware.WithTenant(c)

	// 调用RAG服务检索（添加租户隔离）
	rewriteQuery, chunks, err := h.ragService.QueryRecords(c.Request().Context(), &rag.QueryRecordsRequest{
		DatasetID:           req.DatasetID,
		Query:               req.Query,
		GroupIDs:            req.GroupIDs,
		Tags:                []string{"tenant:" + tenantID}, // 租户隔离标签
		MaxChunksPerDoc:     req.TopK,
		SimilarityThreshold: 0.7,
	})
	if err != nil {
		h.logger.Error("[RAGRetrieve] QueryRecords failed", "error", err, "tenant", tenantID)
		return c.JSON(500, map[string]string{"error": "retrieval failed"})
	}

	// 转换结果
	results := make([]RAGRetrieveResult, 0, len(chunks))
	for _, chunk := range chunks {
		results = append(results, RAGRetrieveResult{
			DocID:   chunk.DocID,
			Title:   chunk.Name,    // 使用 Name 字段作为标题
			Snippet: chunk.Content,
			Score:   chunk.Score,   // 如果 raglite 不返回 Score，这里为 0
		})
	}

	h.logger.Info("[RAGRetrieve] Retrieved", "tenant", tenantID, "query", req.Query, "count", len(results))

	return c.JSON(200, RAGRetrieveResponse{
		Results:        results,
		Total:          len(results),
		RewrittenQuery: rewriteQuery,
	})
}

// RAGQueryRequest RAG问答请求
type RAGQueryRequest struct {
	Query     string `json:"query"`
	DatasetID string `json:"datasetId,omitempty"`
	KBID      string `json:"kbId,omitempty"`
}

// RAGQueryResponse RAG问答响应
type RAGQueryResponse struct {
	Answer   string              `json:"answer"`
	Sources  []RAGQuerySource    `json:"sources"`
	Metadata map[string]string  `json:"metadata,omitempty"`
}

// RAGQuerySource 来源文档
type RAGQuerySource struct {
	DocID string `json:"docId"`
	Title string `json:"title"`
	Score float64 `json:"score,omitempty"`
}

// RAGQuery RAG 问答
// 对应原 Orion 平台的 /knowledge/rag/query
func (h *CompatRoutesHandler) RAGQuery(c echo.Context) error {
	var req RAGQueryRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(400, map[string]string{"error": "invalid request"})
	}

	if req.Query == "" {
		return c.JSON(400, map[string]string{"error": "query is required"})
	}

	tenantID := middleware.WithTenant(c)

	// 获取DatasetID（必须指定）
	datasetID := req.DatasetID
	if datasetID == "" {
		return c.JSON(400, map[string]string{"error": "datasetId is required"})
	}

	// 调用RAG检索（添加租户隔离）
	rewriteQuery, chunks, err := h.ragService.QueryRecords(c.Request().Context(), &rag.QueryRecordsRequest{
		DatasetID:           datasetID,
		Query:               req.Query,
		Tags:                []string{"tenant:" + tenantID}, // 租户隔离标签
		MaxChunksPerDoc:     5,
		SimilarityThreshold: 0.7,
	})
	if err != nil {
		h.logger.Error("[RAGQuery] QueryRecords failed", "error", err, "tenant", tenantID)
		return c.JSON(500, map[string]string{"error": "retrieval failed"})
	}

	if len(chunks) == 0 {
		return c.JSON(200, RAGQueryResponse{
			Answer:  "抱歉，我在知识库中没有找到与您问题相关的答案。",
			Sources: []RAGQuerySource{},
		})
	}

	// 构建上下文用于LLM生成答案
	var contextBuilder strings.Builder
	sources := make([]RAGQuerySource, 0, len(chunks))
	seenDocs := make(map[string]bool)

	for _, chunk := range chunks {
		if !seenDocs[chunk.DocID] {
			seenDocs[chunk.DocID] = true
			sources = append(sources, RAGQuerySource{
				DocID: chunk.DocID,
				Title: chunk.Name,
				Score: chunk.Score,
			})
		}
		contextBuilder.WriteString(fmt.Sprintf("【文档 %s】\n%s\n\n", chunk.Name, chunk.Content))
	}

	context := contextBuilder.String()

	// 如果有LLM usecase，使用LLM生成答案
	if h.llmUsecase != nil {
		answer, err := h.generateAnswerWithLLM(c.Request().Context(), req.Query, context)
		if err != nil {
			h.logger.Error("[RAGQuery] generateAnswerWithLLM failed", "error", err)
			// LLM失败时返回基于上下文的简单答案
			answer = fmt.Sprintf("根据检索到的资料：\n\n%s", context)
		}
		h.logger.Info("[RAGQuery] Answer generated", "tenant", tenantID, "query", req.Query, "chunks", len(chunks))
		return c.JSON(200, RAGQueryResponse{
			Answer:   answer,
			Sources:  sources,
			Metadata: map[string]string{"rewrittenQuery": rewriteQuery},
		})
	}

	// 没有LLM时返回基于上下文的简单答案
	answer := fmt.Sprintf("根据检索到的资料：\n\n%s", context)
	h.logger.Info("[RAGQuery] Answer (no LLM)", "tenant", tenantID, "query", req.Query, "chunks", len(chunks))
	return c.JSON(200, RAGQueryResponse{
		Answer:   answer,
		Sources:  sources,
		Metadata: map[string]string{"rewrittenQuery": rewriteQuery},
	})
}

// generateAnswerWithLLM 使用LLM生成答案
func (h *CompatRoutesHandler) generateAnswerWithLLM(ctx context.Context, question, contextStr string) (string, error) {
	// 1. 获取配置的聊天模型
	model, err := h.modelUsecase.GetChatModel(ctx)
	if err != nil {
		h.logger.Error("[generateAnswerWithLLM] GetChatModel failed", "error", err)
		return "", fmt.Errorf("model not configured")
	}

	// 2. 转换为 modelkit 模型
	modelkitModel, err := model.ToModelkitModel()
	if err != nil {
		h.logger.Error("[generateAnswerWithLLM] ToModelkitModel failed", "error", err)
		return "", fmt.Errorf("model conversion failed")
	}

	// 3. 获取聊天模型实例
	chatModel, err := h.llmUsecase.ModelKit().GetChatModel(ctx, modelkitModel)
	if err != nil {
		h.logger.Error("[generateAnswerWithLLM] GetChatModel instance failed", "error", err)
		return "", fmt.Errorf("failed to initialize chat model")
	}

	// 4. 构建结构化消息（防止 Prompt 注入）
	systemPrompt := "你是一个专业的知识库问答助手。请仅基于提供的上下文资料回答问题。如果上下文资料不足以回答问题，请说明你无法基于提供的资料回答。不要编造资料中没有的信息。"

	userContent := fmt.Sprintf(`请基于以下参考资料回答问题：

<参考资料>
%s
</参考资料>

<问题>
%s
</问题>

请根据参考资料有条理地组织回答，引用资料中的关键信息。如果资料不足以回答问题，请坦诚说明。`, contextStr, question)

	messages := []*schema.Message{
		schema.SystemMessage(systemPrompt),
		schema.UserMessage(userContent),
	}

	// 5. 调用 LLM 生成答案（非流式）
	answer, err := h.llmUsecase.Generate(ctx, chatModel, messages)
	if err != nil {
		return "", fmt.Errorf("LLM generate failed: %w", err)
	}

	return strings.TrimSpace(answer), nil
}