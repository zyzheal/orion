package handler

import (
	"orion/go-common/pkg/errors"
	"net/http"
	"fmt"
	"net/http"

	"orion/knowledge-svc-go/internal/config"
	"orion/knowledge-svc-go/internal/models"
	"orion/knowledge-svc-go/internal/service"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// Handler holds all dependencies for HTTP handlers.
type Handler struct {
	cfg       *config.Config
	knowledge *service.KnowledgeService
	logger    *zap.Logger
}

// New creates a new Handler.
func New(cfg *config.Config, knowledge *service.KnowledgeService, logger *zap.Logger) *Handler {
	return &Handler{
		cfg:       cfg,
		knowledge: knowledge,
		logger:    logger,
	}
}

// Response is the standard API response envelope.
type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data"`
}

func (h *Handler) ok(c *gin.Context, data interface{}) {
	respondSuccess(c, data)
}

func (h *Handler) created(c *gin.Context, data interface{}) {
	respondCreated(c, data)
}

func (h *Handler) err(c *gin.Context, status int, msg string) {
	errors.WriteError(c, errors.ErrInternal, msg, status)
}

// ============================================================================
// Space handlers
// ============================================================================

// ListSpaces handles GET /api/v1/knowledge/spaces
func (h *Handler) ListSpaces(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page := c.DefaultQuery("page", "1")
	perPage := c.DefaultQuery("perPage", "50")
	search := c.Query("search")
	spaceType := c.Query("type")

	limit := 50
	offset := 0
	pageNum := 1
	perPageNum := 50
	if page != "" && perPage != "" {
		fmt.Sscanf(page, "%d", &pageNum)
		fmt.Sscanf(perPage, "%d", &perPageNum)
		limit = perPageNum
		offset = (pageNum - 1) * perPageNum
	}

	spaces, err := h.knowledge.ListSpaces(c.Request.Context(), tenantID, models.SpaceListFilters{
		Type:    strPtrOrEmpty(spaceType),
		Search:  strPtrOrEmpty(search),
		Limit:   limit,
		Offset:  offset,
	})
	if err != nil {
		h.logger.Error("failed to list spaces", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.ok(c, gin.H{
		"data":  spaces,
		"meta":  gin.H{"total": len(spaces), "page": pageNum, "perPage": perPageNum},
	})
}

// CreateSpace handles POST /api/v1/knowledge/spaces
func (h *Handler) CreateSpace(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ownerID := c.GetString("actor_id")

	var req models.CreateSpaceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	if req.OwnerID == "" {
		req.OwnerID = ownerID
	}

	space, err := h.knowledge.CreateSpace(c.Request.Context(), tenantID, req)
	if err != nil {
		h.logger.Error("failed to create space", zap.Error(err))
		if err == service.ErrInvalidInput {
			h.err(c, http.StatusBadRequest, "invalid input")
			return
		}
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.created(c, gin.H{"data": space})
}

// GetSpace handles GET /api/v1/knowledge/spaces/:id
func (h *Handler) GetSpace(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	space, err := h.knowledge.GetSpace(c.Request.Context(), tenantID, id)
	if err != nil {
		if err == service.ErrSpaceNotFound {
			h.err(c, http.StatusNotFound, "space not found")
			return
		}
		h.logger.Error("failed to get space", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.ok(c, gin.H{"data": space})
}

// UpdateSpace handles PUT /api/v1/knowledge/spaces/:id
func (h *Handler) UpdateSpace(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	space, err := h.knowledge.UpdateSpace(c.Request.Context(), tenantID, id, body)
	if err != nil {
		if err == service.ErrSpaceNotFound {
			h.err(c, http.StatusNotFound, "space not found")
			return
		}
		h.logger.Error("failed to update space", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.ok(c, gin.H{"data": space})
}

// DeleteSpace handles DELETE /api/v1/knowledge/spaces/:id
func (h *Handler) DeleteSpace(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	if err := h.knowledge.DeleteSpace(c.Request.Context(), tenantID, id); err != nil {
		if err == service.ErrSpaceNotFound {
			h.err(c, http.StatusNotFound, "space not found")
			return
		}
		h.logger.Error("failed to delete space", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	c.Status(http.StatusNoContent)
}

// ============================================================================
// Document handlers
// ============================================================================

// ListDocs handles GET /api/v1/knowledge/docs
func (h *Handler) ListDocs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	spaceID := c.Query("spaceId")
	status := c.Query("status")
	tag := c.Query("tag")
	search := c.Query("search")
	page := c.DefaultQuery("page", "1")
	perPage := c.DefaultQuery("perPage", "50")

	limit := 50
	offset := 0
	pageNum := 1
	perPageNum := 50
	if page != "" && perPage != "" {
		fmt.Sscanf(page, "%d", &pageNum)
		fmt.Sscanf(perPage, "%d", &perPageNum)
		limit = perPageNum
		offset = (pageNum - 1) * perPageNum
	}

	docType := c.Query("type")
	var filters models.DocListFilters
	filters.SpaceID = strPtrOrEmpty(spaceID)
	filters.Status = strPtrOrEmpty(status)
	filters.Tag = strPtrOrEmpty(tag)
	filters.Search = strPtrOrEmpty(search)
	filters.Limit = limit
	filters.Offset = offset

	var docs []models.KnowledgeDoc
	var err error

	if docType == "docs" {
		docs, err = h.knowledge.ListDocsByType(c.Request.Context(), tenantID, filters)
	} else {
		docs, err = h.knowledge.ListDocs(c.Request.Context(), tenantID, filters)
	}

	if err != nil {
		h.logger.Error("failed to list docs", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.ok(c, gin.H{
		"data":    docs,
		"meta":    gin.H{"total": len(docs), "page": pageNum, "perPage": perPageNum, "type": docType},
	})
}

// GetDocTags handles GET /api/v1/knowledge/docs/tags
func (h *Handler) GetDocTags(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	tags, err := h.knowledge.GetDocTags(c.Request.Context(), tenantID)
	if err != nil {
		h.logger.Error("failed to get doc tags", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.ok(c, gin.H{"data": tags})
}

// GetDocToc handles GET /api/v1/knowledge/docs/toc
func (h *Handler) GetDocToc(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	toc, err := h.knowledge.GetDocToc(c.Request.Context(), tenantID)
	if err != nil {
		h.logger.Error("failed to get doc toc", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.ok(c, gin.H{"data": toc})
}

// TriggerSync handles POST /api/v1/knowledge/sync
func (h *Handler) TriggerSync(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	var req models.SyncRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// Body optional
	}

	log, err := h.knowledge.TriggerSync(c.Request.Context(), tenantID, req.Source)
	if err != nil {
		h.logger.Error("failed to trigger sync", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.ok(c, gin.H{"data": log})
}

// GetSyncLogs handles GET /api/v1/knowledge/sync/logs
func (h *Handler) GetSyncLogs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit := 10
	if l := c.Query("limit"); l != "" {
		fmt.Sscanf(l, "%d", &limit)
	}

	logs, err := h.knowledge.GetSyncLogs(c.Request.Context(), tenantID, limit)
	if err != nil {
		h.logger.Error("failed to get sync logs", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.ok(c, gin.H{"data": logs})
}

// CreateDoc handles POST /api/v1/knowledge/docs
func (h *Handler) CreateDoc(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	authorID := c.GetString("actor_id")

	var req models.CreateDocRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	if req.AuthorID == nil {
		req.AuthorID = &authorID
	}

	doc, err := h.knowledge.CreateDoc(c.Request.Context(), tenantID, req)
	if err != nil {
		h.logger.Error("failed to create doc", zap.Error(err))
		if err == service.ErrInvalidInput {
			h.err(c, http.StatusBadRequest, "invalid input")
			return
		}
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.created(c, gin.H{"data": doc})
}

// GetDoc handles GET /api/v1/knowledge/docs/:id
func (h *Handler) GetDoc(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	doc, err := h.knowledge.GetDoc(c.Request.Context(), tenantID, id)
	if err != nil {
		if err == service.ErrDocNotFound {
			h.err(c, http.StatusNotFound, "doc not found")
			return
		}
		h.logger.Error("failed to get doc", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.ok(c, gin.H{"data": doc})
}

// UpdateDoc handles PUT /api/v1/knowledge/docs/:id
func (h *Handler) UpdateDoc(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	doc, err := h.knowledge.UpdateDoc(c.Request.Context(), tenantID, id, body)
	if err != nil {
		if err == service.ErrDocNotFound {
			h.err(c, http.StatusNotFound, "doc not found")
			return
		}
		h.logger.Error("failed to update doc", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.ok(c, gin.H{"data": doc})
}

// DeleteDoc handles DELETE /api/v1/knowledge/docs/:id
func (h *Handler) DeleteDoc(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	if err := h.knowledge.DeleteDoc(c.Request.Context(), tenantID, id); err != nil {
		if err == service.ErrDocNotFound {
			h.err(c, http.StatusNotFound, "doc not found")
			return
		}
		h.logger.Error("failed to delete doc", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	c.Status(http.StatusNoContent)
}

// GetDocVersions handles GET /api/v1/knowledge/docs/:id/versions
func (h *Handler) GetDocVersions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	versions, err := h.knowledge.GetDocVersions(c.Request.Context(), tenantID, id)
	if err != nil {
		if err == service.ErrDocNotFound {
			h.err(c, http.StatusNotFound, "doc not found")
			return
		}
		h.logger.Error("failed to get doc versions", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.ok(c, gin.H{"data": versions})
}

// ============================================================================
// RAG handlers
// ============================================================================

// RAGRetrieve handles POST /api/v1/knowledge/rag/retrieve
func (h *Handler) RAGRetrieve(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	var req models.RAGRetrieveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	topK := 10
	if req.TopK != nil && *req.TopK > 0 {
		topK = *req.TopK
	}

	results, err := h.knowledge.Retrieve(c.Request.Context(), tenantID, req.Query, req.SpaceID, topK)
	if err != nil {
		h.logger.Error("failed to retrieve", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.ok(c, gin.H{
		"data": gin.H{
			"results": results,
			"total":   len(results),
		},
	})
}

// RAGQuery handles POST /api/v1/knowledge/rag/query
func (h *Handler) RAGQuery(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	var req models.RAGRetrieveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	topK := 10
	if req.TopK != nil && *req.TopK > 0 {
		topK = *req.TopK
	}

	results, err := h.knowledge.Retrieve(c.Request.Context(), tenantID, req.Query, req.SpaceID, topK)
	if err != nil {
		h.logger.Error("failed to query", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	// Build mock answer from retrieved sources
	answer := "No relevant knowledge sources found for the query."
	confidence := 0.0
	if len(results) > 0 {
		var snippets []string
		for _, r := range results {
			if r.Similarity > 0.3 {
				snippets = append(snippets, r.Content[:min(len(r.Content), 500)])
			}
		}
		if len(snippets) > 0 {
			answer = fmt.Sprintf("Based on %d retrieved knowledge source(s):\n\n%s", len(results), joinSnippets(snippets, "\n\n---\n\n"))
			confidence = minFloat64(0.9, results[0].Similarity+0.2)
		}
	}

	sources := make([]models.RAGSource, 0, len(results))
	for _, r := range results {
		sources = append(sources, models.RAGSource{
			DocumentID:     r.ID,
			Title:          r.Title,
			Snippet:        r.Content[:min(len(r.Content), 300)],
			RelevanceScore: r.Similarity,
			SpaceID:        r.SpaceID,
		})
	}

	h.ok(c, gin.H{
		"data": models.RAGQueryResponse{
			Answer:     answer,
			Sources:    sources,
			Confidence: confidence,
		},
	})
}

// GetGraph handles GET /api/v1/knowledge/graph
func (h *Handler) GetGraph(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	spaceID := c.Query("spaceId")

	graph, err := h.knowledge.GetGraph(c.Request.Context(), tenantID, strPtrOrEmpty(spaceID))
	if err != nil {
		h.logger.Error("failed to get graph", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.ok(c, gin.H{"data": graph})
}

// ============================================================================
// Helpers
// ============================================================================

func strPtrOrEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func minFloat64(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

func joinSnippets(snippets []string, sep string) string {
	result := ""
	for i, s := range snippets {
		if i > 0 {
			result += sep
		}
		if len(s) > 2000 {
			s = s[:2000]
		}
		result += s
	}
	return result
}
