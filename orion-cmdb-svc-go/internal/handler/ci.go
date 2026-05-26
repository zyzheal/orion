package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"orion-cmdb-svc-go/internal/models"
	"orion-cmdb-svc-go/internal/service"
)

type CIHandler struct {
	svc *service.CIService
}

func NewCIHandler(svc *service.CIService) *CIHandler {
	return &CIHandler{svc: svc}
}

func GetActorID(c *gin.Context) string {
	if uid, ok := c.Get("user_id"); ok {
		if s, ok := uid.(string); ok && s != "" {
			return s
		}
	}
	return c.GetHeader("X-User-ID")
}

// ListCIItems GET /api/v1/ci-items
func (h *CIHandler) ListCIItems(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	var q models.ListQuery
	if err := c.ShouldBindQuery(&q); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	items, total, err := h.svc.List(c.Request.Context(), tenantID, q)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list CI items"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  items,
		"total": total,
		"page":  q.Page,
	})
}

// GetCIItem GET /api/v1/ci-items/:id
func (h *CIHandler) GetCIItem(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	item, err := h.svc.GetByID(c.Request.Context(), id, tenantID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "CI item not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": item})
}

// CreateCIItem POST /api/v1/ci-items
func (h *CIHandler) CreateCIItem(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	actor := GetActorID(c)

	var req models.CreateCIRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	item, err := h.svc.Create(c.Request.Context(), tenantID, &req, actor)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create CI item"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": item})
}

// UpdateCIItem PUT /api/v1/ci-items/:id
func (h *CIHandler) UpdateCIItem(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	actor := GetActorID(c)

	var req models.UpdateCIRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	item, err := h.svc.Update(c.Request.Context(), tenantID, id, &req, actor)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "CI item not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": item})
}

// DeleteCIItem DELETE /api/v1/ci-items/:id
func (h *CIHandler) DeleteCIItem(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	actor := GetActorID(c)

	if err := h.svc.Delete(c.Request.Context(), tenantID, id, actor); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete CI item"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "CI item deleted"})
}

// GetTopology GET /api/v1/ci-items/:id/topology
func (h *CIHandler) GetTopology(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	topology, err := h.svc.GetTopology(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "CI item not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": topology})
}

// ListCIRelations GET /api/v1/ci-relations
func (h *CIHandler) ListCIRelations(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ciID := c.Query("ci_id")

	if ciID == "" {
		// Return all relations for the tenant
		c.JSON(http.StatusOK, gin.H{"data": []any{}})
		return
	}

	rels, err := h.svc.GetTopology(c.Request.Context(), tenantID, ciID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "CI item not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": rels.Relations})
}

// CreateRelation POST /api/v1/ci-relations
func (h *CIHandler) CreateRelation(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	actor := GetActorID(c)

	var req models.CreateRelationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	rel, err := h.svc.CreateRelation(c.Request.Context(), tenantID, &req, actor)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create relation"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": rel})
}

// DeleteRelation DELETE /api/v1/ci-relations/:id
func (h *CIHandler) DeleteRelation(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	actor := GetActorID(c)

	if err := h.svc.DeleteRelation(c.Request.Context(), tenantID, id, actor); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete relation"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "relation deleted"})
}
