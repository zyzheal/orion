package v1

import (
	"fmt"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/orion-platform/orion-knowledge/domain"
	"github.com/orion-platform/orion-knowledge/middleware"
	"github.com/orion-platform/orion-knowledge/store/rag"
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
	logger               echo.Logger
	auth                 middleware.AuthMiddleware
	tenantMiddleware     *middleware.TenantMiddleware
	ragService           rag.RAGService
	llmUsecase           *LLMUsecase
}

// NewCompatRoutesHandler 创建兼容路由处理器
func NewCompatRoutesHandler(
	kbHandler *KnowledgeBaseHandler,
	nodeHandler *NodeHandler,
	logger echo.Logger,
	auth middleware.AuthMiddleware,
	ragService rag.RAGService,
	llmUsecase *LLMUsecase,
) *CompatRoutesHandler {
	return &CompatRoutesHandler{
		knowledgeBaseHandler: kbHandler,
		nodeHandler:          nodeHandler,
		logger:               logger,
		auth:                 auth,
		tenantMiddleware:     middleware.NewTenantMiddleware("default"),
		ragService:           ragService,
		llmUsecase:           llmUsecase,
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
	group.PUT("/docs/:id", h.nodeHandler.UpdateNode)
	group.DELETE("/docs/:id", h.nodeHandler.DeleteNode)

	// ========== RAG 相关 (/rag) ==========
	group.POST("/rag/retrieve", h.RAGRetrieve)
	group.POST("/rag/query", h.RAGQuery)

	h.logger.Info("[CompatRoutes] Registered /api/v1/knowledge/* routes with tenant isolation")
}

// listSpacesWithTenant 带租户过滤的空间列表
func (h *CompatRoutesHandler) listSpacesWithTenant(c echo.Context) error {
	tenantID := middleware.WithTenant(c)
	h.logger.Debugf("[CompatRoutes] listSpacesWithTenant tenant: %s", tenantID)

	// TODO: 将 tenantID 传递给 handler 的查询条件
	// 临时直接调用原有handler，后续修改KBRepository添加tenant过滤
	return h.knowledgeBaseHandler.GetKnowledgeBaseList(c)
}

// getSpaceWithTenant 带租户过滤的空间详情
func (h *CompatRoutesHandler) getSpaceWithTenant(c echo.Context) error {
	tenantID := middleware.WithTenant(c)
	kbID := c.Param("id")
	h.logger.Debugf("[CompatRoutes] getSpaceWithTenant tenant: %s, kbID: %s", tenantID, kbID)

	// TODO: 验证该space属于当前租户
	return h.knowledgeBaseHandler.GetKnowledgeBaseDetail(c)
}

// listDocsWithTenant 带租户过滤的文档列表
func (h *CompatRoutesHandler) listDocsWithTenant(c echo.Context) error {
	tenantID := middleware.WithTenant(c)
	h.logger.Debugf("[CompatRoutes] listDocsWithTenant tenant: %s", tenantID)

	// TODO: 将 tenantID 传递给handler的查询条件
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

	// 调用RAG服务检索
	rewriteQuery, chunks, err := h.ragService.QueryRecords(c.Request().Context(), &rag.QueryRecordsRequest{
		DatasetID:           req.DatasetID,
		Query:               req.Query,
		GroupIDs:            req.GroupIDs,
		MaxChunksPerDoc:     req.TopK,
		SimilarityThreshold: 0.7,
	})
	if err != nil {
		h.logger.Error("[RAGRetrieve] QueryRecords failed", "error", err, "tenant", tenantID)
		return c.JSON(500, map[string]string{"error": "retrieval failed: " + err.Error()})
	}

	// 转换结果
	results := make([]RAGRetrieveResult, 0, len(chunks))
	for _, chunk := range chunks {
		results = append(results, RAGRetrieveResult{
			DocID:   chunk.DocID,
			Title:   chunk.Title,
			Snippet: chunk.Content,
			Score:   chunk.Score,
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

	// 调用RAG检索
	rewriteQuery, chunks, err := h.ragService.QueryRecords(c.Request().Context(), &rag.QueryRecordsRequest{
		DatasetID:           datasetID,
		Query:               req.Query,
		MaxChunksPerDoc:     5,
		SimilarityThreshold: 0.7,
	})
	if err != nil {
		h.logger.Error("[RAGQuery] QueryRecords failed", "error", err, "tenant", tenantID)
		return c.JSON(500, map[string]string{"error": "retrieval failed: " + err.Error()})
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
				Title: chunk.Title,
				Score: chunk.Score,
			})
		}
		contextBuilder.WriteString(fmt.Sprintf("【文档 %s】\n%s\n\n", chunk.Title, chunk.Content))
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
func (h *CompatRoutesHandler) generateAnswerWithLLM(ctx context.Context, question, context string) (string, error) {
	// 使用LLM Usecase生成答案
	// 这里需要调用modelkit，简化处理返回基于上下文的答案
	prompt := fmt.Sprintf(`你是一个知识库问答助手。请根据以下上下文回答用户的问题。

上下文：
%s

问题：%s

请根据上下文提供准确、简洁的回答。如果上下文中没有相关信息，请明确告知用户。`, context, question)

	// TODO: 实现完整的LLM调用
	// 暂时返回基于上下文的简单答案
	return fmt.Sprintf("根据检索到的知识库资料：\n\n%s", context), nil
}