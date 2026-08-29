package handler

import (
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/code-embedding/models"
	"orion/platform-svc-go/internal/code-embedding/service"
)

type CodeEmbeddingHandler struct {
	svc *service.CodeEmbeddingService
}

func NewCodeEmbeddingHandler(svc *service.CodeEmbeddingService) *CodeEmbeddingHandler {
	return &CodeEmbeddingHandler{svc: svc}
}

func (h *CodeEmbeddingHandler) GetTenantID(c *gin.Context) string {
	return c.GetString("tenantId")
}

func (h *CodeEmbeddingHandler) RegisterRoutes(rg *gin.RouterGroup) {
	embed := rg.Group("/code-embedding")
	embed.POST("/embed", auth.RequirePermission("ai", "write"), h.Embed)
	embed.POST("/search", auth.RequirePermission("ai", "read"), h.Search)
}

func (h *CodeEmbeddingHandler) Embed(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "EmbedCode")
	defer span.End()
	tenantID := h.GetTenantID(c)
	var req models.EmbedRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	resp, err := h.svc.Embed(ctx, tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, gin.H{"code": 0, "message": "embedded", "data": resp.Embedding})
}

func (h *CodeEmbeddingHandler) Search(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SearchCodeEmbedding")
	defer span.End()
	tenantID := h.GetTenantID(c)
	var req models.SearchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	resp, err := h.svc.Search(ctx, tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"code": 0, "data": resp})
}
