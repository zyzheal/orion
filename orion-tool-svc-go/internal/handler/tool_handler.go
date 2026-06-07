package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"orion-tool-svc-go/internal/models"
	"orion-tool-svc-go/internal/service"
)

// ToolHandler handles HTTP requests for tools.
type ToolHandler struct {
	svc *service.ToolService
}

func NewToolHandler(svc *service.ToolService) *ToolHandler {
	return &ToolHandler{svc: svc}
}

func (h *ToolHandler) CreateTool(c *gin.Context) {
	var req models.CreateToolRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error()})
		return
	}

	tenantID := c.GetHeader("X-Tenant-ID")
	userID := c.GetHeader("X-User-ID")

	tool, err := h.svc.Create(c.Request.Context(), tenantID, userID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 0, "data": tool})
}

func (h *ToolHandler) GetTool(c *gin.Context) {
	tenantID := c.GetHeader("X-Tenant-ID")
	id := c.Param("id")

	tool, err := h.svc.Get(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": tool})
}

func (h *ToolHandler) ListTools(c *gin.Context) {
	tenantID := c.GetHeader("X-Tenant-ID")

	var params models.ToolListParams
	if err := c.ShouldBindQuery(&params); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error()})
		return
	}

	tools, total, err := h.svc.List(c.Request.Context(), tenantID, params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": tools, "total": total})
}

func (h *ToolHandler) UpdateTool(c *gin.Context) {
	tenantID := c.GetHeader("X-Tenant-ID")
	id := c.Param("id")

	var req models.UpdateToolRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error()})
		return
	}

	tool, err := h.svc.Update(c.Request.Context(), tenantID, id, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": tool})
}

func (h *ToolHandler) DeleteTool(c *gin.Context) {
	tenantID := c.GetHeader("X-Tenant-ID")
	id := c.Param("id")

	if err := h.svc.Delete(c.Request.Context(), tenantID, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "deleted"})
}

func (h *ToolHandler) GetCategories(c *gin.Context) {
	tenantID := c.GetHeader("X-Tenant-ID")

	cats, err := h.svc.GetCategories(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": cats})
}

func (h *ToolHandler) SearchTools(c *gin.Context) {
	tenantID := c.GetHeader("X-Tenant-ID")
	query := c.Query("q")

	tools, err := h.svc.Search(c.Request.Context(), tenantID, query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": tools})
}

func (h *ToolHandler) GetVersions(c *gin.Context) {
	id := c.Param("id")

	versions, err := h.svc.GetVersions(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": versions})
}

func (h *ToolHandler) GetInvocations(c *gin.Context) {
	tenantID := c.GetHeader("X-Tenant-ID")
	id := c.Param("id")

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	invs, err := h.svc.GetInvocations(c.Request.Context(), tenantID, id, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": invs})
}
