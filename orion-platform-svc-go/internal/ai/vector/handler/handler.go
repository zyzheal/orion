package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/ai/vector/models"
	"orion/platform-svc-go/internal/ai/vector/service"
	"orion/go-common/pkg/auth"
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
	tenantID := h.GetTenantID(c)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	stores, total, err := h.svc.QueryStores(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "total": total, "data": stores})
}

// CreateStore creates a new vector store.
func (h *VectorHandler) CreateStore(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	var req models.CreateStoreRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error()})
		return
	}

	store, err := h.svc.CreateStore(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 0, "message": "created", "data": store})
}

// GetStore returns a single vector store.
func (h *VectorHandler) GetStore(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	id := c.Param("id")

	store, err := h.svc.GetStore(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": store})
}

// DeleteStore removes a vector store.
func (h *VectorHandler) DeleteStore(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	id := c.Param("id")

	if err := h.svc.DeleteStore(c.Request.Context(), tenantID, id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": err.Error()})
		return
	}
	c.JSON(http.StatusNoContent, nil)
}

// UpsertVector inserts or updates a vector.
func (h *VectorHandler) UpsertVector(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	storeID := c.Param("store_id")
	vectorID := c.Param("vector_id")

	var req struct {
		Data    []float64 `json:"data" binding:"required"`
		Payload string    `json:"payload"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error()})
		return
	}

	if err := h.svc.UpsertVector(c.Request.Context(), tenantID, storeID, vectorID, req.Data, req.Payload); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 0, "message": "upserted", "data": gin.H{"vector_id": vectorID}})
}

// DeleteVector removes a vector.
func (h *VectorHandler) DeleteVector(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	storeID := c.Param("store_id")
	vectorID := c.Param("vector_id")

	if err := h.svc.DeleteVector(c.Request.Context(), tenantID, storeID, vectorID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": err.Error()})
		return
	}
	c.JSON(http.StatusNoContent, nil)
}

// Search performs vector similarity search.
func (h *VectorHandler) Search(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	var req models.SearchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error()})
		return
	}

	results, err := h.svc.SearchVectors(c.Request.Context(), tenantID, req.StoreID, req.Query, req.TopK)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": gin.H{"query": results, "top_k": req.TopK}})
}
