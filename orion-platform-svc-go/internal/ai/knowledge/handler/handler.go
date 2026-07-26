package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/ai/knowledge/models"
	"orion/platform-svc-go/internal/ai/knowledge/service"
	"orion/go-common/pkg/auth"
)

type KnowledgeHandler struct {
	svc *service.KnowledgeService
}

func NewKnowledgeHandler(svc *service.KnowledgeService) *KnowledgeHandler {
	return &KnowledgeHandler{svc: svc}
}

func (h *KnowledgeHandler) GetTenantID(c *gin.Context) string {
	return c.GetString("tenant_id")
}

// RegisterRoutes registers knowledge routes.
func (h *KnowledgeHandler) RegisterRoutes(rg *gin.RouterGroup) {
	kb := rg.Group("/knowledge/bases")

	kb.GET("", auth.RequirePermission("ai", "read"), h.ListBases)
	kb.POST("", auth.RequirePermission("ai", "write"), h.CreateBase)
	kb.GET("/:id", auth.RequirePermission("ai", "read"), h.GetBase)
	kb.DELETE("/:id", auth.RequirePermission("ai", "delete"), h.DeleteBase)

	doc := rg.Group("/knowledge/bases/:base_id/documents")
	doc.GET("", auth.RequirePermission("ai", "read"), h.ListDocuments)
	doc.POST("", auth.RequirePermission("ai", "write"), h.AddDocument)
	doc.DELETE("/:doc_id", auth.RequirePermission("ai", "delete"), h.DeleteDocument)

	rg.POST("/knowledge/search", auth.RequirePermission("ai", "read"), h.Search)
}

// ListBases returns paginated knowledge bases.
func (h *KnowledgeHandler) ListBases(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	resp, err := h.svc.QueryBases(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"total": resp.Total, "data": resp.Data})
}

// CreateBase creates a new knowledge base.
func (h *KnowledgeHandler) CreateBase(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	var req models.CreateBaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	base, err := h.svc.CreateBase(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, base)
}

// GetBase returns a single knowledge base.
func (h *KnowledgeHandler) GetBase(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	id := c.Param("id")

	base, err := h.svc.GetBase(c.Request.Context(), tenantID, id)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, base)
}

// DeleteBase removes a knowledge base.
func (h *KnowledgeHandler) DeleteBase(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	id := c.Param("id")

	if err := h.svc.DeleteBase(c.Request.Context(), tenantID, id); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	c.Status(http.StatusNoContent)
}

// ListDocuments returns paginated documents.
func (h *KnowledgeHandler) ListDocuments(c *gin.Context) {
	baseID := c.Param("base_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	resp, err := h.svc.QueryDocuments(c.Request.Context(), baseID, limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"total": resp.Total, "data": resp.Data})
}

// AddDocument adds a document.
func (h *KnowledgeHandler) AddDocument(c *gin.Context) {
	baseID := c.Param("base_id")
	var req struct {
		Title    string `json:"title" binding:"required"`
		Content  string `json:"content" binding:"required"`
		Metadata string `json:"metadata"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	doc, err := h.svc.AddDocument(c.Request.Context(), baseID, req.Title, req.Content, req.Metadata)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, doc)
}

// DeleteDocument removes a document.
func (h *KnowledgeHandler) DeleteDocument(c *gin.Context) {
	id := c.Param("doc_id")

	if err := h.svc.DeleteDocument(c.Request.Context(), id); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	c.Status(http.StatusNoContent)
}

// Search performs semantic search.
func (h *KnowledgeHandler) Search(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	var req models.QueryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	resp, err := h.svc.Search(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, resp)
}
