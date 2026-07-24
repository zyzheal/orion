package handler

import (
	"strconv"

	"orion/platform-svc-go/internal/notification/chatops/models"
	"orion/platform-svc-go/internal/notification/chatops/service"

	"github.com/gin-gonic/gin"
)

type CommandHandler struct {
	svc *service.CommandService
}

func NewCommandHandler(svc *service.CommandService) *CommandHandler {
	return &CommandHandler{svc: svc}
}

func (h *CommandHandler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateCommandRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	cmd, err := h.svc.Create(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, cmd)
}

func (h *CommandHandler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}
	cmds, err := h.svc.List(c.Request.Context(), tenantID, (page-1)*pageSize, pageSize)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, cmds)
}

func (h *CommandHandler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateCommandRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.Update(c.Request.Context(), tenantID, id, req); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "updated"})
}

func (h *CommandHandler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

func (h *CommandHandler) Parse(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req struct {
		Raw string `json:"raw" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	parsed, err := h.svc.ParseCommand(c.Request.Context(), tenantID, req.Raw)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, parsed)
}

func (h *CommandHandler) Execute(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req struct {
		Raw      string `json:"raw" binding:"required"`
		UserID   string `json:"user_id" binding:"required"`
		Platform string `json:"platform"`
		Channel  string `json:"channel"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.ExecuteCommand(c.Request.Context(), tenantID, req.UserID, req.Platform, req.Channel, req.Raw)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

func (h *CommandHandler) RegisterRoutes(rg *gin.RouterGroup) {
	cmds := rg.Group("/commands")
	{
		cmds.POST("", h.Create)
		cmds.GET("", h.List)
		cmds.PUT("/:id", h.Update)
		cmds.DELETE("/:id", h.Delete)
		cmds.POST("/parse", h.Parse)
		cmds.POST("/execute", h.Execute)
	}
}
