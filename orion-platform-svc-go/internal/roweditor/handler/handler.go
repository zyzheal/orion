package handler

import (
	"github.com/gin-gonic/gin"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/roweditor"
	"orion/platform-svc-go/internal/roweditor/handler/models"
	"orion/platform-svc-go/internal/roweditor/service"
)

type Handler struct {
	svc roweditor.DBOperations
	svc2 *service.Service
}

func NewHandler(svc *service.Service, db roweditor.DBOperations) *Handler {
	return &Handler{svc: db, svc2: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	g := rg.Group("/row-editors")
	g.POST("/register", auth.RequirePermission("roweditor", "write"), h.RegisterEditor)
	g.GET("/:name/stats", auth.RequirePermission("roweditor", "read"), h.Stats)
	rg.POST("/rows/:editor/create", auth.RequirePermission("roweditor", "write"), h.CreateRow)
	rg.GET("/rows/:editor/:row_id", auth.RequirePermission("roweditor", "read"), h.ReadRow)
	rg.PUT("/rows/:editor", auth.RequirePermission("roweditor", "write"), h.UpdateRow)
	rg.DELETE("/rows/:editor/:row_id", auth.RequirePermission("roweditor", "delete"), h.DeleteRow)
	rg.POST("/rows/:editor/batch-create", auth.RequirePermission("roweditor", "write"), h.BatchCreate)
	rg.POST("/rows/:editor/batch-update", auth.RequirePermission("roweditor", "write"), h.BatchUpdate)
}

func (h *Handler) RegisterEditor(c *gin.Context) {
	var req models.RowEditorSpecRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	name := c.Query("name")
	if name == "" {
		name = req.TableName
	}
	if err := h.svc2.RegisterEditor(c.Request.Context(), name, &req); err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(201, gin.H{"status": "registered", "name": name})
}

func (h *Handler) Stats(c *gin.Context) {
	stats, err := h.svc2.Stats(c.Request.Context(), c.Param("name"))
	if err != nil {
		c.JSON(404, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"data": stats})
}

func (h *Handler) CreateRow(c *gin.Context) {
	var req models.RowCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	resp, err := h.svc2.CreateRow(c.Request.Context(), c.Param("editor"), h.svc, &req)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(201, gin.H{"data": resp})
}

func (h *Handler) ReadRow(c *gin.Context) {
	resp, err := h.svc2.ReadRow(c.Request.Context(), c.Param("editor"), h.svc, c.GetString("tenant_id"), c.Param("row_id"))
	if err != nil {
		c.JSON(404, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"data": resp})
}

func (h *Handler) UpdateRow(c *gin.Context) {
	var req models.RowUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	resp, err := h.svc2.UpdateRow(c.Request.Context(), c.Param("editor"), h.svc, &req)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"data": resp})
}

func (h *Handler) DeleteRow(c *gin.Context) {
	resp, err := h.svc2.DeleteRow(c.Request.Context(), c.Param("editor"), h.svc, c.GetString("tenant_id"), c.Param("row_id"))
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"data": resp})
}

func (h *Handler) BatchCreate(c *gin.Context) {
	var req models.BatchCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	resp, err := h.svc2.BatchCreate(c.Request.Context(), c.Param("editor"), h.svc, &req)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(201, gin.H{"data": resp})
}

func (h *Handler) BatchUpdate(c *gin.Context) {
	var req models.BatchUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	resp, err := h.svc2.BatchUpdate(c.Request.Context(), c.Param("editor"), h.svc, &req)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"data": resp})
}
