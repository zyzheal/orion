package handler

import (
	"net/http"
	"github.com/gin-gonic/gin"
	"github.com/orion/agent-svc/internal/sandbox/service"
)

type SandboxHandler struct {
	Service service.SandboxService
}

func NewSandboxHandler(svc service.SandboxService) *SandboxHandler {
	return &SandboxHandler{Service: svc}
}

func (h *SandboxHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/sandbox/create", h.Create)
	rg.POST("/sandbox/:id/execute", h.Execute)
	rg.GET("/sandbox/:id", h.GetStatus)
	rg.DELETE("/sandbox/:id", h.Destroy)
}

func (h *SandboxHandler) Create(c *gin.Context) {
	c.JSON(http.StatusCreated, gin.H{"code": 0, "message": "success"})
}

func (h *SandboxHandler) Execute(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success"})
}

func (h *SandboxHandler) GetStatus(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success"})
}

func (h *SandboxHandler) Destroy(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success"})
}
