package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/semantic-search/models"
	"orion/platform-svc-go/internal/semantic-search/service"
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

func (h *SemanticSearchHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/semantic-search", auth.RequirePermission("ai", "read"), h.Search)
	rg.POST("/semantic-search/index", auth.RequirePermission("ai", "write"), h.Index)
}

func (h *SemanticSearchHandler) Search(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SemanticSearch")
	defer span.End()
	tenantID := h.GetTenantID(c)
	var req models.SearchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error()})
		return
	}

	resp, err := h.svc.Search(ctx, tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": resp})
}

func (h *SemanticSearchHandler) Index(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "IndexSemanticSearch")
	defer span.End()
	tenantID := h.GetTenantID(c)
	var req models.IndexRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error()})
		return
	}

	if err := h.svc.IndexContent(ctx, tenantID, &req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 0, "message": "indexed"})
}
