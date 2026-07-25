package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/orion/agent-svc/internal/agent/service"
)

type AgentHandler struct {
	Service service.AgentService
}

func NewAgentHandler(svc service.AgentService) *AgentHandler {
	return &AgentHandler{Service: svc}
}

func (h *AgentHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/register", h.Register)
	rg.GET("/agents", h.List)
	rg.GET("/agents/:id", h.Get)
	rg.PUT("/agents/:id", h.Update)
	rg.DELETE("/agents/:id", h.Delete)
	rg.POST("/agents/:id/heartbeat", h.Heartbeat)
	rg.GET("/agents/:id/runs", h.ListRuns)
}

func (h *AgentHandler) Register(c *gin.Context) {
	var req struct {
		Name    string `json:"name"`
		Type    string `json:"type"`
		Version string `json:"version"`
		Tags    string `json:"tags"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid request"})
		return
	}
	agent, err := h.Service.Register(c.Request.Context(), req.Name, req.Type, req.Version, req.Tags)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 0, "message": "success", "data": agent})
}

func (h *AgentHandler) List(c *gin.Context) {
	agents, err := h.Service.List(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success", "data": agents})
}

func (h *AgentHandler) Get(c *gin.Context) {
	id := c.Param("id")
	agent, err := h.Service.Get(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success", "data": agent})
}

func (h *AgentHandler) Update(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success"})
}

func (h *AgentHandler) Delete(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success"})
}

func (h *AgentHandler) Heartbeat(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success"})
}

func (h *AgentHandler) ListRuns(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success"})
}
