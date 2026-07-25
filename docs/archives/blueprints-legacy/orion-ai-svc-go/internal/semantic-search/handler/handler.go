package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"orion/ai-svc-go/internal/semantic-search/models"
	"orion/ai-svc-go/internal/semantic-search/service"
	"orion/go-common/pkg/auth"
)

type SemanticSearchHandler struct {
	svc *service.SemanticSearchService
}

func NewSemanticSearchHandler(svc *service.SemanticSearchService) *SemanticSearchHandler {
	return &SemanticSearchHandler{svc: svc}
}

func (h *SemanticSearchHandler) GetTenantID(c *gin.Context) string {
	return c.GetString("tenantId")
}

// RegisterRoutes registers semantic-search routes.
func (h *SemanticSearchHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/semantic-search", auth.RequirePermission("ai", "read"), h.Search)
	rg.POST("/semantic-search/index", auth.RequirePermission("ai", "write"), h.Index)
}

// Search performs semantic search.
func (h *SemanticSearchHandler) Search(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	var req models.SearchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error()})
		return
	}

	resp, err := h.svc.Search(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": resp})
}

// Index indexes content.
func (h *SemanticSearchHandler) Index(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	var req models.IndexRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error()})
		return
	}

	if err := h.svc.IndexContent(c.Request.Context(), tenantID, &req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 0, "message": "indexed"})
}
