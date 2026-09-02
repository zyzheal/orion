package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/ai/vector/models"
	"orion/platform-svc-go/internal/ai/vector/service"
	"orion/platform-svc-go/internal/middleware"
)

type VectorHandler struct {
	svc *service.VectorService
}

func NewVectorHandler(svc *service.VectorService) *VectorHandler {
	return &VectorHandler{svc: svc}
}

func (h *VectorHandler) GetTenantID(c *gin.Context) string {
	return c.GetString("tenantId")
}

// RegisterRoutes registers vector routes.
func (h *VectorHandler) RegisterRoutes(rg *gin.RouterGroup) {
	stores := rg.Group("/vector/stores")

	stores.GET("", auth.RequirePermission("ai", "read"), h.ListStores)
	stores.POST("", auth.RequirePermission("ai", "write"), h.CreateStore)
	stores.GET("/:id", auth.RequirePermission("ai", "read"), h.GetStore)
	stores.DELETE("/:id", auth.RequirePermission("ai", "delete"), h.DeleteStore)

	vectors := rg.Group("/vector/stores/:store_id/vectors")
	vectors.PUT("/:vector_id", auth.RequirePermission("ai", "write"), h.UpsertVector)
	vectors.DELETE("/:vector_id", auth.RequirePermission("ai", "delete"), h.DeleteVector)

	rg.POST("/vector/search", auth.RequirePermission("ai", "read"), h.Search)
}

// ListStores returns paginated vector stores.
func (h *VectorHandler) ListStores(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AIVectorListStores")
	defer span.End()
	tenantID := h.GetTenantID(c)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	stores, total, err := h.svc.QueryStores(ctx, tenantID, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"total": total, "data": stores})
}

// CreateStore creates a new vector store.
func (h *VectorHandler) CreateStore(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AIVectorCreateStore")
	defer span.End()
	tenantID := h.GetTenantID(c)
	var req models.CreateStoreRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	store, err := h.svc.CreateStore(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, store)
}

// GetStore returns a single vector store.
func (h *VectorHandler) GetStore(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AIVectorGetStore")
	defer span.End()
	tenantID := h.GetTenantID(c)
	id := c.Param("id")

	store, err := h.svc.GetStore(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, store)
}

// DeleteStore removes a vector store.
func (h *VectorHandler) DeleteStore(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AIVectorDeleteStore")
	defer span.End()
	tenantID := h.GetTenantID(c)
	id := c.Param("id")

	if err := h.svc.DeleteStore(ctx, tenantID, id); err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondNoContent(c)
}

// UpsertVector inserts or updates a vector.
func (h *VectorHandler) UpsertVector(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AIVectorUpsertVector")
	defer span.End()
	tenantID := h.GetTenantID(c)
	storeID := c.Param("store_id")
	vectorID := c.Param("vector_id")

	var req struct {
		Data    []float64 `json:"data" binding:"required"`
		Payload string    `json:"payload"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	if err := h.svc.UpsertVector(ctx, tenantID, storeID, vectorID, req.Data, req.Payload); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"message": "upserted", "data": gin.H{"vector_id": vectorID}})
}

// DeleteVector removes a vector.
func (h *VectorHandler) DeleteVector(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AIVectorDeleteVector")
	defer span.End()
	tenantID := h.GetTenantID(c)
	storeID := c.Param("store_id")
	vectorID := c.Param("vector_id")

	if err := h.svc.DeleteVector(ctx, tenantID, storeID, vectorID); err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondNoContent(c)
}

// Search performs vector similarity search.
func (h *VectorHandler) Search(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AIVectorSearch")
	defer span.End()
	tenantID := h.GetTenantID(c)
	var req models.SearchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	results, err := h.svc.SearchVectors(ctx, tenantID, req.StoreID, req.Query, req.TopK)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"query": results, "top_k": req.TopK})
}
