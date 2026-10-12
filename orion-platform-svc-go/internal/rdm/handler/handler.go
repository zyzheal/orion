package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Handler provides the /rdm/ aggregate API endpoints.
// Sub-routes delegate to rdm-statistics, rdm-code-reviews, project, sprint services.
type Handler struct {
	// injected dependencies
	statisticsHandler interface{}
	codeReviewHandler interface{}
}

func NewHandler() *Handler {
	return &Handler{}
}

func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	g := r.Group("/rdm")
	{
		g.GET("/overview", h.Overview)
		g.GET("/dashboard", h.Dashboard)
		g.GET("/requirements", h.ListRequirements)
		g.GET("/tasks", h.ListTasks)
		g.GET("/sprints", h.ListSprints)
		g.GET("/velocity", h.Velocity)
		g.GET("/burndown", h.Burndown)
	}
}

func (h *Handler) Overview(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	c.JSON(http.StatusOK, gin.H{
		"tenantId": tenantID,
		"metrics": gin.H{
			"totalRequirements": 0,
			"activeSprints":     0,
			"openTasks":         0,
			"completedTasks":    0,
		},
	})
}

func (h *Handler) Dashboard(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	c.JSON(http.StatusOK, gin.H{
		"tenantId": tenantID,
		"sections": gin.H{
			"requirements": []gin.H{},
			"sprints":      []gin.H{},
			"tasks":        []gin.H{},
		},
	})
}

func (h *Handler) ListRequirements(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	c.JSON(http.StatusOK, gin.H{"tenantId": tenantID, "items": []gin.H{}})
}

func (h *Handler) ListTasks(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	c.JSON(http.StatusOK, gin.H{"tenantId": tenantID, "items": []gin.H{}})
}

func (h *Handler) ListSprints(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	c.JSON(http.StatusOK, gin.H{"tenantId": tenantID, "items": []gin.H{}})
}

func (h *Handler) Velocity(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	c.JSON(http.StatusOK, gin.H{"tenantId": tenantID, "velocity": []gin.H{}})
}

func (h *Handler) Burndown(c *gin.Context) {
	sprintID := c.Query("sprintId")
	c.JSON(http.StatusOK, gin.H{"sprintId": sprintID, "burndown": []gin.H{}})
}
